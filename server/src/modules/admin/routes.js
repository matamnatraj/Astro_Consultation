import { Router } from 'express';
import { one, many, tx, query } from '../../lib/db.js';
import { parse, z } from '../../lib/validate.js';
import { badRequest, notFound, conflict } from '../../lib/errors.js';
import { authenticate, requireRole, requirePermission as perm, hasPermission, ADMIN_PERMISSIONS } from '../../lib/auth.js';
import { audit } from '../../lib/audit.js';
import { config } from '../../config.js';
import { notify } from '../notifications/service.js';
import { signedUrl } from '../files/storage.js';
import { loadConsultation, cancelBeforeStart, presentConsultation, presentMessage } from '../consultations/service.js';
import { refundCaptured } from '../payments/service.js';
import { rupees } from '../../lib/money.js';
import { REPORTS, toCsv } from './reports.js';

const r = Router();
r.use(authenticate, requireRole('admin'));

const actorOf = (req) => ({ ...req.user, ip: req.ip });
const page = (q) => ({ limit: Math.min(Number(q.limit) || 50, 200), offset: Number(q.offset) || 0 });

// ───────────── Dashboard ─────────────
r.get('/dashboard', perm('dashboard.view'), async (_req, res) => {
  const kpis = await one(`SELECT
    (SELECT count(*) FROM bookings WHERE created_at > now() - interval '24 hours' AND status <> 'pending_payment')::int AS bookings_24h,
    (SELECT count(*) FROM consultations WHERE status = 'in_progress')::int AS live_consultations,
    (SELECT count(*) FROM consultations WHERE status = 'requested')::int AS awaiting_acceptance,
    (SELECT COALESCE(sum(captured_paise - refunded_paise),0) FROM payment_transactions WHERE updated_at > now() - interval '30 days')::bigint AS net_revenue_30d,
    (SELECT COALESCE(sum(platform_fee_paise),0) FROM commission_ledger WHERE created_at > now() - interval '30 days' AND status <> 'reversed')::bigint AS platform_fees_30d,
    (SELECT count(*) FROM user_accounts WHERE role = 'customer' AND status = 'active')::int AS active_customers,
    (SELECT count(*) FROM user_accounts WHERE role = 'customer' AND created_at > now() - interval '7 days')::int AS new_customers_7d,
    (SELECT count(*) FROM astrologer_profiles WHERE verification_status = 'approved')::int AS approved_astrologers,
    (SELECT count(*) FROM astrologer_profiles WHERE is_online AND verification_status = 'approved')::int AS online_astrologers,
    (SELECT count(*) FROM astrologer_profiles WHERE verification_status = 'submitted')::int AS pending_verifications,
    (SELECT count(*) FROM support_tickets WHERE status IN ('open','assigned','escalated'))::int AS open_tickets`);
  const alerts = [];
  const a = await one(`SELECT
    (SELECT count(*) FROM payment_transactions WHERE status = 'failed' AND updated_at > now() - interval '24 hours')::int AS failed_payments,
    (SELECT count(*) FROM support_tickets WHERE status IN ('open','assigned','escalated') AND sla_due_at < now())::int AS sla_breached,
    (SELECT count(*) FROM payment_webhook_events WHERE processed_at IS NULL AND received_at < now() - interval '5 minutes')::int AS stuck_webhooks,
    (SELECT count(*) FROM consultations WHERE status = 'expired' AND updated_at > now() - interval '24 hours')::int AS expired_requests,
    (SELECT count(*) FROM payouts WHERE status = 'failed')::int AS failed_payouts`);
  if (a.failed_payments) alerts.push({ level: 'warning', text: `${a.failed_payments} failed payment(s) in the last 24h` });
  if (a.sla_breached) alerts.push({ level: 'critical', text: `${a.sla_breached} support ticket(s) past SLA` });
  if (a.stuck_webhooks) alerts.push({ level: 'critical', text: `${a.stuck_webhooks} payment webhooks not processed` });
  if (a.expired_requests) alerts.push({ level: 'info', text: `${a.expired_requests} consultation requests expired without response (24h)` });
  if (a.failed_payouts) alerts.push({ level: 'warning', text: `${a.failed_payouts} payouts failed` });
  if (kpis.pending_verifications) alerts.push({ level: 'info', text: `${kpis.pending_verifications} astrologer(s) awaiting verification` });
  const trend = await many(`SELECT to_char(d, 'YYYY-MM-DD') AS day,
      (SELECT count(*) FROM bookings b WHERE b.created_at::date = d AND b.status <> 'pending_payment')::int AS bookings,
      (SELECT COALESCE(sum(final_amount_paise),0) FROM consultations c WHERE c.ended_at::date = d AND c.status = 'completed')::bigint AS gross
    FROM generate_series(current_date - 13, current_date, interval '1 day') d ORDER BY d`);
  res.json({ kpis, alerts, trend });
});

// ───────────── Customers ─────────────
r.get('/customers', perm('customers.view'), async (req, res) => {
  const { limit, offset } = page(req.query);
  const q = req.query.q ? `%${req.query.q}%` : null;
  res.json(await many(
    `SELECT u.user_id, u.phone, u.email, u.status, u.created_at, u.last_login_at, cp.full_name,
       (SELECT count(*) FROM bookings b WHERE b.client_id = cp.client_id AND b.status IN ('confirmed','completed'))::int AS bookings
     FROM user_accounts u JOIN client_profiles cp USING (user_id)
     WHERE ($1::text IS NULL OR cp.full_name ILIKE $1 OR u.phone ILIKE $1 OR u.email ILIKE $1)
     ORDER BY u.created_at DESC LIMIT $2 OFFSET $3`, [q, limit, offset],
  ));
});

r.get('/customers/:userId', perm('customers.view'), async (req, res) => {
  const u = await one(`SELECT u.*, cp.* FROM user_accounts u JOIN client_profiles cp USING (user_id) WHERE u.user_id = $1`, [req.params.userId]);
  if (!u) throw notFound('Customer');
  const [bookings, tickets, consents, birthProfiles] = await Promise.all([
    many(`SELECT b.booking_id, b.status, b.mode, b.quoted_amount_paise, b.created_at, a.display_name AS astrologer_name, c.status AS consultation_status
          FROM bookings b JOIN astrologer_profiles a USING (astrologer_id) LEFT JOIN consultations c USING (booking_id)
          WHERE b.client_id = $1 ORDER BY b.created_at DESC LIMIT 50`, [u.client_id]),
    many('SELECT ticket_id, ticket_number, category, subject, status, created_at FROM support_tickets WHERE requester_user_id = $1 ORDER BY created_at DESC', [u.user_id]),
    many('SELECT notice_type, notice_version, context, accepted_at FROM consent_records WHERE user_id = $1 ORDER BY accepted_at DESC', [u.user_id]),
    one('SELECT count(*)::int AS n FROM birth_profiles WHERE client_id = $1 AND archived_at IS NULL', [u.client_id]),
  ]);
  await audit(null, { actor: actorOf(req), action: 'admin.customer.view', targetType: 'user', targetId: u.user_id, ip: req.ip });
  res.json({
    userId: u.user_id, phone: u.phone, email: u.email, status: u.status, createdAt: u.created_at, lastLoginAt: u.last_login_at,
    fullName: u.full_name, gender: u.gender, preferredLanguage: u.preferred_language,
    birthProfileCount: birthProfiles.n, // birth details are deliberately not exposed in the admin console
    bookings, tickets, consents,
  });
});

r.post('/customers/:userId/status', perm('customers.manage'), async (req, res) => {
  const b = parse(z.object({ status: z.enum(['active', 'suspended']), reason: z.string().trim().min(3).max(300) }), req.body);
  await tx(async (t) => {
    const u = await t.one(`UPDATE user_accounts SET status = $2, updated_at = now() WHERE user_id = $1 AND role = 'customer' RETURNING user_id`, [req.params.userId, b.status]);
    if (!u) throw notFound('Customer');
    if (b.status === 'suspended') await t.query('UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [u.user_id]);
    await audit(t, { actor: req.user, action: `admin.customer.${b.status}`, targetType: 'user', targetId: u.user_id, context: { reason: b.reason }, ip: req.ip });
  });
  res.json({ ok: true });
});

// ───────────── Astrologers ─────────────
r.get('/astrologers', perm('astrologers.view'), async (req, res) => {
  const status = req.query.status || null;
  res.json(await many(
    `SELECT a.astrologer_id, a.user_id, a.display_name, a.verification_status, a.is_online, a.rating_avg, a.rating_count, a.chat_rate_paise,
       a.experience_years, a.languages, a.specialties, a.created_at, a.updated_at, u.phone, u.email, u.status AS account_status,
       (SELECT count(*) FROM consultations c WHERE c.astrologer_id = a.astrologer_id AND c.status = 'completed')::int AS completed_consultations
     FROM astrologer_profiles a JOIN user_accounts u USING (user_id)
     WHERE ($1::text IS NULL OR a.verification_status = $1) ORDER BY a.updated_at DESC LIMIT 200`, [status],
  ));
});

r.get('/astrologers/:id', perm('astrologers.view'), async (req, res) => {
  const a = await one(`SELECT a.*, u.phone, u.email, u.status AS account_status FROM astrologer_profiles a JOIN user_accounts u USING (user_id) WHERE astrologer_id = $1`, [req.params.id]);
  if (!a) throw notFound('Astrologer');
  const docs = await many('SELECT * FROM astrologer_documents WHERE astrologer_id = $1 ORDER BY uploaded_at', [a.astrologer_id]);
  const stats = await one(`SELECT count(*) FILTER (WHERE status = 'completed')::int AS completed, count(*) FILTER (WHERE status = 'rejected')::int AS rejected,
      count(*) FILTER (WHERE status = 'expired')::int AS expired FROM consultations WHERE astrologer_id = $1`, [a.astrologer_id]);
  await audit(null, { actor: req.user, action: 'admin.astrologer.view', targetType: 'astrologer', targetId: a.astrologer_id, ip: req.ip });
  res.json({
    ...a,
    payout_details: a.payout_details ? { ...a.payout_details, accountNumber: `••••${String(a.payout_details.accountNumber).slice(-4)}` } : null,
    stats,
    documents: docs.map((d) => ({ documentId: d.document_id, docType: d.doc_type, fileName: d.file_name, mimeType: d.mime_type, sizeBytes: d.size_bytes, status: d.status, uploadedAt: d.uploaded_at, url: signedUrl(d.storage_key, d.mime_type) })),
  });
});

r.post('/astrologers/:id/verification', perm('astrologers.manage'), async (req, res) => {
  const b = parse(z.object({ decision: z.enum(['approve', 'reject', 'suspend', 'reinstate']), notes: z.string().trim().max(1000).optional() }), req.body);
  const out = await tx(async (t) => {
    const a = await t.one('SELECT * FROM astrologer_profiles WHERE astrologer_id = $1 FOR UPDATE', [req.params.id]);
    if (!a) throw notFound('Astrologer');
    const allowed = { approve: ['submitted', 'rejected'], reject: ['submitted'], suspend: ['approved'], reinstate: ['suspended'] }[b.decision];
    if (!allowed.includes(a.verification_status)) throw conflict(`Cannot ${b.decision} an astrologer who is ${a.verification_status}`);
    if (b.decision === 'reject' && !b.notes) throw badRequest('Provide a reason for rejection');
    const to = { approve: 'approved', reject: 'rejected', suspend: 'suspended', reinstate: 'approved' }[b.decision];
    const row = await t.one(
      `UPDATE astrologer_profiles SET verification_status = $2, verification_notes = $3, verified_at = CASE WHEN $2 = 'approved' THEN now() ELSE verified_at END,
         is_online = CASE WHEN $2 = 'approved' THEN is_online ELSE false END, updated_at = now() WHERE astrologer_id = $1 RETURNING *`,
      [a.astrologer_id, to, b.notes || null],
    );
    if (b.decision === 'approve') await t.query(`UPDATE astrologer_documents SET status = 'accepted' WHERE astrologer_id = $1 AND status = 'pending'`, [a.astrologer_id]);
    await audit(t, { actor: req.user, action: `admin.astrologer.${b.decision}`, targetType: 'astrologer', targetId: a.astrologer_id, context: { notes: b.notes }, ip: req.ip });
    const msgs = {
      approve: ['Profile approved', 'Congratulations! Your profile is approved. You can now go online and accept consultations.'],
      reject: ['Verification update', `Your verification needs changes: ${b.notes}`],
      suspend: ['Account suspended', `Your astrologer profile has been suspended. ${b.notes || ''}`],
      reinstate: ['Profile reinstated', 'Your profile is active again.'],
    }[b.decision];
    await notify(t, a.user_id, { type: 'astrologer.verification', title: msgs[0], body: msgs[1], channels: ['in_app', 'push', 'email'] });
    return row;
  });
  res.json({ astrologerId: out.astrologer_id, verificationStatus: out.verification_status });
});

// ───────────── Bookings / consultations ─────────────
r.get('/bookings', perm('bookings.view'), async (req, res) => {
  const { limit, offset } = page(req.query);
  res.json(await many(
    `SELECT b.booking_id, b.status, b.mode, b.booking_type, b.scheduled_at, b.duration_minutes, b.quoted_amount_paise, b.created_at,
       cp.full_name AS client_name, a.display_name AS astrologer_name, c.consultation_id, c.status AS consultation_status, c.final_amount_paise
     FROM bookings b JOIN client_profiles cp USING (client_id) JOIN astrologer_profiles a USING (astrologer_id)
     LEFT JOIN consultations c USING (booking_id)
     WHERE ($1::text IS NULL OR b.status = $1 OR c.status = $1)
       AND ($2::text IS NULL OR b.booking_id::text ILIKE $2 OR cp.full_name ILIKE $2 OR a.display_name ILIKE $2)
     ORDER BY b.created_at DESC LIMIT $3 OFFSET $4`,
    [req.query.status || null, req.query.q ? `%${req.query.q}%` : null, limit, offset],
  ));
});

r.get('/bookings/:id', perm('bookings.view'), async (req, res) => {
  const b = await one(`SELECT b.*, cp.full_name AS client_name, cp.user_id AS client_user_id, a.display_name AS astrologer_name
    FROM bookings b JOIN client_profiles cp USING (client_id) JOIN astrologer_profiles a USING (astrologer_id) WHERE booking_id = $1`, [req.params.id]);
  if (!b) throw notFound('Booking');
  const c = await one('SELECT consultation_id FROM consultations WHERE booking_id = $1', [b.booking_id]);
  const [payments, refunds, ledger, msgCount, tickets] = await Promise.all([
    many('SELECT * FROM payment_transactions WHERE booking_id = $1 ORDER BY created_at', [b.booking_id]),
    many('SELECT r.* FROM refunds r JOIN payment_transactions p USING (transaction_id) WHERE p.booking_id = $1 ORDER BY r.created_at', [b.booking_id]),
    c ? many('SELECT * FROM commission_ledger WHERE consultation_id = $1 ORDER BY created_at', [c.consultation_id]) : [],
    c ? one('SELECT count(*)::int AS n FROM messages WHERE consultation_id = $1', [c.consultation_id]) : { n: 0 },
    many('SELECT ticket_id, ticket_number, subject, status FROM support_tickets WHERE booking_id = $1', [b.booking_id]),
  ]);
  res.json({
    booking: b, consultation: c ? presentConsultation(await loadConsultation(null, c.consultation_id), 'admin') : null,
    payments, refunds, ledger, messageCount: msgCount.n, tickets,
  });
});

// Message transcripts are private: viewable only for a stated dispute/support purpose, and audited.
r.get('/bookings/:id/messages', perm('bookings.manage'), async (req, res) => {
  const { purpose } = parse(z.object({ purpose: z.string().trim().min(5).max(200) }), req.query);
  const c = await one('SELECT consultation_id FROM consultations WHERE booking_id = $1', [req.params.id]);
  if (!c) throw notFound('Consultation');
  await audit(null, { actor: req.user, action: 'admin.messages.view', targetType: 'consultation', targetId: c.consultation_id, purpose, ip: req.ip });
  const rows = await many('SELECT * FROM messages WHERE consultation_id = $1 ORDER BY seq', [c.consultation_id]);
  res.json(rows.map(presentMessage));
});

r.post('/bookings/:id/cancel', perm('bookings.manage'), async (req, res) => {
  const { reason } = parse(z.object({ reason: z.string().trim().min(3).max(300) }), req.body);
  await tx(async (t) => {
    const c = await t.one('SELECT consultation_id FROM consultations WHERE booking_id = $1', [req.params.id]);
    if (!c) {
      const b = await t.one(`UPDATE bookings SET status = 'cancelled', cancel_reason = $2, cancelled_by = $3 WHERE booking_id = $1 AND status = 'pending_payment' RETURNING slot_id`, [req.params.id, reason, req.user.userId]);
      if (!b) throw conflict('Booking cannot be cancelled');
      if (b.slot_id) await t.query(`UPDATE availability_slots SET status = 'open' WHERE slot_id = $1`, [b.slot_id]);
    } else {
      const full = await loadConsultation(t, c.consultation_id, true);
      if (!['requested', 'accepted', 'ready'].includes(full.status)) throw conflict(`Cannot cancel a ${full.status} consultation; use a refund instead`);
      await cancelBeforeStart(t, full, { to: 'cancelled', by: 'system', byUserId: req.user.userId, reason: `Cancelled by support: ${reason}` });
    }
    await audit(t, { actor: req.user, action: 'admin.booking.cancel', targetType: 'booking', targetId: req.params.id, context: { reason }, ip: req.ip });
  });
  res.json({ ok: true });
});

// ───────────── Payments, refunds, commission, payouts ─────────────
r.get('/payments', perm('payments.view'), async (req, res) => {
  const { limit, offset } = page(req.query);
  res.json(await many(
    `SELECT p.*, cp.full_name AS client_name, a.display_name AS astrologer_name FROM payment_transactions p
     JOIN bookings b USING (booking_id) JOIN client_profiles cp USING (client_id) JOIN astrologer_profiles a USING (astrologer_id)
     WHERE ($1::text IS NULL OR p.status = $1) ORDER BY p.created_at DESC LIMIT $2 OFFSET $3`, [req.query.status || null, limit, offset],
  ));
});

r.post('/payments/:id/refund', perm('payments.refund'), async (req, res) => {
  const b = parse(z.object({ amountPaise: z.number().int().positive(), reason: z.string().trim().min(3).max(300) }), req.body);
  const refund = await tx(async (t) => {
    const p = await t.one('SELECT * FROM payment_transactions WHERE transaction_id = $1 FOR UPDATE', [req.params.id]);
    if (!p) throw notFound('Payment');
    if (!['captured', 'partially_refunded'].includes(p.status)) throw conflict(`Cannot refund a ${p.status} payment`);
    if (b.amountPaise > p.captured_paise - p.refunded_paise) throw badRequest(`Maximum refundable is ₹${rupees(p.captured_paise - p.refunded_paise)}`);
    const rf = await refundCaptured(t, p, b.amountPaise, { reason: b.reason, initiatedBy: req.user.userId });
    await audit(t, { actor: req.user, action: 'admin.payment.refund', targetType: 'payment', targetId: p.transaction_id, context: { amountPaise: b.amountPaise, reason: b.reason }, ip: req.ip });
    const owner = await t.one('SELECT cp.user_id FROM bookings b JOIN client_profiles cp USING (client_id) WHERE booking_id = $1', [p.booking_id]);
    await notify(t, owner.user_id, { type: 'payment.refund', title: 'Refund processed', body: `₹${rupees(b.amountPaise)} has been refunded to your original payment method.`, data: { bookingId: p.booking_id }, channels: ['in_app', 'push', 'email'] });
    return rf;
  });
  res.status(201).json(refund);
});

r.get('/commission-rules', perm('commission.manage'), async (_req, res) => {
  res.json(await many(`SELECT r.*, a.display_name AS astrologer_name FROM commission_rules r LEFT JOIN astrologer_profiles a USING (astrologer_id)
    ORDER BY (effective_to IS NULL) DESC, scope, effective_from DESC`));
});

r.post('/commission-rules', perm('commission.manage'), async (req, res) => {
  const b = parse(z.object({
    scope: z.enum(['default', 'mode', 'astrologer']), astrologerId: z.string().uuid().optional(), mode: z.enum(['chat', 'voice', 'video']).optional(),
    platformFeeBps: z.number().int().min(0).max(10000), effectiveFrom: z.string().datetime({ offset: true }).optional(), note: z.string().max(200).optional(),
  }), req.body);
  if (b.scope === 'astrologer' && !b.astrologerId) throw badRequest('astrologerId required');
  if (b.scope === 'mode' && !b.mode) throw badRequest('mode required');
  const from = b.effectiveFrom ? new Date(b.effectiveFrom) : new Date();
  const rule = await tx(async (t) => {
    // Close the previous rule for the same scope — rules have effective dates and an audit trail.
    await t.query(
      `UPDATE commission_rules SET effective_to = $4 WHERE effective_to IS NULL AND scope = $1
         AND astrologer_id IS NOT DISTINCT FROM $2 AND mode IS NOT DISTINCT FROM $3`,
      [b.scope, b.astrologerId || null, b.mode || null, from],
    );
    const row = await t.one(
      `INSERT INTO commission_rules (scope, astrologer_id, mode, platform_fee_bps, effective_from, note, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [b.scope, b.astrologerId || null, b.mode || null, b.platformFeeBps, from, b.note || null, req.user.userId],
    );
    await audit(t, { actor: req.user, action: 'admin.commission.set', targetType: 'commission_rule', targetId: row.rule_id, context: b, ip: req.ip });
    return row;
  });
  res.status(201).json(rule);
});

r.get('/ledger', perm('payments.view'), async (req, res) => {
  res.json(await many(
    `SELECT l.*, a.display_name AS astrologer_name FROM commission_ledger l JOIN astrologer_profiles a USING (astrologer_id)
     WHERE ($1::uuid IS NULL OR l.astrologer_id = $1) AND ($2::text IS NULL OR l.status = $2) ORDER BY l.created_at DESC LIMIT 300`,
    [req.query.astrologerId || null, req.query.status || null],
  ));
});

r.get('/payouts', perm('payouts.manage'), async (_req, res) => {
  const [payouts, pending] = await Promise.all([
    many(`SELECT p.*, a.display_name AS astrologer_name FROM payouts p JOIN astrologer_profiles a USING (astrologer_id) ORDER BY p.created_at DESC LIMIT 200`),
    many(`SELECT a.astrologer_id, a.display_name, (a.payout_details IS NOT NULL) AS has_bank_details,
            COALESCE(sum(l.payable_paise) FILTER (WHERE l.status = 'eligible'),0)::int AS eligible_paise,
            COALESCE(sum(l.payable_paise) FILTER (WHERE l.status = 'pending'),0)::int AS on_hold_paise
          FROM astrologer_profiles a JOIN commission_ledger l USING (astrologer_id)
          GROUP BY a.astrologer_id HAVING sum(l.payable_paise) FILTER (WHERE l.status IN ('eligible','pending')) <> 0`),
  ]);
  res.json({ payouts, pending, minPayoutPaise: config.business.minPayoutPaise, holdDays: config.business.payoutHoldDays });
});

r.post('/payouts/batch', perm('payouts.manage'), async (req, res) => {
  const created = await tx(async (t) => {
    const due = await t.many(
      `SELECT l.astrologer_id, sum(l.payable_paise)::int AS amount, count(*)::int AS n FROM commission_ledger l
       JOIN astrologer_profiles a USING (astrologer_id) WHERE l.status = 'eligible' AND a.payout_details IS NOT NULL
       GROUP BY l.astrologer_id HAVING sum(l.payable_paise) >= $1`, [config.business.minPayoutPaise],
    );
    const out = [];
    for (const d of due) {
      const p = await t.one(`INSERT INTO payouts (astrologer_id, amount_paise, entry_count, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
        [d.astrologer_id, d.amount, d.n, req.user.userId]);
      await t.query(`UPDATE commission_ledger SET status = 'in_payout', payout_id = $2 WHERE astrologer_id = $1 AND status = 'eligible'`, [d.astrologer_id, p.payout_id]);
      out.push(p);
    }
    await audit(t, { actor: req.user, action: 'admin.payout.batch', targetType: 'payout_batch', context: { count: out.length, total: out.reduce((s, p) => s + p.amount_paise, 0) }, ip: req.ip });
    return out;
  });
  res.status(201).json(created);
});

r.post('/payouts/:id/mark', perm('payouts.manage'), async (req, res) => {
  const b = parse(z.object({ status: z.enum(['paid', 'failed']), reference: z.string().max(100).optional(), reason: z.string().max(300).optional() }), req.body);
  if (b.status === 'paid' && !b.reference) throw badRequest('Bank/UTR reference required');
  await tx(async (t) => {
    const p = await t.one(`SELECT p.*, a.user_id FROM payouts p JOIN astrologer_profiles a USING (astrologer_id) WHERE payout_id = $1 FOR UPDATE OF p`, [req.params.id]);
    if (!p || p.status !== 'processing') throw conflict('Payout is not processing');
    await t.query(`UPDATE payouts SET status = $2, reference = $3, failure_reason = $4, processed_at = now() WHERE payout_id = $1`, [p.payout_id, b.status, b.reference || null, b.reason || null]);
    if (b.status === 'paid') await t.query(`UPDATE commission_ledger SET status = 'paid' WHERE payout_id = $1`, [p.payout_id]);
    else await t.query(`UPDATE commission_ledger SET status = 'eligible', payout_id = NULL WHERE payout_id = $1`, [p.payout_id]);
    await audit(t, { actor: req.user, action: `admin.payout.${b.status}`, targetType: 'payout', targetId: p.payout_id, context: b, ip: req.ip });
    await notify(t, p.user_id, {
      type: `payout.${b.status}`, title: b.status === 'paid' ? 'Payout sent' : 'Payout failed',
      body: b.status === 'paid' ? `₹${rupees(p.amount_paise)} has been paid to your bank account (ref ${b.reference}).` : `Your payout of ₹${rupees(p.amount_paise)} failed: ${b.reason || 'please verify bank details'}.`,
      channels: ['in_app', 'push', 'email'],
    });
  });
  res.json({ ok: true });
});

// ───────────── Content: announcements, FAQs, policies ─────────────
r.get('/announcements', perm('content.view'), async (_req, res) => {
  res.json(await many(`SELECT a.*, (SELECT count(*) FROM notifications n WHERE n.announcement_id = a.announcement_id)::int AS delivered,
      (SELECT count(*) FROM notifications n WHERE n.announcement_id = a.announcement_id AND n.read_at IS NOT NULL)::int AS read
    FROM announcements a ORDER BY a.created_at DESC`));
});

const announcementSchema = z.object({
  kind: z.enum(['announcement', 'banner', 'policy_update']).default('announcement'),
  title: z.string().trim().min(3).max(120), body: z.string().trim().min(3).max(2000),
  audience: z.enum(['customers', 'astrologers', 'all']), expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
});

r.post('/announcements', perm('content.manage'), async (req, res) => {
  const b = parse(announcementSchema, req.body);
  res.status(201).json(await one(
    `INSERT INTO announcements (kind, title, body, audience, expires_at, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [b.kind, b.title, b.body, b.audience, b.expiresAt || null, req.user.userId],
  ));
});

async function publishAnnouncement(t, a, actor) {
  await t.query(`UPDATE announcements SET status = 'published', published_at = now() WHERE announcement_id = $1`, [a.announcement_id]);
  const roles = a.audience === 'all' ? ['customer', 'astrologer'] : [a.audience === 'customers' ? 'customer' : 'astrologer'];
  const users = await t.many(`SELECT user_id FROM user_accounts WHERE role = ANY($1) AND status = 'active'`, [roles]);
  for (const u of users) {
    await notify(t, u.user_id, { type: `announcement.${a.kind}`, title: a.title, body: a.body.slice(0, 280), announcementId: a.announcement_id, data: { announcementId: a.announcement_id } });
  }
  await audit(t, { actor, action: 'admin.announcement.publish', targetType: 'announcement', targetId: a.announcement_id, context: { recipients: users.length } });
  return users.length;
}

r.post('/announcements/:id/publish', perm('content.manage'), async (req, res) => {
  const n = await tx(async (t) => {
    const a = await t.one(`SELECT * FROM announcements WHERE announcement_id = $1 AND status = 'draft' FOR UPDATE`, [req.params.id]);
    if (!a) throw conflict('Only draft announcements can be published');
    return publishAnnouncement(t, a, req.user);
  });
  res.json({ ok: true, recipients: n });
});

r.post('/announcements/:id/archive', perm('content.manage'), async (req, res) => {
  await query(`UPDATE announcements SET status = 'archived' WHERE announcement_id = $1`, [req.params.id]);
  res.json({ ok: true });
});

r.get('/faqs', perm('content.view'), async (_req, res) => res.json(await many('SELECT * FROM faqs ORDER BY audience, sort_order')));

const faqSchema = z.object({
  question: z.string().trim().min(5).max(300), answer: z.string().trim().min(5).max(3000),
  keywords: z.array(z.string().trim().min(2).max(30)).max(20).default([]), audience: z.enum(['customers', 'astrologers', 'all']).default('all'),
  link: z.string().max(200).nullable().optional(), sortOrder: z.number().int().default(0), published: z.boolean().default(true),
});

r.post('/faqs', perm('content.manage'), async (req, res) => {
  const b = parse(faqSchema, req.body);
  res.status(201).json(await one(
    `INSERT INTO faqs (question, answer, keywords, audience, link, sort_order, published) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [b.question, b.answer, b.keywords, b.audience, b.link || null, b.sortOrder, b.published],
  ));
});

r.put('/faqs/:id', perm('content.manage'), async (req, res) => {
  const b = parse(faqSchema, req.body);
  const row = await one(
    `UPDATE faqs SET question=$2, answer=$3, keywords=$4, audience=$5, link=$6, sort_order=$7, published=$8, updated_at=now() WHERE faq_id=$1 RETURNING *`,
    [req.params.id, b.question, b.answer, b.keywords, b.audience, b.link || null, b.sortOrder, b.published],
  );
  if (!row) throw notFound('FAQ');
  res.json(row);
});

r.delete('/faqs/:id', perm('content.manage'), async (req, res) => {
  await query('DELETE FROM faqs WHERE faq_id = $1', [req.params.id]);
  res.json({ ok: true });
});

r.get('/policies', perm('content.view'), async (_req, res) => {
  res.json(await many(`SELECT p.*, (SELECT count(*) FROM consent_records c WHERE c.notice_type = p.notice_type AND c.notice_version = p.version)::int AS acceptances
    FROM policy_documents p ORDER BY notice_type, version DESC`));
});

r.post('/policies', perm('content.manage'), async (req, res) => {
  const b = parse(z.object({
    noticeType: z.enum(['terms', 'privacy', 'astrology_disclaimer', 'cancellation_policy', 'astrologer_agreement', 'ai_disclaimer']),
    title: z.string().trim().min(3).max(150), body: z.string().trim().min(20).max(20000),
    audience: z.enum(['customers', 'astrologers', 'all']).default('all'),
    config: z.record(z.any()).default({}), announce: z.boolean().default(true),
  }), req.body);
  const out = await tx(async (t) => {
    const prev = await t.one('SELECT max(version) AS v FROM policy_documents WHERE notice_type = $1', [b.noticeType]);
    await t.query('UPDATE policy_documents SET is_current = false WHERE notice_type = $1', [b.noticeType]);
    const p = await t.one(
      `INSERT INTO policy_documents (notice_type, version, title, body, audience, config, is_current, created_by) VALUES ($1,$2,$3,$4,$5,$6,true,$7) RETURNING *`,
      [b.noticeType, (prev?.v || 0) + 1, b.title, b.body, b.audience, b.config, req.user.userId],
    );
    await audit(t, { actor: req.user, action: 'admin.policy.publish', targetType: 'policy', targetId: `${b.noticeType}:v${p.version}`, ip: req.ip });
    if (b.announce) {
      const a = await t.one(`INSERT INTO announcements (kind, title, body, audience, created_by) VALUES ('policy_update',$1,$2,$3,$4) RETURNING *`,
        [`Updated: ${b.title}`, `We have updated our ${b.title} (version ${p.version}). Please review it in the app.`, b.audience, req.user.userId]);
      await publishAnnouncement(t, a, req.user);
    }
    return p;
  });
  res.status(201).json(out);
});

r.get('/consents', perm('customers.view'), async (req, res) => {
  res.json(await many(
    `SELECT c.*, u.role, COALESCE(u.email, u.phone) AS identifier FROM consent_records c JOIN user_accounts u USING (user_id)
     WHERE ($1::uuid IS NULL OR c.user_id = $1) AND ($2::text IS NULL OR c.notice_type = $2) ORDER BY accepted_at DESC LIMIT 300`,
    [req.query.userId || null, req.query.noticeType || null],
  ));
});

// ───────────── Support ─────────────
r.get('/tickets', perm('support.manage'), async (req, res) => {
  res.json(await many(
    `SELECT t.*, u.role AS requester_role, COALESCE(u.display_name, u.email, u.phone) AS requester, s.display_name AS assignee_name,
       (t.sla_due_at < now() AND t.status IN ('open','assigned','escalated')) AS sla_breached
     FROM support_tickets t JOIN user_accounts u ON u.user_id = t.requester_user_id LEFT JOIN user_accounts s ON s.user_id = t.assignee_user_id
     WHERE ($1::text IS NULL OR t.status = $1) ORDER BY (t.status IN ('resolved','closed')), t.sla_due_at LIMIT 300`, [req.query.status || null],
  ));
});

r.get('/tickets/:id', perm('support.manage'), async (req, res) => {
  const t = await one(`SELECT t.*, COALESCE(u.display_name, u.email, u.phone) AS requester, u.role AS requester_role
    FROM support_tickets t JOIN user_accounts u ON u.user_id = t.requester_user_id WHERE ticket_id = $1`, [req.params.id]);
  if (!t) throw notFound('Ticket');
  const messages = await many(`SELECT m.*, u.display_name AS author_name FROM ticket_messages m LEFT JOIN user_accounts u ON u.user_id = m.author_user_id
    WHERE ticket_id = $1 ORDER BY created_at`, [t.ticket_id]);
  res.json({ ...t, messages });
});

r.post('/tickets/:id', perm('support.manage'), async (req, res) => {
  const b = parse(z.object({
    status: z.enum(['open', 'assigned', 'escalated', 'resolved', 'closed']).optional(),
    assignToMe: z.boolean().optional(), priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    resolution: z.string().trim().max(2000).optional(),
  }), req.body);
  if (['resolved', 'closed'].includes(b.status) && !b.resolution) throw badRequest('Add a resolution note');
  const t = await tx(async (t) => {
    const row = await t.one(
      `UPDATE support_tickets SET status = COALESCE($2, status), priority = COALESCE($3, priority), resolution = COALESCE($4, resolution),
         assignee_user_id = CASE WHEN $5::boolean THEN $6::uuid ELSE assignee_user_id END, updated_at = now() WHERE ticket_id = $1 RETURNING *`,
      [req.params.id, b.assignToMe && !b.status ? 'assigned' : b.status || null, b.priority || null, b.resolution || null, Boolean(b.assignToMe), req.user.userId],
    );
    if (!row) throw notFound('Ticket');
    await audit(t, { actor: req.user, action: 'admin.ticket.update', targetType: 'ticket', targetId: row.ticket_id, context: b, ip: req.ip });
    if (b.status === 'resolved') {
      await notify(t, row.requester_user_id, { type: 'support.resolved', title: `Ticket #${row.ticket_number} resolved`, body: b.resolution.slice(0, 200), data: { ticketId: row.ticket_id } });
    }
    return row;
  });
  res.json(t);
});

r.post('/tickets/:id/messages', perm('support.manage'), async (req, res) => {
  const b = parse(z.object({ body: z.string().trim().min(1).max(4000), internal: z.boolean().default(false) }), req.body);
  const m = await tx(async (t) => {
    const tk = await t.one('SELECT * FROM support_tickets WHERE ticket_id = $1', [req.params.id]);
    if (!tk) throw notFound('Ticket');
    const row = await t.one(`INSERT INTO ticket_messages (ticket_id, author_user_id, author_kind, body, internal) VALUES ($1,$2,'staff',$3,$4) RETURNING *`,
      [tk.ticket_id, req.user.userId, b.body, b.internal]);
    await t.query('UPDATE support_tickets SET updated_at = now() WHERE ticket_id = $1', [tk.ticket_id]);
    if (!b.internal) await notify(t, tk.requester_user_id, { type: 'support.reply', title: `Support replied on #${tk.ticket_number}`, body: b.body.slice(0, 200), data: { ticketId: tk.ticket_id } });
    return row;
  });
  res.status(201).json(m);
});

// ───────────── Reviews moderation ─────────────
r.get('/reviews', perm('reviews.moderate'), async (_req, res) => {
  res.json(await many(`SELECT r.*, cp.full_name AS client_name, a.display_name AS astrologer_name FROM reviews r
    JOIN client_profiles cp USING (client_id) JOIN astrologer_profiles a USING (astrologer_id) ORDER BY r.created_at DESC LIMIT 300`));
});

r.post('/reviews/:id/status', perm('reviews.moderate'), async (req, res) => {
  const b = parse(z.object({ status: z.enum(['published', 'hidden']), reason: z.string().max(300).optional() }), req.body);
  await tx(async (t) => {
    const row = await t.one('UPDATE reviews SET status = $2 WHERE review_id = $1 RETURNING astrologer_id', [req.params.id, b.status]);
    if (!row) throw notFound('Review');
    await t.query(`UPDATE astrologer_profiles a SET rating_avg = s.avg, rating_count = s.n FROM
      (SELECT COALESCE(avg(rating),0) AS avg, count(*)::int AS n FROM reviews WHERE astrologer_id = $1 AND status = 'published') s WHERE a.astrologer_id = $1`, [row.astrologer_id]);
    await audit(t, { actor: req.user, action: `admin.review.${b.status}`, targetType: 'review', targetId: req.params.id, context: { reason: b.reason }, ip: req.ip });
  });
  res.json({ ok: true });
});

// ───────────── Reports ─────────────
r.get('/reports', perm('reports.view'), (_req, res) => {
  res.json(Object.entries(REPORTS).map(([key, rep]) => ({ key, title: rep.title, description: rep.description })));
});

r.get('/reports/:type', perm('reports.view'), async (req, res) => {
  const rep = REPORTS[req.params.type];
  if (!rep) throw notFound('Report');
  const q = parse(z.object({
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10)),
    to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).default(new Date().toISOString().slice(0, 10)),
    format: z.enum(['json', 'csv']).default('json'),
  }), req.query);
  const rows = await many(rep.sql, [q.from, q.to]);
  if (q.format === 'csv') {
    if (!hasPermission(req.user, 'reports.export')) throw badRequest('You do not have export permission');
    await audit(null, { actor: req.user, action: 'admin.report.export', targetType: 'report', targetId: req.params.type, context: q, ip: req.ip });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${req.params.type}_${q.from}_${q.to}.csv"`);
    return res.send(toCsv(rows));
  }
  res.json({ title: rep.title, from: q.from, to: q.to, rows });
});

// ───────────── Admin users & audit ─────────────
r.get('/admins', perm('admins.manage'), async (_req, res) => {
  res.json({ admins: await many(`SELECT user_id, email, phone, display_name, admin_role, status, last_login_at, created_at FROM user_accounts WHERE role = 'admin' ORDER BY created_at`), roles: ADMIN_PERMISSIONS });
});

r.post('/admins', perm('admins.manage'), async (req, res) => {
  const b = parse(z.object({ email: z.string().email(), displayName: z.string().trim().min(2).max(80), adminRole: z.enum(['super_admin', 'support', 'finance', 'content']) }), req.body);
  const u = await tx(async (t) => {
    const exists = await t.one('SELECT 1 FROM user_accounts WHERE email = $1', [b.email.toLowerCase()]);
    if (exists) throw conflict('An account with this email already exists');
    const row = await t.one(`INSERT INTO user_accounts (role, admin_role, email, display_name) VALUES ('admin',$1,$2,$3) RETURNING user_id, email, admin_role`,
      [b.adminRole, b.email.toLowerCase(), b.displayName]);
    await audit(t, { actor: req.user, action: 'admin.user.create', targetType: 'user', targetId: row.user_id, context: { adminRole: b.adminRole }, ip: req.ip });
    return row;
  });
  res.status(201).json(u);
});

r.put('/admins/:id', perm('admins.manage'), async (req, res) => {
  const b = parse(z.object({ adminRole: z.enum(['super_admin', 'support', 'finance', 'content']).optional(), status: z.enum(['active', 'suspended']).optional() }), req.body);
  if (req.params.id === req.user.userId) throw badRequest('You cannot change your own role or status');
  await tx(async (t) => {
    const row = await t.one(`UPDATE user_accounts SET admin_role = COALESCE($2, admin_role), status = COALESCE($3, status), updated_at = now()
      WHERE user_id = $1 AND role = 'admin' RETURNING user_id`, [req.params.id, b.adminRole || null, b.status || null]);
    if (!row) throw notFound('Admin');
    if (b.status === 'suspended') await t.query('UPDATE auth_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL', [row.user_id]);
    await audit(t, { actor: req.user, action: 'admin.permission.change', targetType: 'user', targetId: row.user_id, context: b, ip: req.ip });
  });
  res.json({ ok: true });
});

r.get('/audit', perm('audit.view'), async (req, res) => {
  const { limit, offset } = page(req.query);
  res.json(await many(
    `SELECT e.*, COALESCE(u.display_name, u.email, u.phone) AS actor_name FROM audit_events e LEFT JOIN user_accounts u ON u.user_id = e.actor_user_id
     WHERE ($1::text IS NULL OR e.action ILIKE $1) AND ($2::text IS NULL OR e.target_id = $2) AND ($3::text IS NULL OR e.outcome = $3)
     ORDER BY e.created_at DESC LIMIT $4 OFFSET $5`,
    [req.query.action ? `%${req.query.action}%` : null, req.query.targetId || null, req.query.outcome || null, limit, offset],
  ));
});

export default r;
