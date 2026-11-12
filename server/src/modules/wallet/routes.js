import { Router } from 'express';
import { many, tx } from '../../lib/db.js';
import { parse, z } from '../../lib/validate.js';
import { authenticate } from '../../lib/auth.js';
import { config } from '../../config.js';
import { gateway } from '../payments/service.js';
import { RECHARGE_PACKS, MIN_RECHARGE_PAISE, balanceOf, bonusFor, presentTxn, assertRechargeAmount } from './service.js';

const r = Router();
r.use(authenticate);

r.get('/', async (req, res) => {
  const [balance, txns] = await Promise.all([
    balanceOf(null, req.user.userId),
    many('SELECT * FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100', [req.user.userId]),
  ]);
  res.json({
    balancePaise: balance,
    packs: RECHARGE_PACKS.map((p) => ({ ...p, bonusPaise: bonusFor(p.amountPaise) })),
    minRechargePaise: MIN_RECHARGE_PAISE,
    transactions: txns.map(presentTxn),
  });
});

/** Start a recharge: creates a gateway order; the wallet is credited when the gateway confirms payment. */
r.post('/recharge', async (req, res) => {
  const b = parse(z.object({ amountPaise: z.number().int(), returnUrl: z.string().url().optional() }), req.body);
  assertRechargeAmount(b.amountPaise);
  const bonus = bonusFor(b.amountPaise);
  const p = await tx(async (t) => {
    const order = await gateway.createOrder({ amountPaise: b.amountPaise, currency: config.business.currency, receipt: `wallet:${req.user.userId}` });
    return t.one(
      `INSERT INTO payment_transactions (purpose, user_id, gateway, gateway_order_id, amount_paise, bonus_paise, currency, status, idempotency_key)
       VALUES ('wallet_recharge',$1,$2,$3,$4,$5,$6,'created',$7) RETURNING *`,
      [req.user.userId, gateway.name, order.orderId, b.amountPaise, bonus, config.business.currency, `recharge:${order.orderId}`],
    );
  });
  const checkoutUrl = `${config.publicApiUrl}/mockpay/checkout/${p.gateway_order_id}${b.returnUrl ? `?returnUrl=${encodeURIComponent(b.returnUrl)}` : ''}`;
  res.status(201).json({ transactionId: p.transaction_id, orderId: p.gateway_order_id, amountPaise: p.amount_paise, bonusPaise: bonus, checkoutUrl });
});

export default r;
