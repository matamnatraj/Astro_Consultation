export const rupees = (paise) => `₹${(Number(paise || 0) / 100).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—');
export const fmtDate = (d) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—');
export const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('en-IN', { timeStyle: 'short' }) : '');
export const mmss = (s) => `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, '0')}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
export const titleCase = (s) => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
export const timeAgo = (d) => {
  const s = (Date.now() - new Date(d)) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return fmtDate(d);
};
export const STATUS_TONE = {
  requested: 'warn', pending_payment: 'warn', accepted: 'info', ready: 'info', in_progress: 'live', confirmed: 'info',
  completed: 'ok', approved: 'ok', paid: 'ok', captured: 'ok', resolved: 'ok', published: 'ok', current: 'ok', active: 'ok',
  rejected: 'bad', cancelled: 'muted', expired: 'muted', failed: 'bad', suspended: 'bad', stale: 'warn', voided: 'muted',
  submitted: 'warn', draft: 'muted', open: 'warn', escalated: 'bad', refunded: 'muted', partially_refunded: 'info', authorized: 'info',
  eligible: 'info', pending: 'muted', in_payout: 'info', processing: 'info', hidden: 'muted', closed: 'muted', assigned: 'info',
};
