import { db } from '../../lib/db.js';
import { conflict } from '../../lib/errors.js';

export const REQUIRED_CONSENTS = {
  customer: ['terms', 'privacy', 'astrology_disclaimer'],
  astrologer: ['terms', 'privacy', 'astrologer_agreement'],
  admin: [],
};

export async function currentPolicy(t, noticeType) {
  return db(t).one('SELECT * FROM policy_documents WHERE notice_type = $1 AND is_current', [noticeType]);
}

/** Current notices the user still has to accept (none accepted at the current version). */
export async function pendingConsents(t, userId, role) {
  const types = REQUIRED_CONSENTS[role] || [];
  if (!types.length) return [];
  return db(t).many(
    `SELECT p.notice_type, p.version, p.title, p.body FROM policy_documents p
     WHERE p.is_current AND p.notice_type = ANY($2)
       AND NOT EXISTS (SELECT 1 FROM consent_records c WHERE c.user_id = $1
                       AND c.notice_type = p.notice_type AND c.notice_version = p.version)
     ORDER BY p.notice_type`,
    [userId, types],
  );
}

export async function assertConsents(t, userId, role) {
  const pending = await pendingConsents(t, userId, role);
  if (pending.length) {
    throw conflict('Please review and accept the current notices first', {
      code: 'consent_required', pending: pending.map((p) => ({ noticeType: p.notice_type, version: p.version })),
    });
  }
}

export async function recordConsent(t, { userId, noticeType, version, context, ip, userAgent }) {
  return db(t).one(
    `INSERT INTO consent_records (user_id, notice_type, notice_version, context, ip_address, user_agent)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [userId, noticeType, version, context, ip || null, userAgent?.slice(0, 200) || null],
  );
}

/** Refund percentage for a cancellation, per the policy version accepted at booking. */
export function cancellationRefundPct(policyConfig, { bookingType, consultationStatus, scheduledAt, now = new Date(), cancelledBy }) {
  const cfg = { fullRefundHoursBefore: 2, lateCancelRefundPct: 50, ...policyConfig };
  if (cancelledBy === 'astrologer' || cancelledBy === 'system') return 100;
  if (['requested'].includes(consultationStatus)) return 100; // not yet accepted
  if (bookingType === 'instant') return consultationStatus === 'accepted' || consultationStatus === 'ready' ? cfg.lateCancelRefundPct : 0;
  const hoursBefore = (new Date(scheduledAt) - now) / 3600_000;
  return hoursBefore >= cfg.fullRefundHoursBefore ? 100 : cfg.lateCancelRefundPct;
}
