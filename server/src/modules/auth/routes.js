import { Router } from 'express';
import crypto from 'node:crypto';
import { config } from '../../config.js';
import { tx, one, query } from '../../lib/db.js';
import { parse, z } from '../../lib/validate.js';
import { badRequest, unauthorized, forbidden } from '../../lib/errors.js';
import { sha256, randomToken } from '../../lib/crypto.js';
import { signAccessToken, authenticate, ADMIN_PERMISSIONS } from '../../lib/auth.js';
import { rateLimit, hit } from '../../lib/rateLimit.js';
import { audit } from '../../lib/audit.js';

const r = Router();

export function normalizeIdentifier(raw) {
  const s = String(raw).trim();
  if (s.includes('@')) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)) throw badRequest('Invalid email address');
    return { kind: 'email', value: s.toLowerCase() };
  }
  const digits = s.replace(/[\s\-()]/g, '');
  const phone = digits.startsWith('+') ? digits : `+91${digits.replace(/^0/, '')}`; // India default (DPR assumption)
  if (!/^\+\d{10,15}$/.test(phone)) throw badRequest('Invalid phone number');
  return { kind: 'phone', value: phone };
}

const otpRequestSchema = z.object({
  identifier: z.string().min(3).max(100),
  role: z.enum(['customer', 'astrologer', 'admin']),
});

r.post('/otp/request', rateLimit('otp-ip', 20, 600), async (req, res) => {
  const { identifier, role } = parse(otpRequestSchema, req.body);
  const id = normalizeIdentifier(identifier);
  hit(`otp-id:${id.value}`, 5, 600);

  const existing = await one(`SELECT role, status FROM user_accounts WHERE ${id.kind} = $1`, [id.value]);
  if (existing && existing.role !== role) throw badRequest(`This ${id.kind} is registered as a ${existing.role} account`);
  if (existing && existing.status !== 'active') throw forbidden('Account is not active. Contact support.');
  if (role === 'admin' && !existing) throw forbidden('Admin accounts are provisioned by a super admin');

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  const c = await one(
    `INSERT INTO otp_challenges (identifier, role, code_hash, expires_at)
     VALUES ($1,$2,$3, now() + make_interval(secs => $4)) RETURNING challenge_id`,
    [id.value, role, sha256(`${id.value}:${code}`), config.otp.ttlSec],
  );
  // Delivery adapter: SMS for phones, email otherwise. Logged in development only.
  if (!config.isProd && process.env.NODE_ENV !== 'test') console.log(`[otp] ${id.value} → ${code}`);
  res.json({
    challengeId: c.challenge_id,
    channel: id.kind === 'email' ? 'email' : 'sms',
    expiresInSec: config.otp.ttlSec,
    isNewAccount: !existing,
    ...(config.otp.devEcho ? { devCode: code } : {}),
  });
});

const verifySchema = z.object({
  challengeId: z.string().uuid(),
  code: z.string().regex(/^\d{6}$/),
  displayName: z.string().trim().min(1).max(80).optional(),
});

async function issueSession(t, user, userAgent) {
  const refreshToken = randomToken(40);
  await t.query(
    `INSERT INTO auth_sessions (user_id, refresh_hash, user_agent, expires_at)
     VALUES ($1,$2,$3, now() + make_interval(days => $4))`,
    [user.user_id, sha256(refreshToken), userAgent?.slice(0, 200) || null, config.refreshTokenTtlDays],
  );
  return { accessToken: signAccessToken(user), refreshToken, expiresInSec: config.accessTokenTtlSec };
}

r.post('/otp/verify', rateLimit('otp-verify', 30, 600), async (req, res) => {
  const body = parse(verifySchema, req.body);
  const result = await tx(async (t) => {
    const c = await t.one('SELECT * FROM otp_challenges WHERE challenge_id = $1 FOR UPDATE', [body.challengeId]);
    if (!c || c.consumed_at || new Date(c.expires_at) < new Date()) throw unauthorized('Code expired. Request a new one.');
    if (c.attempts >= config.otp.maxAttempts) throw unauthorized('Too many attempts. Request a new code.');
    if (sha256(`${c.identifier}:${body.code}`) !== c.code_hash) {
      await t.query('UPDATE otp_challenges SET attempts = attempts + 1 WHERE challenge_id = $1', [c.challenge_id]);
      return { error: true };
    }
    await t.query('UPDATE otp_challenges SET consumed_at = now() WHERE challenge_id = $1', [c.challenge_id]);

    const kind = c.identifier.includes('@') ? 'email' : 'phone';
    let user = await t.one(`SELECT * FROM user_accounts WHERE ${kind} = $1`, [c.identifier]);
    let isNew = false;
    if (!user) {
      if (c.role === 'admin') throw forbidden();
      isNew = true;
      const name = body.displayName || null;
      user = await t.one(
        `INSERT INTO user_accounts (role, ${kind}, display_name) VALUES ($1,$2,$3) RETURNING *`,
        [c.role, c.identifier, name],
      );
      if (c.role === 'customer') {
        await t.query(
          `INSERT INTO client_profiles (user_id, full_name, contact_email, contact_phone) VALUES ($1,$2,$3,$4)`,
          [user.user_id, name, kind === 'email' ? c.identifier : null, kind === 'phone' ? c.identifier : null],
        );
      } else {
        await t.query(`INSERT INTO astrologer_profiles (user_id, display_name) VALUES ($1,$2)`,
          [user.user_id, name || 'New Astrologer']);
      }
    }
    if (user.status !== 'active') throw forbidden('Account is not active');
    await t.query('UPDATE user_accounts SET last_login_at = now() WHERE user_id = $1', [user.user_id]);
    await audit(t, { actor: { userId: user.user_id, role: user.role }, action: 'auth.login', targetType: 'user', targetId: user.user_id, ip: req.ip });
    const tokens = await issueSession(t, user, req.headers['user-agent']);
    return { ...tokens, isNew, user: publicUser(user) };
  });
  if (result.error) throw unauthorized('Incorrect code');
  res.json(result);
});

r.post('/refresh', rateLimit('refresh', 60, 600), async (req, res) => {
  const { refreshToken } = parse(z.object({ refreshToken: z.string().min(20) }), req.body);
  const out = await tx(async (t) => {
    const s = await t.one(
      `SELECT s.*, u.role, u.admin_role, u.status FROM auth_sessions s JOIN user_accounts u USING (user_id)
       WHERE refresh_hash = $1 FOR UPDATE OF s`, [sha256(refreshToken)],
    );
    if (!s || s.revoked_at || new Date(s.expires_at) < new Date() || s.status !== 'active') throw unauthorized('Session expired');
    // Rotate: revoke the old refresh token, issue a new one.
    await t.query('UPDATE auth_sessions SET revoked_at = now() WHERE session_id = $1', [s.session_id]);
    return issueSession(t, s, req.headers['user-agent']);
  });
  res.json(out);
});

r.post('/logout', async (req, res) => {
  const { refreshToken } = parse(z.object({ refreshToken: z.string().optional() }), req.body || {});
  if (refreshToken) await query('UPDATE auth_sessions SET revoked_at = now() WHERE refresh_hash = $1', [sha256(refreshToken)]);
  res.json({ ok: true });
});

export function publicUser(u) {
  return {
    userId: u.user_id, role: u.role, adminRole: u.admin_role || null, phone: u.phone, email: u.email,
    displayName: u.display_name, status: u.status, createdAt: u.created_at,
  };
}

export const meRouter = Router();
meRouter.get('/', authenticate, async (req, res) => {
  const u = await one('SELECT * FROM user_accounts WHERE user_id = $1', [req.user.userId]);
  res.json({ user: publicUser(u), permissions: u.role === 'admin' ? ADMIN_PERMISSIONS[u.admin_role] : [] });
});

export default r;
