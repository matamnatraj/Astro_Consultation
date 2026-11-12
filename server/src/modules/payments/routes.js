import { Router } from 'express';
import express from 'express';
import { one, many, tx } from '../../lib/db.js';
import { parse, z } from '../../lib/validate.js';
import { badRequest, notFound, conflict, forbidden } from '../../lib/errors.js';
import { authenticate, requireRole, clientIdFor } from '../../lib/auth.js';
import { config } from '../../config.js';
import { gateway } from './service.js';
import { notify } from '../notifications/service.js';
import { publishToUser } from '../../realtime/hub.js';
import { rupees } from '../../lib/money.js';
import * as mockpay from '../../providers/payments/mockpay.js';
import { confirmBooking } from '../bookings/service.js';
import { postEntry } from '../wallet/service.js';

const r = Router();

r.post('/checkout', authenticate, requireRole('customer'), async (req, res) => {
  const { bookingId, returnUrl } = parse(z.object({ bookingId: z.string().uuid(), returnUrl: z.string().url().optional() }), req.body);
  const clientId = await clientIdFor(req.user.userId);
  const idemKey = req.headers['idempotency-key'] || `checkout:${bookingId}`;
  const out = await tx(async (t) => {
    const b = await t.one('SELECT * FROM bookings WHERE booking_id = $1 AND client_id = $2 FOR UPDATE', [bookingId, clientId]);
    if (!b) throw notFound('Booking');
    if (b.status !== 'pending_payment') throw conflict(`Booking is ${b.status}`);
    if (new Date(b.payment_expires_at) < new Date()) throw conflict('Payment window expired. Please book again.');
    // Reuse an open order for the same booking (idempotent checkout).
    const open = await t.one(`SELECT * FROM payment_transactions WHERE booking_id = $1 AND status = 'created' ORDER BY created_at DESC LIMIT 1`, [b.booking_id]);
    if (open) return open;
    const attempt = await t.one('SELECT count(*)::int AS n FROM payment_transactions WHERE booking_id = $1', [b.booking_id]);
    const order = await gateway.createOrder({ amountPaise: b.quoted_amount_paise, currency: b.currency, receipt: b.booking_id });
    return t.one(
      `INSERT INTO payment_transactions (booking_id, gateway, gateway_order_id, amount_paise, currency, status, idempotency_key)
       VALUES ($1,$2,$3,$4,$5,'created',$6) RETURNING *`,
      [b.booking_id, gateway.name, order.orderId, b.quoted_amount_paise, b.currency, `${idemKey}:${attempt.n}`],
    );
  });
  const checkoutUrl = `${config.publicApiUrl}/mockpay/checkout/${out.gateway_order_id}${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`;
  res.json({ transactionId: out.transaction_id, orderId: out.gateway_order_id, amountPaise: out.amount_paise, currency: out.currency, checkoutUrl });
});

r.get('/history', authenticate, requireRole('customer'), async (req, res) => {
  const clientId = await clientIdFor(req.user.userId);
  res.json(await many(
    `SELECT p.transaction_id, p.booking_id, p.amount_paise, p.captured_paise, p.refunded_paise, p.status, p.created_at,
            a.display_name AS astrologer_name, b.mode
     FROM payment_transactions p JOIN bookings b USING (booking_id) JOIN astrologer_profiles a USING (astrologer_id)
     WHERE b.client_id = $1 AND p.status <> 'created' ORDER BY p.created_at DESC`, [clientId],
  ));
});

/** Gateway webhook. Signature-verified and idempotent (DPR §9). */
export async function handleWebhook(rawBody, signature) {
  if (!gateway.verifyWebhook(rawBody, signature)) throw forbidden('Invalid webhook signature');
  const evt = JSON.parse(rawBody);
  return tx(async (t) => {
    const inserted = await t.one(
      `INSERT INTO payment_webhook_events (gateway_event_id, event_type, payload) VALUES ($1,$2,$3)
       ON CONFLICT (gateway_event_id) DO NOTHING RETURNING gateway_event_id`, [evt.id, evt.type, evt],
    );
    if (!inserted) return { duplicate: true };
    const p = await t.one('SELECT * FROM payment_transactions WHERE gateway_order_id = $1 FOR UPDATE', [evt.data.orderId]);
    let outcome = 'ignored';
    if (!p) outcome = 'unknown_order';
    else if (evt.type === 'payment.authorized' && p.status === 'created') {
      if (evt.data.amountPaise !== p.amount_paise) outcome = 'amount_mismatch';
      else outcome = await onAuthorized(t, p, evt.data.paymentId);
    } else if (evt.type === 'payment.failed' && p.status === 'created') {
      await t.query(`UPDATE payment_transactions SET status = 'failed', failure_reason = $2, updated_at = now() WHERE transaction_id = $1`,
        [p.transaction_id, evt.data.reason || 'Payment failed']);
      if (p.purpose === 'wallet_recharge') {
        await notify(t, p.user_id, { type: 'payment.failed', title: 'Recharge failed', body: 'Your wallet recharge did not go through. Please try again.', data: { wallet: true } });
      } else {
        const b = await t.one('SELECT b.*, cp.user_id FROM bookings b JOIN client_profiles cp USING (client_id) WHERE booking_id = $1', [p.booking_id]);
        await notify(t, b.user_id, { type: 'payment.failed', title: 'Payment failed', body: 'Your payment did not go through. You can retry from your booking.', data: { bookingId: b.booking_id } });
      }
      outcome = 'failed_recorded';
    }
    await t.query('UPDATE payment_webhook_events SET processed_at = now(), outcome = $2 WHERE gateway_event_id = $1', [evt.id, outcome]);
    return { outcome };
  });
}

async function onAuthorized(t, p, paymentId) {
  if (p.purpose === 'wallet_recharge') return onRechargePaid(t, p, paymentId);
  const b = await t.one('SELECT status FROM bookings WHERE booking_id = $1 FOR UPDATE', [p.booking_id]);
  await t.query(`UPDATE payment_transactions SET status = 'authorized', gateway_payment_id = $2, updated_at = now() WHERE transaction_id = $1`,
    [p.transaction_id, paymentId]);
  if (b.status !== 'pending_payment') {
    // Booking expired/cancelled while the customer was paying: release the authorization.
    await gateway.voidAuthorization(paymentId);
    await t.query(`UPDATE payment_transactions SET status = 'voided', updated_at = now() WHERE transaction_id = $1`, [p.transaction_id]);
    return 'voided_late_payment';
  }
  await confirmBooking(t, p.booking_id, { paidVia: 'gateway' });
  return 'authorized';
}

/** Wallet recharge: capture immediately and credit the wallet (plus any pack bonus). */
async function onRechargePaid(t, p, paymentId) {
  await gateway.capture(paymentId, p.amount_paise);
  await t.query(`UPDATE payment_transactions SET status = 'captured', captured_paise = amount_paise, gateway_payment_id = $2, updated_at = now() WHERE transaction_id = $1`,
    [p.transaction_id, paymentId]);
  await postEntry(t, { userId: p.user_id, type: 'recharge', amountPaise: p.amount_paise, description: 'Wallet recharge', paymentTransactionId: p.transaction_id });
  if (p.bonus_paise) await postEntry(t, { userId: p.user_id, type: 'bonus', amountPaise: p.bonus_paise, description: 'Recharge bonus', paymentTransactionId: p.transaction_id });
  await notify(t, p.user_id, {
    type: 'wallet.recharged', title: 'Wallet recharged',
    body: `₹${rupees(p.amount_paise)} added${p.bonus_paise ? ` + ₹${rupees(p.bonus_paise)} bonus` : ''}.`, data: { wallet: true },
  });
  return 'wallet_credited';
}

export const webhookRouter = Router();
webhookRouter.post('/', express.raw({ type: '*/*', limit: '100kb' }), async (req, res) => {
  const result = await handleWebhook(req.body.toString('utf8'), req.headers['x-mockpay-signature']);
  res.json({ ok: true, ...result });
});

// ───────────── MockPay hosted checkout (simulates the gateway's own page) ─────────────
export const mockpayRouter = Router();
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

mockpayRouter.get('/checkout/:orderId', async (req, res) => {
  const p = await one('SELECT amount_paise, status FROM payment_transactions WHERE gateway_order_id = $1', [req.params.orderId]);
  if (!p) throw notFound('Order');
  const ret = req.query.returnUrl ? String(req.query.returnUrl) : '';
  res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self' http: https:");
  res.send(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>MockPay checkout</title>
<style>body{font-family:system-ui;background:#f4f4f7;display:grid;place-items:center;min-height:100vh;margin:0}
.card{background:#fff;padding:28px;border-radius:14px;box-shadow:0 4px 24px #0001;width:min(360px,90vw)}h1{font-size:18px;margin:0 0 4px}
.amt{font-size:32px;font-weight:700;margin:16px 0}.note{color:#666;font-size:13px}button{width:100%;padding:12px;border:0;border-radius:8px;font-size:15px;margin-top:10px;cursor:pointer}
.pay{background:#2b59c3;color:#fff}.fail{background:#eee}</style></head><body><div class="card">
<h1>MockPay — test gateway</h1><div class="note">Sandbox checkout. No real money moves and no card data is collected.</div>
<div class="amt">₹${rupees(p.amount_paise)}</div>
${p.status !== 'created' ? `<p>This order is already <b>${esc(p.status)}</b>.</p>${ret ? `<a href="${esc(ret)}">Return to app</a>` : ''}` : `
<form method="post" action="/mockpay/checkout/${esc(req.params.orderId)}/complete">
<input type="hidden" name="returnUrl" value="${esc(ret)}">
<button class="pay" name="outcome" value="success">Pay ₹${rupees(p.amount_paise)}</button>
<button class="fail" name="outcome" value="failure">Simulate failure</button></form>`}
</div></body></html>`);
});

mockpayRouter.post('/checkout/:orderId/complete', express.urlencoded({ extended: false }), async (req, res) => {
  const p = await one('SELECT amount_paise FROM payment_transactions WHERE gateway_order_id = $1', [req.params.orderId]);
  if (!p) throw notFound('Order');
  const outcome = req.body.outcome === 'success' ? 'success' : 'failure';
  const evt = {
    id: mockpay.newEventId(),
    type: outcome === 'success' ? 'payment.authorized' : 'payment.failed',
    data: { orderId: req.params.orderId, paymentId: mockpay.newPaymentId(), amountPaise: p.amount_paise, reason: outcome === 'failure' ? 'Card declined (simulated)' : undefined },
  };
  const raw = JSON.stringify(evt);
  // The gateway calls our webhook server-to-server with an HMAC signature.
  await handleWebhook(raw, mockpay.signWebhook(raw));
  const ret = String(req.body.returnUrl || '');
  // Web apps return over http(s); the mobile apps return through their registered URL scheme.
  if (/^(https?|astrocustomer|exp):\/\//.test(ret)) {
    const u = new URL(ret);
    u.searchParams.set('payment', outcome);
    return res.redirect(303, u.toString());
  }
  res.send(`<p style="font-family:system-ui">Payment ${outcome}. You can close this window.</p>`);
});

export default r;
