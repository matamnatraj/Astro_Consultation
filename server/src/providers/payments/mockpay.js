// MockPay — a local stand-in for a hosted payment gateway (Razorpay/Cashfree/
// Stripe-style). It implements the same adapter contract a real gateway would:
// hosted checkout (card data never touches our servers), authorize → capture,
// void, refunds and HMAC-signed webhooks. Replace with a real adapter for launch.
import crypto from 'node:crypto';
import { config } from '../../config.js';
import { hmac, safeEqual } from '../../lib/crypto.js';

const id = (p) => `${p}_${crypto.randomBytes(8).toString('hex')}`;

export const name = 'mockpay';

export async function createOrder({ amountPaise, currency, receipt }) {
  const orderId = id('order');
  return { orderId, amountPaise, currency, receipt, checkoutUrl: `${config.publicApiUrl}/mockpay/checkout/${orderId}` };
}

export async function capture(paymentId, amountPaise) {
  return { paymentId, captured: amountPaise };
}

export async function voidAuthorization(paymentId) {
  return { paymentId, voided: true };
}

export async function refund(paymentId, amountPaise) {
  return { refundId: id('rfnd'), paymentId, amountPaise };
}

export function signWebhook(rawBody) {
  return hmac(config.payments.webhookSecret, rawBody);
}

export function verifyWebhook(rawBody, signature) {
  return Boolean(signature) && safeEqual(signWebhook(rawBody), signature);
}

export function newPaymentId() {
  return id('pay');
}
export function newEventId() {
  return id('evt');
}
