import { useState } from 'react';
import { useAuth, useAsync, Card, Button, Badge, Modal, Spinner, Field, ErrorBox, rupees, fmtDateTime, titleCase, useToast } from '@astro/shared';

export default function Customers() {
  const { api, can } = useAuth();
  const [q, setQ] = useState('');
  const list = useAsync(() => api.get(`/admin/customers?q=${encodeURIComponent(q)}`), [q]);
  const [openId, setOpenId] = useState(null);
  const [toast, showToast] = useToast();
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Customers</h1><p>Account lookup, status and support history. Birth details are not shown here.</p></div>
        <input style={{ maxWidth: 300 }} placeholder="Search name, phone, email" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {list.loading ? <Spinner /> : (
        <Card pad={false}><div className="table-wrap"><table className="table">
          <thead><tr><th>Name</th><th>Phone / email</th><th>Bookings</th><th>Joined</th><th>Last login</th><th>Status</th></tr></thead>
          <tbody>{list.data.map((c) => (
            <tr key={c.user_id} className="clickable" onClick={() => setOpenId(c.user_id)}>
              <td><strong>{c.full_name || '—'}</strong></td><td className="small">{c.phone || c.email}</td><td>{c.bookings}</td>
              <td className="small">{fmtDateTime(c.created_at)}</td><td className="small">{fmtDateTime(c.last_login_at)}</td><td><Badge status={c.status} /></td>
            </tr>
          ))}</tbody>
        </table></div></Card>
      )}
      {openId && <Detail id={openId} canManage={can('customers.manage')} onClose={() => setOpenId(null)} onChanged={(m) => { setOpenId(null); list.reload(); showToast(m); }} />}
      {toast}
    </div>
  );
}

function Detail({ id, onClose, onChanged, canManage }) {
  const { api } = useAuth();
  const { data: c, loading } = useAsync(() => api.get(`/admin/customers/${id}`), [id]);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState(null);
  const setStatus = async (status) => {
    try { await api.post(`/admin/customers/${id}/status`, { status, reason }); onChanged(`Customer ${status}`); } catch (e) { setErr(e); }
  };
  return (
    <Modal open wide onClose={onClose} title={c?.fullName || 'Customer'}>
      {loading ? <Spinner /> : (
        <div className="stack">
          <ErrorBox error={err} />
          <dl className="kv"><dt>Status</dt><dd><Badge status={c.status} /></dd><dt>Contact</dt><dd>{c.phone} {c.email}</dd><dt>Joined</dt><dd>{fmtDateTime(c.createdAt)}</dd>
            <dt>Language</dt><dd>{c.preferredLanguage}</dd><dt>Birth profiles</dt><dd>{c.birthProfileCount} (details private)</dd></dl>
          <div><div className="field-label">Bookings</div><div className="table-wrap"><table className="table compact small"><tbody>
            {c.bookings.map((b) => <tr key={b.booking_id}><td>{fmtDateTime(b.created_at)}</td><td>{b.astrologer_name}</td><td>{rupees(b.quoted_amount_paise)}</td><td><Badge status={b.consultation_status || b.status} /></td></tr>)}
          </tbody></table></div></div>
          <div><div className="field-label">Tickets</div>{c.tickets.length ? c.tickets.map((t) => <div key={t.ticket_id} className="small">#{t.ticket_number} {t.subject} <Badge status={t.status} /></div>) : <span className="small muted">None</span>}</div>
          <div><div className="field-label">Consents</div>{c.consents.map((x, i) => <div key={i} className="tiny">{titleCase(x.notice_type)} v{x.notice_version} · {x.context} · {fmtDateTime(x.accepted_at)}</div>)}</div>
          {canManage && (
            <div className="summary-box stack-s">
              <Field label="Reason for status change (audited)"><input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
              <div>{c.status === 'active' ? <Button variant="danger" size="sm" disabled={reason.length < 3} onClick={() => setStatus('suspended')}>Suspend account</Button>
                : <Button size="sm" disabled={reason.length < 3} onClick={() => setStatus('active')}>Reactivate account</Button>}</div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
