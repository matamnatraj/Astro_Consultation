import { db } from '../../lib/db.js';
import { config } from '../../config.js';
import { splitCommission } from '../../lib/money.js';
import * as mockpay from '../../providers/payments/mockpay.js';

const GATEWAYS = { mockpay };
export const gateway = GATEWAYS[config.payments.gateway];

export async function paymentForBooking(t, bookingId, lock = false) {
  return db(t).one(
    `SELECT * FROM payment_transactions WHERE booking_id = $1 AND status IN ('authorized','captured','partially_refunded','refunded')
     ORDER BY created_at DESC LIMIT 1 ${lock ? 'FOR UPDATE' : ''}`,
    [bookingId],
  );
}

/** Capture `amount` from an authorized payment; the remaining authorization is released. */
export async function captureOrVoid(t, payment, amountPaise) {
  if (payment.status !== 'authorized') return payment;
  if (amountPaise <= 0) {
    await gateway.voidAuthorization(payment.gateway_payment_id);
    return db(t).one(`UPDATE payment_transactions SET status = 'voided', updated_at = now() WHERE transaction_id = $1 RETURNING *`, [payment.transaction_id]);
  }
  const amt = Math.min(amountPaise, payment.amount_paise);
  await gateway.capture(payment.gateway_payment_id, amt);
  return db(t).one(
    `UPDATE payment_transactions SET status = 'captured', captured_paise = $2, updated_at = now() WHERE transaction_id = $1 RETURNING *`,
    [payment.transaction_id, amt],
  );
}

/** Refund part or all of a captured payment, recording a refund row and ledger adjustment. */
export async function refundCaptured(t, payment, amountPaise, { reason, initiatedBy }) {
  const refundable = payment.captured_paise - payment.refunded_paise;
  const amt = Math.min(amountPaise, refundable);
  if (amt <= 0) return null;
  const g = await gateway.refund(payment.gateway_payment_id, amt);
  const refunded = payment.refunded_paise + amt;
  await db(t).query(
    `UPDATE payment_transactions SET refunded_paise = $2, status = $3, updated_at = now() WHERE transaction_id = $1`,
    [payment.transaction_id, refunded, refunded >= payment.captured_paise ? 'refunded' : 'partially_refunded'],
  );
  const refund = await db(t).one(
    `INSERT INTO refunds (transaction_id, amount_paise, reason, gateway_refund_id, initiated_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
    [payment.transaction_id, amt, reason, g.refundId, initiatedBy || null],
  );
  // Reverse the astrologer's share proportionally via an adjustment entry (never edit history).
  const earning = await db(t).one(
    `SELECT l.* FROM commission_ledger l JOIN consultations c USING (consultation_id)
     WHERE c.booking_id = $1 AND l.entry_type = 'earning' LIMIT 1`, [payment.booking_id],
  );
  if (earning) {
    const { platformFee, payable } = splitCommission(amt, earning.fee_bps);
    await db(t).query(
      `INSERT INTO commission_ledger (consultation_id, astrologer_id, entry_type, gross_paise, platform_fee_paise, adjustments_paise,
         payable_paise, rule_id, fee_bps, status, eligible_at, note)
       VALUES ($1,$2,'adjustment',$3,$4,$5,$6,$7,$8,'eligible',now(),$9)`,
      [earning.consultation_id, earning.astrologer_id, -amt, -platformFee, -payable, -payable, earning.rule_id, earning.fee_bps,
       `Refund ${refund.refund_id}: ${reason}`],
    );
  }
  return refund;
}

/** Resolve the commission rule in force: astrologer-specific > mode > default. */
export async function resolveCommissionRule(t, astrologerId, mode, at = new Date()) {
  const rule = await db(t).one(
    `SELECT * FROM commission_rules WHERE effective_from <= $3 AND (effective_to IS NULL OR effective_to > $3)
       AND (scope = 'default' OR (scope = 'mode' AND mode = $2) OR (scope = 'astrologer' AND astrologer_id = $1))
     ORDER BY CASE scope WHEN 'astrologer' THEN 0 WHEN 'mode' THEN 1 ELSE 2 END, effective_from DESC LIMIT 1`,
    [astrologerId, mode, at],
  );
  return rule || { rule_id: null, platform_fee_bps: config.business.defaultPlatformFeeBps };
}

export async function createEarning(t, { consultationId, astrologerId, mode, grossPaise, note }) {
  if (grossPaise <= 0) return null;
  const rule = await resolveCommissionRule(t, astrologerId, mode);
  const { platformFee, payable } = splitCommission(grossPaise, rule.platform_fee_bps);
  return db(t).one(
    `INSERT INTO commission_ledger (consultation_id, astrologer_id, gross_paise, platform_fee_paise, payable_paise, rule_id, fee_bps,
       eligible_at, note)
     VALUES ($1,$2,$3,$4,$5,$6,$7, now() + make_interval(days => $8), $9) RETURNING *`,
    [consultationId, astrologerId, grossPaise, platformFee, payable, rule.rule_id, rule.platform_fee_bps, config.business.payoutHoldDays, note || null],
  );
}
