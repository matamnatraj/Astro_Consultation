import { config } from '../../config.js';
import { notify } from '../notifications/service.js';
import { publishToUser } from '../../realtime/hub.js';
import { rupees } from '../../lib/money.js';

/**
 * A booking has been paid (gateway authorization or wallet hold): confirm it, book the slot,
 * open the consultation request and notify both sides. Runs inside the caller's transaction.
 */
export async function confirmBooking(t, bookingId, { paidVia }) {
  const b = await t.one(
    `SELECT b.*, cp.user_id AS client_user_id, ap.user_id AS astrologer_user_id, ap.display_name
     FROM bookings b JOIN client_profiles cp USING (client_id) JOIN astrologer_profiles ap USING (astrologer_id)
     WHERE booking_id = $1`, [bookingId],
  );
  await t.query(`UPDATE bookings SET status = 'confirmed', updated_at = now() WHERE booking_id = $1`, [b.booking_id]);
  if (b.slot_id) await t.query(`UPDATE availability_slots SET status = 'booked', held_until = NULL WHERE slot_id = $1`, [b.slot_id]);
  const acceptDeadline = b.booking_type === 'instant'
    ? new Date(Date.now() + config.business.acceptWindowMin * 60000)
    : new Date(Math.min(Date.now() + 12 * 3600_000, new Date(b.scheduled_at).getTime() - 5 * 60000));
  const c = await t.one(
    `INSERT INTO consultations (booking_id, client_id, astrologer_id, status, accept_deadline, max_billable_seconds)
     VALUES ($1,$2,$3,'requested',$4,$5) RETURNING consultation_id`,
    [b.booking_id, b.client_id, b.astrologer_id, acceptDeadline, b.duration_minutes * 60],
  );
  const payable = b.quoted_amount_paise - b.discount_paise;
  await notify(t, b.client_user_id, {
    type: 'payment.success', title: paidVia === 'wallet' ? 'Consultation requested' : 'Payment successful',
    body: `${paidVia === 'wallet' ? `₹${rupees(payable)} held from your wallet` : `₹${rupees(payable)} authorized`}. Waiting for ${b.display_name} to accept.`,
    data: { bookingId: b.booking_id, consultationId: c.consultation_id }, channels: ['in_app', 'push', 'email'],
  });
  await notify(t, b.astrologer_user_id, {
    type: 'booking.request', title: b.booking_type === 'instant' ? 'New instant consultation request' : 'New scheduled booking',
    body: `${b.mode} · ${b.duration_minutes} min${b.scheduled_at ? ` · ${new Date(b.scheduled_at).toISOString()}` : ''}. Please respond.`,
    data: { consultationId: c.consultation_id }, channels: ['in_app', 'push', 'sms'],
  });
  t.afterCommit(() => publishToUser(b.astrologer_user_id, { type: 'consultation.request', consultationId: c.consultation_id }));
  return c.consultation_id;
}
