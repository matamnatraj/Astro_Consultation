import { db } from '../../lib/db.js';
import { conflict, forbidden, notFound } from '../../lib/errors.js';
import { billableSeconds, amountForSeconds, rupees } from '../../lib/money.js';
import { config } from '../../config.js';
import { notify } from '../notifications/service.js';
import { publishToRoom } from '../../realtime/hub.js';
import { paymentForBooking, captureOrVoid, createEarning } from '../payments/service.js';
import { cancellationRefundPct } from '../content/service.js';

/**
 * Consultation state machine (DPR §4):
 * requested → accepted → ready → in_progress → completed
 *           ↘ rejected / expired        ↘ cancelled / failed
 */
export const TRANSITIONS = {
  requested: ['accepted', 'rejected', 'expired', 'cancelled'],
  accepted: ['ready', 'cancelled', 'expired'],
  ready: ['in_progress', 'cancelled', 'expired'],
  in_progress: ['completed', 'failed'],
  completed: [],
  rejected: [],
  cancelled: [],
  expired: [],
  failed: [],
};

export function assertTransition(from, to) {
  if (!TRANSITIONS[from]?.includes(to)) throw conflict(`Cannot move consultation from ${from} to ${to}`);
}

export const ACTIVE_STATUSES = ['accepted', 'ready', 'in_progress'];

export async function loadConsultation(t, id, lock = false) {
  const c = await db(t).one(
    `SELECT c.*, b.mode, b.booking_type, b.scheduled_at, b.rate_paise, b.quoted_amount_paise, b.birth_profile_id, b.policy_version,
            b.duration_minutes, b.topic, b.slot_id, b.status AS booking_status,
            cu.user_id AS client_user_id, au.user_id AS astrologer_user_id,
            cp.full_name AS client_name, ap.display_name AS astrologer_name
     FROM consultations c JOIN bookings b USING (booking_id)
     JOIN client_profiles cp ON cp.client_id = c.client_id JOIN user_accounts cu ON cu.user_id = cp.user_id
     JOIN astrologer_profiles ap ON ap.astrologer_id = c.astrologer_id JOIN user_accounts au ON au.user_id = ap.user_id
     WHERE c.consultation_id = $1 ${lock ? 'FOR UPDATE OF c' : ''}`,
    [id],
  );
  if (!c) throw notFound('Consultation');
  return c;
}

/** Which side of the consultation the user is on, or throw. */
export function participantRole(c, user) {
  if (user.role === 'customer' && c.client_user_id === user.userId) return 'customer';
  if (user.role === 'astrologer' && c.astrologer_user_id === user.userId) return 'astrologer';
  throw forbidden('You are not a participant in this consultation');
}

export function presentConsultation(c, viewerRole) {
  const now = Date.now();
  const elapsed = c.started_at ? Math.floor(((c.ended_at ? new Date(c.ended_at) : now) - new Date(c.started_at)) / 1000) : 0;
  return {
    consultationId: c.consultation_id,
    bookingId: c.booking_id,
    status: c.status,
    mode: c.mode,
    bookingType: c.booking_type,
    scheduledAt: c.scheduled_at,
    topic: c.topic,
    durationMinutes: c.duration_minutes,
    ratePaise: c.rate_paise,
    quotedAmountPaise: c.quoted_amount_paise,
    acceptDeadline: c.accept_deadline,
    acceptedAt: c.accepted_at,
    readyAt: c.ready_at,
    startedAt: c.started_at,
    endedAt: c.ended_at,
    endReason: c.end_reason,
    elapsedSeconds: elapsed,
    maxBillableSeconds: c.max_billable_seconds,
    billableSeconds: c.billable_seconds,
    finalAmountPaise: c.final_amount_paise,
    client: { clientId: c.client_id, name: c.client_name },
    astrologer: { astrologerId: c.astrologer_id, name: c.astrologer_name },
    viewerRole,
    serverTime: new Date(now).toISOString(),
  };
}

export async function systemMessage(t, consultationId, content) {
  const m = await db(t).one(
    `INSERT INTO messages (consultation_id, sender_role, kind, content) VALUES ($1,'system','system',$2) RETURNING *`,
    [consultationId, content],
  );
  db(t).afterCommit(() => publishToRoom(consultationId, { type: 'message', message: presentMessage(m) }));
  return m;
}

export const presentMessage = (m) => ({
  messageId: m.message_id, seq: m.seq, consultationId: m.consultation_id, senderUserId: m.sender_user_id,
  senderRole: m.sender_role, kind: m.kind, content: m.content, clientMsgId: m.client_msg_id,
  createdAt: m.created_at, deliveredAt: m.delivered_at, readAt: m.read_at,
});

async function setStatus(t, c, to, extra = {}) {
  assertTransition(c.status, to);
  const sets = ['status = $2', 'updated_at = now()'];
  const params = [c.consultation_id, to];
  for (const [k, v] of Object.entries(extra)) {
    params.push(v);
    sets.push(`${k} = $${params.length}`);
  }
  const updated = await t.one(`UPDATE consultations SET ${sets.join(', ')} WHERE consultation_id = $1 RETURNING *`, params);
  const full = { ...c, ...updated };
  t.afterCommit(() => {
    publishToRoom(c.consultation_id, { type: 'consultation.state', consultation: presentConsultation(full) });
  });
  return full;
}

async function releaseSlot(t, c) {
  if (c.slot_id) await t.query(`UPDATE availability_slots SET status = 'open', held_until = NULL WHERE slot_id = $1`, [c.slot_id]);
}

export async function accept(t, c) {
  let next = await setStatus(t, c, 'accepted', { accepted_at: new Date() });
  // Instant consultations are ready straight away; scheduled ones become ready shortly before start (job).
  const readyNow = c.booking_type === 'instant'
    || new Date(c.scheduled_at) - Date.now() <= config.business.readyLeadMin * 60000;
  if (readyNow) next = await markReady(t, next);
  await notify(t, c.client_user_id, {
    type: 'booking.accepted', title: 'Consultation accepted',
    body: `${c.astrologer_name} accepted your ${c.mode} consultation.`,
    data: { consultationId: c.consultation_id },
  });
  return next;
}

export async function markReady(t, c) {
  const next = await setStatus(t, c, 'ready', { ready_at: new Date() });
  await systemMessage(t, c.consultation_id, 'Consultation is ready. The astrologer will start the session shortly.');
  for (const uid of [c.client_user_id, c.astrologer_user_id]) {
    await notify(t, uid, {
      type: 'consultation.ready', title: 'Your consultation is ready',
      body: 'Open the app to join the consultation.', data: { consultationId: c.consultation_id },
    });
  }
  return next;
}

export async function start(t, c) {
  if (c.booking_type === 'scheduled' && new Date(c.scheduled_at) - Date.now() > config.business.readyLeadMin * 60000) {
    throw conflict('This consultation cannot start before its scheduled time');
  }
  const next = await setStatus(t, c, 'in_progress', { started_at: new Date() });
  await systemMessage(t, c.consultation_id, `Session started. Billing at ₹${rupees(c.rate_paise)}/min, up to ${c.duration_minutes} minutes.`);
  await notify(t, c.client_user_id, {
    type: 'consultation.started', title: 'Consultation started',
    body: `${c.astrologer_name} has started your session.`, data: { consultationId: c.consultation_id },
  });
  return next;
}

/** End an in-progress consultation: finalize billing, capture, ledger, receipt. */
export async function complete(t, c, { endedBy, reason }) {
  const endedAt = new Date();
  // A started session counts as at least one started minute (disclosed billing rule).
  const elapsed = Math.max(1, Math.ceil((endedAt - new Date(c.started_at)) / 1000));
  const billable = billableSeconds(elapsed, c.max_billable_seconds);
  const amount = Math.min(amountForSeconds(c.rate_paise, billable), c.quoted_amount_paise);
  const next = await setStatus(t, c, 'completed', {
    ended_at: endedAt, ended_by: endedBy, end_reason: reason, duration_seconds: elapsed,
    billable_seconds: billable, final_amount_paise: amount,
  });
  await t.query(`UPDATE bookings SET status = 'completed', updated_at = now() WHERE booking_id = $1`, [c.booking_id]);
  const payment = await paymentForBooking(t, c.booking_id, true);
  if (payment) await captureOrVoid(t, payment, amount);
  await createEarning(t, { consultationId: c.consultation_id, astrologerId: c.astrologer_id, mode: c.mode, grossPaise: amount });
  await systemMessage(t, c.consultation_id,
    `Session ended (${reason}). Billed ${Math.ceil(billable / 60)} min — ₹${rupees(amount)}. Unused balance of ₹${rupees(c.quoted_amount_paise - amount)} is released.`);
  await notify(t, c.client_user_id, {
    type: 'consultation.completed', title: 'Consultation completed',
    body: `Your session with ${c.astrologer_name} has ended. Amount charged: ₹${rupees(amount)}.`,
    data: { consultationId: c.consultation_id }, channels: ['in_app', 'push', 'email'],
  });
  await notify(t, c.astrologer_user_id, {
    type: 'consultation.completed', title: 'Consultation completed',
    body: `Session completed. Gross ₹${rupees(amount)}.`, data: { consultationId: c.consultation_id },
  });
  return next;
}

/**
 * Cancel/reject/expire before the session starts, applying the cancellation
 * policy version the customer accepted at booking time.
 */
export async function cancelBeforeStart(t, c, { to, by, byUserId, reason, policyConfig }) {
  const pct = to === 'cancelled'
    ? cancellationRefundPct(policyConfig, { bookingType: c.booking_type, consultationStatus: c.status, scheduledAt: c.scheduled_at, cancelledBy: by })
    : 100;
  const next = await setStatus(t, c, to, { ended_at: new Date(), ended_by: by, end_reason: reason });
  await t.query(
    `UPDATE bookings SET status = $2, cancel_reason = $3, cancelled_by = $4, updated_at = now() WHERE booking_id = $1`,
    [c.booking_id, to === 'expired' ? 'expired' : 'cancelled', reason, byUserId || null],
  );
  await releaseSlot(t, c);
  const payment = await paymentForBooking(t, c.booking_id, true);
  let fee = 0;
  if (payment) {
    fee = Math.round((payment.amount_paise * (100 - pct)) / 100);
    await captureOrVoid(t, payment, fee);
    if (fee > 0) {
      await createEarning(t, { consultationId: c.consultation_id, astrologerId: c.astrologer_id, mode: c.mode, grossPaise: fee, note: 'Late cancellation fee' });
    }
  }
  const refundText = fee > 0 ? `₹${rupees(fee)} cancellation fee applies; the rest is released.` : 'Your full payment will be released/refunded.';
  const titles = { rejected: 'Consultation declined', expired: 'Consultation request expired', cancelled: 'Consultation cancelled' };
  await notify(t, c.client_user_id, {
    type: `booking.${to}`, title: titles[to], body: `${reason}. ${refundText}`, data: { consultationId: c.consultation_id },
    channels: ['in_app', 'push', 'email'],
  });
  if (by !== 'astrologer') {
    await notify(t, c.astrologer_user_id, { type: `booking.${to}`, title: titles[to], body: reason, data: { consultationId: c.consultation_id } });
  }
  return { consultation: next, feePaise: fee, refundPct: pct };
}
