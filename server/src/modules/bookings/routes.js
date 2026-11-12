import { Router } from 'express';
import { one, many, tx } from '../../lib/db.js';
import { parse, z } from '../../lib/validate.js';
import { badRequest, notFound, conflict } from '../../lib/errors.js';
import { authenticate, requireRole, clientIdFor } from '../../lib/auth.js';
import { config } from '../../config.js';
import { assertConsents, currentPolicy, recordConsent } from '../content/service.js';
import { loadConsultation, cancelBeforeStart, presentConsultation } from '../consultations/service.js';
import { isUserOnline } from '../../realtime/hub.js';
import { balanceOf, postEntry, welcomeDiscount } from '../wallet/service.js';
import { confirmBooking } from './service.js';

const r = Router();
r.use(authenticate, requireRole('customer'));
r.use(async (req, _res, next) => { req.clientId = await clientIdFor(req.user.userId); next(); });

const rateFor = (a, mode) => ({ chat: a.chat_rate_paise, voice: a.voice_rate_paise, video: a.video_rate_paise }[mode]);

// Consultation modes enabled for this release (DPR: decide modes early; MVP = one agreed mode).
export const ENABLED_MODES = (process.env.ENABLED_MODES || 'chat').split(',');

async function quote(astrologerId, mode, durationMinutes) {
  const a = await one(
    `SELECT a.*, u.status AS user_status FROM astrologer_profiles a JOIN user_accounts u USING (user_id) WHERE astrologer_id = $1`,
    [astrologerId],
  );
  if (!a || a.verification_status !== 'approved' || a.user_status !== 'active') throw notFound('Astrologer');
  if (!ENABLED_MODES.includes(mode)) throw badRequest(`${mode} consultations are not available yet`);
  if (!a.modes.includes(mode)) throw badRequest(`This astrologer does not offer ${mode} consultations`);
  const rate = rateFor(a, mode);
  if (!rate) throw badRequest('Rate not configured for this mode');
  const policy = await currentPolicy(null, 'cancellation_policy');
  return { astrologer: a, ratePaise: rate, amountPaise: rate * durationMinutes, policy };
}

r.get('/quote', async (req, res) => {
  const q = parse(z.object({
    astrologerId: z.string().uuid(), mode: z.enum(['chat', 'voice', 'video']).default('chat'),
    durationMinutes: z.coerce.number().int().min(5).max(120),
    paymentMethod: z.enum(['gateway', 'wallet']).default('gateway'),
  }), req.query);
  const { ratePaise, amountPaise, policy } = await quote(q.astrologerId, q.mode, q.durationMinutes);
  const gift = q.paymentMethod === 'wallet' ? await welcomeDiscount(null, req.clientId, ratePaise, q.durationMinutes) : { discountPaise: 0, label: null };
  res.json({
    ratePaise, durationMinutes: q.durationMinutes, amountPaise, currency: config.business.currency,
    discountPaise: gift.discountPaise, discountLabel: gift.label, payablePaise: amountPaise - gift.discountPaise,
    walletBalancePaise: await balanceOf(null, req.user.userId),
    billing: 'Charged per started minute, up to the booked duration. Unused minutes are released after the session.',
    cancellationPolicy: { version: policy.version, title: policy.title, body: policy.body, config: policy.config },
    enabledModes: ENABLED_MODES,
  });
});

const createSchema = z.object({
  astrologerId: z.string().uuid(),
  birthProfileId: z.string().uuid(),
  mode: z.enum(['chat', 'voice', 'video']).default('chat'),
  bookingType: z.enum(['instant', 'scheduled']),
  slotId: z.string().uuid().optional(),
  durationMinutes: z.number().int().min(5).max(120),
  topic: z.string().trim().max(300).optional(),
  acceptedCancellationPolicyVersion: z.number().int(),
  idempotencyKey: z.string().min(8).max(80),
  paymentMethod: z.enum(['gateway', 'wallet']).default('gateway'),
});

r.post('/', async (req, res) => {
  const b = parse(createSchema, req.body);
  await assertConsents(null, req.user.userId, 'customer');
  const existing = await one('SELECT * FROM bookings WHERE client_id = $1 AND idempotency_key = $2', [req.clientId, b.idempotencyKey]);
  if (existing) return res.status(200).json(presentBooking(existing)); // idempotent replay

  const { astrologer, ratePaise, amountPaise, policy } = await quote(b.astrologerId, b.mode, b.durationMinutes);
  if (policy.version !== b.acceptedCancellationPolicyVersion) {
    throw conflict('The cancellation policy has changed. Please review it again.', { code: 'policy_changed', version: policy.version });
  }
  const booking = await tx(async (t) => {
    const bp = await t.one('SELECT birth_profile_id FROM birth_profiles WHERE birth_profile_id = $1 AND client_id = $2 AND archived_at IS NULL',
      [b.birthProfileId, req.clientId]);
    if (!bp) throw badRequest('Choose one of your saved birth profiles');
    let scheduledAt = null;
    if (b.bookingType === 'scheduled') {
      if (!b.slotId) throw badRequest('slotId is required for scheduled bookings');
      const slot = await t.one('SELECT * FROM availability_slots WHERE slot_id = $1 AND astrologer_id = $2 FOR UPDATE', [b.slotId, b.astrologerId]);
      if (!slot || slot.status !== 'open') throw conflict('This slot is no longer available');
      if (new Date(slot.start_at) < new Date(Date.now() + 15 * 60000)) throw conflict('This slot starts too soon to book');
      if (b.durationMinutes > (new Date(slot.end_at) - new Date(slot.start_at)) / 60000) throw badRequest('Duration exceeds the slot length');
      await t.query(`UPDATE availability_slots SET status = 'held', held_until = now() + make_interval(mins => $2) WHERE slot_id = $1`,
        [slot.slot_id, config.payments.paymentWindowMin]);
      scheduledAt = slot.start_at;
    } else {
      if (!astrologer.is_online || !isUserOnline(astrologer.user_id)) throw conflict('This astrologer is offline. Schedule a session instead.');
      const busy = await t.one(`SELECT 1 FROM consultations WHERE astrologer_id = $1 AND status = 'in_progress'`, [b.astrologerId]);
      if (busy) throw conflict('This astrologer is in another consultation. Try again shortly or schedule a session.');
    }
    const wallet = b.paymentMethod === 'wallet';
    const gift = wallet ? await welcomeDiscount(t, req.clientId, ratePaise, b.durationMinutes) : { discountPaise: 0, label: null };
    const row = await t.one(
      `INSERT INTO bookings (client_id, astrologer_id, birth_profile_id, mode, booking_type, slot_id, scheduled_at, duration_minutes,
         rate_paise, quoted_amount_paise, currency, status, policy_version, topic, idempotency_key, payment_expires_at,
         payment_method, discount_paise, discount_label)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'pending_payment',$12,$13,$14, now() + make_interval(mins => $15),$16,$17,$18) RETURNING *`,
      [req.clientId, b.astrologerId, b.birthProfileId, b.mode, b.bookingType, b.slotId || null, scheduledAt, b.durationMinutes,
       ratePaise, amountPaise, config.business.currency, policy.version, b.topic || null, b.idempotencyKey, config.payments.paymentWindowMin,
       b.paymentMethod, gift.discountPaise, gift.label],
    );
    // Store the accepted cancellation policy version with the booking context.
    await recordConsent(t, { userId: req.user.userId, noticeType: 'cancellation_policy', version: policy.version,
      context: `booking:${row.booking_id}`, ip: req.ip, userAgent: req.headers['user-agent'] });
    if (wallet) {
      // Hold the payable amount from the wallet now; unused minutes are released when the session ends.
      await postEntry(t, { userId: req.user.userId, type: 'hold', amountPaise: -(amountPaise - gift.discountPaise), bookingId: row.booking_id,
        description: `Held for consultation (${b.durationMinutes} min)` });
      await confirmBooking(t, row.booking_id, { paidVia: 'wallet' });
      return { ...row, status: 'confirmed' };
    }
    return row;
  });
  res.status(201).json(presentBooking(booking));
});

export function presentBooking(b) {
  return {
    bookingId: b.booking_id, astrologerId: b.astrologer_id, birthProfileId: b.birth_profile_id, mode: b.mode,
    bookingType: b.booking_type, slotId: b.slot_id, scheduledAt: b.scheduled_at, durationMinutes: b.duration_minutes,
    ratePaise: b.rate_paise, quotedAmountPaise: b.quoted_amount_paise, currency: b.currency, status: b.status,
    policyVersion: b.policy_version, topic: b.topic, cancelReason: b.cancel_reason, paymentExpiresAt: b.payment_expires_at,
    paymentMethod: b.payment_method, discountPaise: b.discount_paise, discountLabel: b.discount_label,
    payablePaise: b.quoted_amount_paise - b.discount_paise, createdAt: b.created_at,
  };
}

r.get('/', async (req, res) => {
  const rows = await many(
    `SELECT b.*, a.display_name AS astrologer_name, c.consultation_id, c.status AS consultation_status, c.final_amount_paise,
            c.started_at, c.ended_at, bp.full_name AS birth_profile_name,
            EXISTS (SELECT 1 FROM reviews r WHERE r.consultation_id = c.consultation_id) AS reviewed
     FROM bookings b JOIN astrologer_profiles a USING (astrologer_id)
     JOIN birth_profiles bp ON bp.birth_profile_id = b.birth_profile_id
     LEFT JOIN consultations c USING (booking_id)
     WHERE b.client_id = $1 ORDER BY b.created_at DESC LIMIT 100`, [req.clientId],
  );
  res.json(rows.map((b) => ({
    ...presentBooking(b), astrologerName: b.astrologer_name, birthProfileName: b.birth_profile_name,
    consultation: b.consultation_id ? {
      consultationId: b.consultation_id, status: b.consultation_status, finalAmountPaise: b.final_amount_paise,
      startedAt: b.started_at, endedAt: b.ended_at, reviewed: b.reviewed,
    } : null,
  })));
});

r.get('/:id', async (req, res) => {
  const b = await one(
    `SELECT b.*, a.display_name AS astrologer_name FROM bookings b JOIN astrologer_profiles a USING (astrologer_id)
     WHERE b.booking_id = $1 AND b.client_id = $2`, [req.params.id, req.clientId],
  );
  if (!b) throw notFound('Booking');
  const [c, payments] = await Promise.all([
    one('SELECT consultation_id FROM consultations WHERE booking_id = $1', [b.booking_id]),
    many(`SELECT transaction_id, gateway, amount_paise, captured_paise, refunded_paise, status, created_at FROM payment_transactions
          WHERE booking_id = $1 ORDER BY created_at`, [b.booking_id]),
  ]);
  const consultation = c ? presentConsultation(await loadConsultation(null, c.consultation_id), 'customer') : null;
  res.json({ ...presentBooking(b), astrologerName: b.astrologer_name, consultation, payments });
});

r.post('/:id/cancel', async (req, res) => {
  const { reason } = parse(z.object({ reason: z.string().trim().max(300).default('Cancelled by customer') }), req.body || {});
  const out = await tx(async (t) => {
    const b = await t.one('SELECT * FROM bookings WHERE booking_id = $1 AND client_id = $2 FOR UPDATE', [req.params.id, req.clientId]);
    if (!b) throw notFound('Booking');
    if (b.status === 'pending_payment') {
      await t.query(`UPDATE bookings SET status = 'cancelled', cancel_reason = $2, cancelled_by = $3, updated_at = now() WHERE booking_id = $1`,
        [b.booking_id, reason, req.user.userId]);
      if (b.slot_id) await t.query(`UPDATE availability_slots SET status = 'open', held_until = NULL WHERE slot_id = $1`, [b.slot_id]);
      return { status: 'cancelled', feePaise: 0, refundPct: 100 };
    }
    const cRow = await t.one('SELECT consultation_id FROM consultations WHERE booking_id = $1', [b.booking_id]);
    if (!cRow) throw conflict('Booking cannot be cancelled');
    const c = await loadConsultation(t, cRow.consultation_id, true);
    if (!['requested', 'accepted', 'ready'].includes(c.status)) throw conflict(`A ${c.status.replace('_', ' ')} consultation cannot be cancelled`);
    const policy = await t.one('SELECT config FROM policy_documents WHERE notice_type = $1 AND version = $2', ['cancellation_policy', b.policy_version]);
    const result = await cancelBeforeStart(t, c, { to: 'cancelled', by: 'customer', byUserId: req.user.userId, reason, policyConfig: policy?.config });
    return { status: 'cancelled', feePaise: result.feePaise, refundPct: result.refundPct };
  });
  res.json(out);
});

export default r;
