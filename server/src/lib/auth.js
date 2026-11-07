import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { one } from './db.js';
import { unauthorized, forbidden } from './errors.js';

/**
 * Admin permission matrix (DPR §10: role-based access for customers, astrologers,
 * support, finance and super-admins).
 */
export const ADMIN_PERMISSIONS = {
  super_admin: ['*'],
  support: ['dashboard.view', 'customers.view', 'customers.manage', 'astrologers.view', 'astrologers.manage', 'bookings.view',
    'bookings.manage', 'support.manage', 'reviews.moderate', 'content.view', 'reports.view'],
  finance: ['dashboard.view', 'bookings.view', 'payments.view', 'payments.refund', 'payouts.manage',
    'commission.manage', 'reports.view', 'reports.export'],
  content: ['dashboard.view', 'content.view', 'content.manage', 'reports.view'],
};

export function hasPermission(user, perm) {
  if (user?.role !== 'admin') return false;
  const perms = ADMIN_PERMISSIONS[user.adminRole] || [];
  return perms.includes('*') || perms.includes(perm);
}

export function signAccessToken(user) {
  return jwt.sign(
    { sub: user.user_id, role: user.role, adminRole: user.admin_role || undefined },
    config.jwtSecret,
    { expiresIn: config.accessTokenTtlSec, issuer: 'astro-platform' },
  );
}

export async function verifyAccessToken(token) {
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret, { issuer: 'astro-platform' });
  } catch {
    throw unauthorized('Invalid or expired token');
  }
  // Re-check account status on each request so suspensions take effect immediately.
  const u = await one('SELECT user_id, role, admin_role, status FROM user_accounts WHERE user_id = $1', [payload.sub]);
  if (!u || u.status !== 'active') throw unauthorized('Account is not active');
  return { userId: u.user_id, role: u.role, adminRole: u.admin_role };
}

export async function authenticate(req, _res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) throw unauthorized();
  req.user = await verifyAccessToken(token);
  next();
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user?.role)) throw forbidden();
  next();
};

export const requirePermission = (perm) => (req, _res, next) => {
  if (!hasPermission(req.user, perm)) throw forbidden(`Missing permission: ${perm}`);
  next();
};

/** Resolve the caller's client_id (customer) — creates nothing. */
export async function clientIdFor(userId) {
  const r = await one('SELECT client_id FROM client_profiles WHERE user_id = $1', [userId]);
  if (!r) throw forbidden('No customer profile');
  return r.client_id;
}

export async function astrologerIdFor(userId) {
  const r = await one('SELECT astrologer_id FROM astrologer_profiles WHERE user_id = $1', [userId]);
  if (!r) throw forbidden('No astrologer profile');
  return r.astrologer_id;
}
