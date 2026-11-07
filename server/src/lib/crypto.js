import crypto from 'node:crypto';
import { config } from '../config.js';

const key = Buffer.from(config.storageKeyHex, 'hex');

export const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const hmac = (secret, data) => crypto.createHmac('sha256', secret).update(data).digest('hex');

export function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

/** AES-256-GCM encryption for files at rest. Output: iv(12) | tag(16) | ciphertext */
export function encrypt(buf) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), enc]);
}

export function decrypt(buf) {
  const d = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12));
  d.setAuthTag(buf.subarray(12, 28));
  return Buffer.concat([d.update(buf.subarray(28)), d.final()]);
}

/** Short-lived signed URL token for private files (DPR §9 integration controls). */
export function signFileToken(storageKey, ttlSec = 300) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const payload = `${storageKey}.${exp}`;
  return { exp, sig: hmac(key, payload) };
}

export function verifyFileToken(storageKey, exp, sig) {
  if (!exp || Number(exp) < Date.now() / 1000) return false;
  return safeEqual(hmac(key, `${storageKey}.${exp}`), sig || '');
}
