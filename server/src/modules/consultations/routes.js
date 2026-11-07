import { Router } from 'express';
import { one, many, tx } from '../../lib/db.js';
import { parse, z } from '../../lib/validate.js';
import { conflict, forbidden, notFound } from '../../lib/errors.js';
import { authenticate, requireRole, hasPermission } from '../../lib/auth.js';
import { audit } from '../../lib/audit.js';
import { publishToRoom } from '../../realtime/hub.js';
import { rateLimit } from '../../lib/rateLimit.js';
import {
  loadConsultation, participantRole, presentConsultation, presentMessage, accept, start, complete, cancelBeforeStart,
} from './service.js';
import { latestChart, generateChart, presentChart } from '../charts/service.js';
import { presentBirth } from '../clients/routes.js';

const r = Router();
r.use(authenticate);

/** Statuses in which the assigned astrologer may access the client's chart and profile. */
const CHART_ACCESS_STATUSES = ['accepted', 'ready', 'in_progress'];
const POST_SESSION_ACCESS_MIN = 60; // wrap-up window for notes after completion

r.get('/', async (req, res) => {
  const { status } = parse(z.object({ status: z.string().optional() }), req.query);
  const statuses = status ? status.split(',') : null;
  let rows;
  if (req.user.role === 'astrologer') {
    rows = await many(
      `SELECT c.consultation_id FROM consultations c JOIN astrologer_profiles a USING (astrologer_id)
       WHERE a.user_id = $1 AND ($2::text[] IS NULL OR c.status = ANY($2)) ORDER BY c.created_at DESC LIMIT 100`,
      [req.user.userId, statuses],
    );
  } else if (req.user.role === 'customer') {
    rows = await many(
      `SELECT c.consultation_id FROM consultations c JOIN client_profiles p USING (client_id)
       WHERE p.user_id = $1 AND ($2::text[] IS NULL OR c.status = ANY($2)) ORDER BY c.created_at DESC LIMIT 100`,
      [req.user.userId, statuses],
    );
  } else throw forbidden();
  const out = [];
  for (const row of rows) {
    const c = await loadConsultation(null, row.consultation_id);
    const unread = await one(
      `SELECT count(*)::int AS n FROM messages WHERE consultation_id = $1 AND read_at IS NULL
       AND (sender_user_id IS NULL OR sender_user_id <> $2) AND kind = 'text'`, [c.consultation_id, req.user.userId],
    );
    out.push({ ...presentConsultation(c, req.user.role), unreadCount: unread.n });
  }
  res.json(out);
});

async function forParticipant(req, lock = false, t = null) {
  const c = await loadConsultation(t, req.params.id, lock);
  if (req.user.role === 'admin' && hasPermission(req.user, 'bookings.view')) return { c, role: 'admin' };
  return { c, role: participantRole(c, req.user) };
}

r.get('/:id', async (req, res) => {
  const { c, role } = await forParticipant(req);
  res.json(presentConsultation(c, role));
});

r.post('/:id/accept', requireRole('astrologer'), async (req, res) => {
  const out = await tx(async (t) => {
    const { c } = await forParticipant(req, true, t);
    if (c.accept_deadline && new Date(c.accept_deadline) < new Date()) throw conflict('This request has expired');
    return accept(t, c);
  });
  res.json(presentConsultation(out, 'astrologer'));
});

r.post('/:id/reject', requireRole('astrologer'), async (req, res) => {
  const { reason } = parse(z.object({ reason: z.string().trim().max(300).default('The astrologer is unavailable') }), req.body || {});
  const out = await tx(async (t) => {
    const { c } = await forParticipant(req, true, t);
    if (c.status === 'requested') return cancelBeforeStart(t, c, { to: 'rejected', by: 'astrologer', byUserId: req.user.userId, reason });
    if (['accepted', 'ready'].includes(c.status)) {
      return cancelBeforeStart(t, c, { to: 'cancelled', by: 'astrologer', byUserId: req.user.userId, reason });
    }
    throw conflict(`Cannot decline a ${c.status} consultation`);
  });
  res.json(presentConsultation(out.consultation, 'astrologer'));
});

r.post('/:id/start', requireRole('astrologer'), async (req, res) => {
  const out = await tx(async (t) => {
    const { c } = await forParticipant(req, true, t);
    const busy = await t.one(`SELECT 1 FROM consultations WHERE astrologer_id = $1 AND status = 'in_progress' AND consultation_id <> $2`,
      [c.astrologer_id, c.consultation_id]);
    if (busy) throw conflict('Finish your current consultation first');
    return start(t, c);
  });
  res.json(presentConsultation(out, 'astrologer'));
});

r.post('/:id/end', async (req, res) => {
  const out = await tx(async (t) => {
    const { c, role } = await forParticipant(req, true, t);
    if (role === 'admin') throw forbidden();
    if (c.status !== 'in_progress') throw conflict('Consultation is not in progress');
    return complete(t, c, { endedBy: role, reason: `ended by ${role}` });
  });
  res.json(presentConsultation(out, req.user.role));
});

// ───────────── Messages (REST fallback; WebSocket is primary) ─────────────
r.get('/:id/messages', async (req, res) => {
  const { c } = await forParticipant(req);
  const after = Number(req.query.afterSeq || 0);
  const rows = await many('SELECT * FROM messages WHERE consultation_id = $1 AND seq > $2 ORDER BY seq LIMIT 500', [c.consultation_id, after]);
  res.json(rows.map(presentMessage));
});

export async function postMessage(c, user, { content, clientMsgId }) {
  if (c.status !== 'in_progress') throw conflict('Messages can be sent only while the consultation is in progress');
  const role = participantRole(c, user);
  const m = await one(
    `INSERT INTO messages (consultation_id, sender_user_id, sender_role, content, client_msg_id) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (consultation_id, sender_user_id, client_msg_id) DO UPDATE SET client_msg_id = EXCLUDED.client_msg_id
     RETURNING *`,
    [c.consultation_id, user.userId, role, content, clientMsgId || null],
  );
  const msg = presentMessage(m);
  publishToRoom(c.consultation_id, { type: 'message', message: msg });
  return msg;
}

const messageSchema = z.object({ content: z.string().trim().min(1).max(4000), clientMsgId: z.string().max(64).optional() });
r.post('/:id/messages', rateLimit('msg', 60, 60, (req) => req.user.userId), async (req, res) => {
  const b = parse(messageSchema, req.body);
  const c = await loadConsultation(null, req.params.id);
  res.status(201).json(await postMessage(c, req.user, b));
});

r.post('/:id/read', async (req, res) => {
  const { upToSeq } = parse(z.object({ upToSeq: z.number().int() }), req.body);
  const { c } = await forParticipant(req);
  await markRead(c.consultation_id, req.user.userId, upToSeq);
  res.json({ ok: true });
});

export async function markRead(consultationId, userId, upToSeq) {
  await one(
    `UPDATE messages SET read_at = now(), delivered_at = COALESCE(delivered_at, now())
     WHERE consultation_id = $1 AND seq <= $2 AND read_at IS NULL AND (sender_user_id IS NULL OR sender_user_id <> $3)`,
    [consultationId, upToSeq, userId],
  );
  publishToRoom(consultationId, { type: 'read', consultationId, userId, upToSeq });
}

// ───────────── Client chart & profile for the assigned astrologer (U4/U5) ─────────────
function canAccessClientData(c) {
  if (CHART_ACCESS_STATUSES.includes(c.status)) return true;
  return c.status === 'completed' && c.ended_at && Date.now() - new Date(c.ended_at) < POST_SESSION_ACCESS_MIN * 60000;
}

async function authorizeClientData(req, purpose) {
  const c = await loadConsultation(null, req.params.id);
  let role;
  try {
    role = participantRole(c, req.user);
  } catch (e) {
    await audit(null, { actor: req.user, action: 'chart.access', targetType: 'consultation', targetId: req.params.id, purpose, outcome: 'denied', ip: req.ip });
    throw e;
  }
  if (role === 'astrologer' && !canAccessClientData(c)) {
    await audit(null, { actor: req.user, action: 'chart.access', targetType: 'consultation', targetId: c.consultation_id, purpose, outcome: 'denied', context: { status: c.status }, ip: req.ip });
    throw forbidden('Client details are available only during an accepted consultation');
  }
  return { c, role };
}

r.get('/:id/client-chart', async (req, res) => {
  const { c, role } = await authorizeClientData(req, 'consultation_chart_view');
  const bp = await one('SELECT * FROM birth_profiles WHERE birth_profile_id = $1', [c.birth_profile_id]);
  const chart = await latestChart(null, c.birth_profile_id);
  let availability = 'available';
  if (!chart) availability = 'missing';
  else if (chart.status === 'stale' || chart.birth_profile_version !== bp.version) availability = 'stale';
  await audit(null, {
    actor: req.user, action: 'chart.view', targetType: 'birth_profile', targetId: c.birth_profile_id, purpose: 'consultation',
    context: { consultationId: c.consultation_id, chartId: chart?.chart_id || null, viewerRole: role }, ip: req.ip,
  });
  res.json({
    consultationId: c.consultation_id,
    availability,
    canGenerate: Boolean(bp) && !bp.archived_at,
    birthProfile: presentBirth(bp),
    chart: presentChart(chart),
  });
});

r.post('/:id/client-chart/generate', async (req, res) => {
  const { c } = await authorizeClientData(req, 'consultation_chart_generate');
  const chart = await tx(async (t) => {
    const bp = await t.one('SELECT * FROM birth_profiles WHERE birth_profile_id = $1 FOR UPDATE', [c.birth_profile_id]);
    await audit(t, { actor: req.user, action: 'chart.generate', targetType: 'birth_profile', targetId: bp.birth_profile_id, purpose: 'consultation', context: { consultationId: c.consultation_id } });
    return generateChart(t, bp, req.body?.config);
  });
  res.status(201).json(presentChart(chart));
});

r.get('/:id/client-summary', requireRole('astrologer'), async (req, res) => {
  const { c } = await authorizeClientData(req, 'consultation_client_summary');
  const [profile, history] = await Promise.all([
    one('SELECT full_name, gender, preferred_language FROM client_profiles WHERE client_id = $1', [c.client_id]),
    many(`SELECT consultation_id, status, started_at, billable_seconds FROM consultations
          WHERE client_id = $1 AND astrologer_id = $2 AND status = 'completed' AND consultation_id <> $3 ORDER BY started_at DESC LIMIT 10`,
      [c.client_id, c.astrologer_id, c.consultation_id]),
  ]);
  await audit(null, { actor: req.user, action: 'client_profile.view', targetType: 'client', targetId: c.client_id, purpose: 'consultation', context: { consultationId: c.consultation_id }, ip: req.ip });
  res.json({ name: profile.full_name, gender: profile.gender, preferredLanguage: profile.preferred_language, topic: c.topic, previousConsultationsWithYou: history });
});

// ───────────── Private astrologer notes ─────────────
r.get('/:id/notes', requireRole('astrologer'), async (req, res) => {
  const { c } = await forParticipant(req);
  res.json(await many('SELECT note_id, body, created_at FROM consultation_notes WHERE consultation_id = $1 AND astrologer_id = $2 ORDER BY created_at',
    [c.consultation_id, c.astrologer_id]));
});

r.post('/:id/notes', requireRole('astrologer'), async (req, res) => {
  const { body } = parse(z.object({ body: z.string().trim().min(1).max(4000) }), req.body);
  const { c } = await authorizeClientData(req, 'consultation_notes');
  res.status(201).json(await one(
    'INSERT INTO consultation_notes (consultation_id, astrologer_id, body) VALUES ($1,$2,$3) RETURNING note_id, body, created_at',
    [c.consultation_id, c.astrologer_id, body],
  ));
});

// ───────────── Reviews & receipt (customer) ─────────────
r.post('/:id/review', requireRole('customer'), async (req, res) => {
  const b = parse(z.object({ rating: z.number().int().min(1).max(5), comment: z.string().trim().max(1000).optional() }), req.body);
  const review = await tx(async (t) => {
    const { c } = await forParticipant(req, true, t);
    if (c.status !== 'completed') throw conflict('You can review only completed consultations');
    const exists = await t.one('SELECT 1 FROM reviews WHERE consultation_id = $1', [c.consultation_id]);
    if (exists) throw conflict('You have already reviewed this consultation');
    const row = await t.one(
      'INSERT INTO reviews (consultation_id, client_id, astrologer_id, rating, comment) VALUES ($1,$2,$3,$4,$5) RETURNING *',
      [c.consultation_id, c.client_id, c.astrologer_id, b.rating, b.comment || null],
    );
    await t.query(
      `UPDATE astrologer_profiles a SET rating_avg = s.avg, rating_count = s.n FROM
         (SELECT COALESCE(avg(rating),0) AS avg, count(*)::int AS n FROM reviews WHERE astrologer_id = $1 AND status = 'published') s
       WHERE a.astrologer_id = $1`, [c.astrologer_id],
    );
    return row;
  });
  res.status(201).json(review);
});

r.get('/:id/receipt', async (req, res) => {
  const { c, role } = await forParticipant(req);
  const payments = await many(
    `SELECT p.transaction_id, p.gateway, p.gateway_payment_id, p.amount_paise, p.captured_paise, p.refunded_paise, p.status, p.created_at
     FROM payment_transactions p WHERE booking_id = $1 AND status <> 'created' ORDER BY created_at`, [c.booking_id],
  );
  const refunds = await many(
    `SELECT r.refund_id, r.amount_paise, r.reason, r.created_at FROM refunds r JOIN payment_transactions p USING (transaction_id)
     WHERE p.booking_id = $1`, [c.booking_id],
  );
  res.json({
    receiptNumber: `RCPT-${c.booking_id.slice(0, 8).toUpperCase()}`,
    consultation: presentConsultation(c, role),
    payments, refunds,
    note: 'Taxes and invoice format to be confirmed with finance/tax professionals before launch.',
  });
});

export default r;
