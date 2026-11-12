import { db } from '../../lib/db.js';
import { badRequest, conflict } from '../../lib/errors.js';
import { rupees } from '../../lib/money.js';

// Recharge packs (amount in paise, bonus %). Bonus credit is promotional and platform-funded.
export const RECHARGE_PACKS = [
  { amountPaise: 10000, bonusPct: 0 },
  { amountPaise: 20000, bonusPct: 0 },
  { amountPaise: 50000, bonusPct: 10, popular: true },
  { amountPaise: 100000, bonusPct: 10 },
  { amountPaise: 200000, bonusPct: 15 },
  { amountPaise: 500000, bonusPct: 20 },
];
export const MIN_RECHARGE_PAISE = 5000;
export const MAX_RECHARGE_PAISE = 10000000;
export const WELCOME_FREE_MINUTES = Number(process.env.WELCOME_FREE_MINUTES ?? 2);

export function bonusFor(amountPaise) {
  const pack = RECHARGE_PACKS.find((p) => p.amountPaise === amountPaise);
  return pack ? Math.round((amountPaise * pack.bonusPct) / 100) : 0;
}

export async function balanceOf(t, userId) {
  const r = await db(t).one('SELECT COALESCE(sum(amount_paise),0)::int AS b FROM wallet_transactions WHERE user_id = $1', [userId]);
  return r.b;
}

/**
 * Append a wallet ledger entry. Serialises per user (row lock on the account) so concurrent
 * holds can never overdraw. Must run inside a transaction.
 */
export async function postEntry(t, { userId, type, amountPaise, description, bookingId = null, paymentTransactionId = null, createdBy = null }) {
  if (!amountPaise) return null;
  await t.query('SELECT 1 FROM user_accounts WHERE user_id = $1 FOR UPDATE', [userId]);
  const balance = await balanceOf(t, userId);
  const after = balance + amountPaise;
  if (after < 0) throw conflict(`Insufficient wallet balance. You need ${rupees(-amountPaise)} but have ${rupees(balance)}.`, { code: 'insufficient_balance', balancePaise: balance, requiredPaise: -amountPaise });
  return t.one(
    `INSERT INTO wallet_transactions (user_id, type, amount_paise, balance_after_paise, booking_id, payment_transaction_id, description, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [userId, type, amountPaise, after, bookingId, paymentTransactionId, description, createdBy],
  );
}

/** Total currently held (and not yet released) for a booking, as a positive number. */
export async function heldForBooking(t, bookingId) {
  const r = await db(t).one(
    `SELECT COALESCE(-sum(amount_paise),0)::int AS held FROM wallet_transactions WHERE booking_id = $1 AND type IN ('hold','release')`, [bookingId],
  );
  return Math.max(0, r.held);
}

/** Welcome gift: free minutes on a customer's first wallet-paid consultation. */
export async function welcomeDiscount(t, clientId, ratePaise, durationMinutes) {
  if (!WELCOME_FREE_MINUTES) return { discountPaise: 0, label: null };
  const prior = await db(t).one(
    `SELECT 1 FROM bookings WHERE client_id = $1 AND status IN ('confirmed','completed') LIMIT 1`, [clientId],
  );
  if (prior) return { discountPaise: 0, label: null };
  const minutes = Math.min(WELCOME_FREE_MINUTES, durationMinutes);
  return { discountPaise: ratePaise * minutes, label: `Welcome Gift (${minutes} min free)` };
}

export function presentTxn(r) {
  return { id: r.wallet_txn_id, type: r.type, amountPaise: r.amount_paise, balanceAfterPaise: r.balance_after_paise, description: r.description, bookingId: r.booking_id, createdAt: r.created_at };
}

export function assertRechargeAmount(amountPaise) {
  if (!Number.isInteger(amountPaise) || amountPaise < MIN_RECHARGE_PAISE || amountPaise > MAX_RECHARGE_PAISE) {
    throw badRequest(`Recharge between ${rupees(MIN_RECHARGE_PAISE)} and ${rupees(MAX_RECHARGE_PAISE)}`);
  }
}
