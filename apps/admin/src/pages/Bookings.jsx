import { useState } from 'react';
import { useT, useAuth, useAsync, Card, Button, Badge, Modal, Spinner, Field, ErrorBox, rupees, fmtDateTime, titleCase, useToast } from '@astro/shared';

const STATUSES = ['', 'pending_payment', 'requested', 'accepted', 'ready', 'in_progress', 'completed', 'cancelled', 'rejected', 'expired'];

export default function Bookings() {
  const t = useT();
  const { api, can } = useAuth();
  const [status, setStatus] = useState('');
  const [q, setQ] = useState('');
  const list = useAsync(() => api.get(`/admin/bookings?status=${status}&q=${encodeURIComponent(q)}`), [status, q]);
  const [openId, setOpenId] = useState(null);
  const [toast, showToast] = useToast();
  return (
    <div className="stack">
      <div className="page-head"><div><h1>{t('page.bookings.title')}</h1><p>{t('page.bookings.sub')}</p></div>
        <div className="row"><input placeholder="Search ID, customer, astrologer" value={q} onChange={(e) => setQ(e.target.value)} />
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">{STATUSES.map((s) => <option key={s} value={s}>{s ? titleCase(s) : 'All statuses'}</option>)}</select></div></div>
      {list.loading ? <Spinner /> : (
        <Card pad={false}><div className="table-wrap"><table className="table">
          <thead><tr><th>Booking</th><th>Created</th><th>Customer</th><th>Astrologer</th><th>Type</th><th className="right">Amount</th><th>Status</th></tr></thead>
          <tbody>{list.data.map((b) => (
            <tr key={b.booking_id} className="clickable" onClick={() => setOpenId(b.booking_id)}>
              <td className="mono">{b.booking_id.slice(0, 8).toUpperCase()}</td><td className="small">{fmtDateTime(b.created_at)}</td>
              <td>{b.client_name}</td><td>{b.astrologer_name}</td><td className="small">{b.booking_type}{b.scheduled_at && <div className="tiny muted">{fmtDateTime(b.scheduled_at)}</div>}</td>
              <td className="right">{rupees(b.final_amount_paise ?? b.quoted_amount_paise)}</td><td><Badge status={b.consultation_status || b.status} /></td>
            </tr>
          ))}</tbody>
        </table></div></Card>
      )}
      {openId && <Detail id={openId} canManage={can('bookings.manage')} onClose={() => setOpenId(null)} onChanged={(m) => { list.reload(); showToast(m); }} />}
      {toast}
    </div>
  );
}

function Detail({ id, onClose, onChanged, canManage }) {
  const { api } = useAuth();
  const d = useAsync(() => api.get(`/admin/bookings/${id}`), [id]);
  const [reason, setReason] = useState('');
  const [purpose, setPurpose] = useState('');
  const [transcript, setTranscript] = useState(null);
  const [err, setErr] = useState(null);
  if (d.loading) return <Modal open onClose={onClose} title="Booking"><Spinner /></Modal>;
  const { booking: b, consultation: c, payments, refunds, ledger, tickets } = d.data;
  const cancel = async () => { try { await api.post(`/admin/bookings/${id}/cancel`, { reason }); onChanged('Booking cancelled; customer not charged'); d.reload(); } catch (e) { setErr(e); } };
  const loadTranscript = async () => { try { setTranscript(await api.get(`/admin/bookings/${id}/messages?purpose=${encodeURIComponent(purpose)}`)); } catch (e) { setErr(e); } };
  return (
    <Modal open wide onClose={onClose} title={`Booking ${b.booking_id.slice(0, 8).toUpperCase()}`}>
      <ErrorBox error={err} />
      <dl className="kv">
        <dt>Status</dt><dd><Badge status={b.status} /> {c && <Badge status={c.status} />}</dd>
        <dt>Customer → Astrologer</dt><dd>{b.client_name} → {b.astrologer_name}</dd>
        <dt>Type</dt><dd>{b.booking_type} {b.mode}{b.scheduled_at ? ` · ${fmtDateTime(b.scheduled_at)}` : ''} · up to {b.duration_minutes} min @ {rupees(b.rate_paise)}/min</dd>
        <dt>Policy</dt><dd>Cancellation v{b.policy_version}</dd>
        {b.cancel_reason && <><dt>Cancel reason</dt><dd>{b.cancel_reason}</dd></>}
        {c?.startedAt && <><dt>Session</dt><dd>{fmtDateTime(c.startedAt)} → {fmtDateTime(c.endedAt)} · billed {Math.ceil((c.billableSeconds || 0) / 60)} min · {rupees(c.finalAmountPaise)} ({c.endReason})</dd></>}
        <dt>Messages</dt><dd>{d.data.messageCount}</dd>
      </dl>
      <div className="field-label">Payments</div>
      <table className="table compact small"><tbody>{payments.map((p) => <tr key={p.transaction_id}><td className="mono">{p.gateway_order_id}</td><td>{rupees(p.amount_paise)}</td><td>captured {rupees(p.captured_paise)}</td><td>refunded {rupees(p.refunded_paise)}</td><td><Badge status={p.status} /></td></tr>)}</tbody></table>
      {refunds.length > 0 && <><div className="field-label">Refunds</div>{refunds.map((r) => <div key={r.refund_id} className="small">{rupees(r.amount_paise)} — {r.reason} · {fmtDateTime(r.created_at)}</div>)}</>}
      {ledger.length > 0 && <><div className="field-label">Commission ledger</div><table className="table compact small"><tbody>{ledger.map((l) => <tr key={l.ledger_id}><td>{l.entry_type}</td><td>gross {rupees(l.gross_paise)}</td><td>fee {rupees(l.platform_fee_paise)}</td><td>payable {rupees(l.payable_paise)}</td><td><Badge status={l.status} /></td></tr>)}</tbody></table></>}
      {tickets.length > 0 && <div className="small">Linked tickets: {tickets.map((t) => `#${t.ticket_number} (${t.status})`).join(', ')}</div>}
      {canManage && c && ['requested', 'accepted', 'ready'].includes(c.status) && (
        <div className="summary-box stack-s"><Field label="Cancel on behalf of support (full release to customer)"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (audited)" /></Field>
          <div><Button variant="danger" size="sm" disabled={reason.length < 3} onClick={cancel}>Cancel booking</Button></div></div>
      )}
      {canManage && d.data.messageCount > 0 && (
        <div className="summary-box stack-s">
          <Field label="View transcript for a dispute" hint="Private conversation. A purpose is required and the access is audited."><input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Ticket #12 refund dispute" /></Field>
          <div><Button variant="secondary" size="sm" disabled={purpose.length < 5} onClick={loadTranscript}>View transcript</Button></div>
          {transcript && <div className="stack-s" style={{ maxHeight: 260, overflowY: 'auto' }}>{transcript.map((m) => <div key={m.messageId} className="small"><strong>{m.senderRole}</strong> <span className="tiny muted">{fmtDateTime(m.createdAt)}</span>: {m.content}</div>)}</div>}
        </div>
      )}
    </Modal>
  );
}
