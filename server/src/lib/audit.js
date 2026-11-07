import { db } from './db.js';

/**
 * Record an audit event. Used for chart/profile access, admin actions, refunds,
 * payouts and permission changes (DPR §10). Never log birth details in context.
 */
export async function audit(t, { actor, action, targetType, targetId, purpose, context = {}, outcome = 'success', ip }) {
  await db(t).query(
    `INSERT INTO audit_events (actor_user_id, actor_role, action, target_type, target_id, purpose, context, outcome, ip_address)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [actor?.userId || null, actor?.adminRole || actor?.role || null, action, targetType, targetId ? String(targetId) : null,
     purpose || null, context, outcome, ip || null],
  );
}
