// Operational, financial and quality reports with CSV export (DPR §3 Reports).
// Every report takes [$1 = from date, $2 = to date] inclusive (UTC dates).
const RANGE = (col) => `${col} >= $1::date AND ${col} < ($2::date + 1)`;

export const REPORTS = {
  bookings: {
    title: 'Bookings',
    description: 'All bookings with status, mode, amounts and parties',
    sql: `SELECT b.booking_id, b.created_at, b.status AS booking_status, c.status AS consultation_status, b.mode, b.booking_type,
            b.scheduled_at, b.duration_minutes, b.rate_paise, b.quoted_amount_paise, c.final_amount_paise,
            cp.full_name AS client, a.display_name AS astrologer
          FROM bookings b JOIN client_profiles cp USING (client_id) JOIN astrologer_profiles a USING (astrologer_id)
          LEFT JOIN consultations c USING (booking_id) WHERE ${RANGE('b.created_at')} ORDER BY b.created_at`,
  },
  financial: {
    title: 'Financial summary (daily)',
    description: 'Gross transaction value, captured, refunds, platform revenue and astrologer payables by day',
    sql: `SELECT d::date AS day,
            (SELECT COALESCE(sum(amount_paise),0) FROM payment_transactions p WHERE p.created_at::date = d AND p.status <> 'created' AND p.status <> 'failed')::bigint AS authorized_paise,
            (SELECT COALESCE(sum(captured_paise),0) FROM payment_transactions p WHERE p.updated_at::date = d)::bigint AS captured_paise,
            (SELECT COALESCE(sum(amount_paise),0) FROM refunds r WHERE r.created_at::date = d)::bigint AS refunds_paise,
            (SELECT COALESCE(sum(platform_fee_paise),0) FROM commission_ledger l WHERE l.created_at::date = d)::bigint AS platform_revenue_paise,
            (SELECT COALESCE(sum(payable_paise),0) FROM commission_ledger l WHERE l.created_at::date = d)::bigint AS astrologer_payable_paise,
            (SELECT count(*) FROM payment_transactions p WHERE p.created_at::date = d AND p.status = 'failed')::int AS failed_payments
          FROM generate_series($1::date, $2::date, interval '1 day') d ORDER BY d`,
  },
  consultations: {
    title: 'Consultation quality',
    description: 'Completion, rejection and expiry rates, acceptance time and average billable minutes by astrologer',
    sql: `SELECT a.display_name AS astrologer, count(*)::int AS total,
            count(*) FILTER (WHERE c.status = 'completed')::int AS completed,
            count(*) FILTER (WHERE c.status = 'rejected')::int AS rejected,
            count(*) FILTER (WHERE c.status = 'expired')::int AS expired,
            count(*) FILTER (WHERE c.status = 'cancelled')::int AS cancelled,
            round(100.0 * count(*) FILTER (WHERE c.status = 'completed') / NULLIF(count(*),0), 1) AS completion_rate_pct,
            round(avg(extract(epoch FROM c.accepted_at - c.created_at)) FILTER (WHERE c.accepted_at IS NOT NULL)) AS avg_accept_seconds,
            round(avg(c.billable_seconds) FILTER (WHERE c.status = 'completed') / 60.0, 1) AS avg_billable_minutes,
            round(avg(r.rating), 2) AS avg_rating
          FROM consultations c JOIN astrologer_profiles a USING (astrologer_id) LEFT JOIN reviews r USING (consultation_id)
          WHERE ${RANGE('c.created_at')} GROUP BY a.display_name ORDER BY total DESC`,
  },
  astrologer_earnings: {
    title: 'Astrologer earnings & commission',
    description: 'Gross, platform fee, adjustments and payable per astrologer',
    sql: `SELECT a.display_name AS astrologer, count(*) FILTER (WHERE l.entry_type = 'earning')::int AS earnings_entries,
            sum(l.gross_paise)::bigint AS gross_paise, sum(l.platform_fee_paise)::bigint AS platform_fee_paise,
            sum(l.adjustments_paise)::bigint AS adjustments_paise, sum(l.payable_paise)::bigint AS payable_paise,
            sum(l.payable_paise) FILTER (WHERE l.status = 'paid')::bigint AS paid_paise
          FROM commission_ledger l JOIN astrologer_profiles a USING (astrologer_id)
          WHERE ${RANGE('l.created_at')} AND l.status <> 'reversed' GROUP BY a.display_name ORDER BY gross_paise DESC`,
  },
  refunds: {
    title: 'Refunds',
    description: 'Refunds issued with reason and initiator',
    sql: `SELECT r.refund_id, r.created_at, r.amount_paise, r.reason, r.status, p.booking_id, p.gateway_payment_id,
            COALESCE(u.display_name, u.email, 'system') AS initiated_by
          FROM refunds r JOIN payment_transactions p USING (transaction_id) LEFT JOIN user_accounts u ON u.user_id = r.initiated_by
          WHERE ${RANGE('r.created_at')} ORDER BY r.created_at`,
  },
  payouts: {
    title: 'Payouts & reconciliation',
    description: 'Payout batches with status and bank reference',
    sql: `SELECT p.payout_id, p.created_at, a.display_name AS astrologer, p.amount_paise, p.entry_count, p.status, p.reference, p.processed_at
          FROM payouts p JOIN astrologer_profiles a USING (astrologer_id) WHERE ${RANGE('p.created_at')} ORDER BY p.created_at`,
  },
  support: {
    title: 'Support & complaints',
    description: 'Tickets by category with SLA performance',
    sql: `SELECT category, count(*)::int AS total, count(*) FILTER (WHERE status IN ('resolved','closed'))::int AS resolved,
            count(*) FILTER (WHERE source = 'assistant_handoff')::int AS from_assistant,
            count(*) FILTER (WHERE sla_due_at < COALESCE(CASE WHEN status IN ('resolved','closed') THEN updated_at END, now()))::int AS sla_breached
          FROM support_tickets WHERE ${RANGE('created_at')} GROUP BY category ORDER BY total DESC`,
  },
  acquisition: {
    title: 'Acquisition & profile completion',
    description: 'Daily registrations and profile/birth-chart completion',
    sql: `SELECT u.created_at::date AS day, count(*)::int AS registrations,
            count(*) FILTER (WHERE cp.full_name IS NOT NULL)::int AS profile_completed,
            count(*) FILTER (WHERE EXISTS (SELECT 1 FROM birth_charts bc WHERE bc.client_id = cp.client_id))::int AS with_chart,
            count(*) FILTER (WHERE EXISTS (SELECT 1 FROM bookings b WHERE b.client_id = cp.client_id AND b.status IN ('confirmed','completed')))::int AS booked
          FROM user_accounts u JOIN client_profiles cp USING (user_id) WHERE ${RANGE('u.created_at')} GROUP BY 1 ORDER BY 1`,
  },
};

export function toCsv(rows) {
  if (!rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    let s = v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (/^[=+\-@]/.test(s)) s = `'${s}`; // CSV injection guard
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n');
}
