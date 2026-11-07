import { useState } from 'react';
import { useAuth, useAsync, Card, Button, Badge, Spinner, Field, ErrorBox, Tabs, Empty, fmtDateTime, titleCase } from '@astro/shared';

export default function Support() {
  const { api } = useAuth();
  const [tab, setTab] = useState('open');
  const list = useAsync(() => api.get(`/admin/tickets${tab === 'all' ? '' : `?status=${tab}`}`), [tab]);
  const [sel, setSel] = useState(null);
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Support & complaints</h1><p>Tickets from users and assistant handoffs, with SLA tracking.</p></div></div>
      <Tabs value={tab} onChange={(t) => { setTab(t); setSel(null); }} tabs={['open', 'assigned', 'escalated', 'resolved', 'all'].map((v) => ({ value: v, label: titleCase(v) }))} />
      <div className="layout-side">
        <Card pad={false}>{list.loading ? <Spinner /> : !list.data.length ? <Empty title="No tickets" /> : <div className="table-wrap"><table className="table">
          <thead><tr><th>#</th><th>Subject</th><th>From</th><th>Priority</th><th>SLA</th><th>Status</th></tr></thead>
          <tbody>{list.data.map((t) => <tr key={t.ticket_id} className="clickable" onClick={() => setSel(t.ticket_id)} style={sel === t.ticket_id ? { background: 'var(--primary-soft)' } : undefined}>
            <td>{t.ticket_number}</td><td><strong className="small">{t.subject}</strong><div className="tiny muted">{titleCase(t.category)}{t.source === 'assistant_handoff' && ' · via assistant'}</div></td>
            <td className="small">{t.requester}<div className="tiny muted">{t.requester_role}</div></td><td><Badge tone={t.priority === 'urgent' || t.priority === 'high' ? 'warn' : 'muted'}>{t.priority}</Badge></td>
            <td className="small">{t.sla_breached ? <Badge tone="bad">Breached</Badge> : fmtDateTime(t.sla_due_at)}</td><td><Badge status={t.status} /></td></tr>)}</tbody>
        </table></div>}</Card>
        {sel ? <TicketPanel id={sel} onChanged={list.reload} /> : <Card><p className="muted small">Select a ticket.</p></Card>}
      </div>
    </div>
  );
}

function TicketPanel({ id, onChanged }) {
  const { api } = useAuth();
  const t = useAsync(() => api.get(`/admin/tickets/${id}`), [id]);
  const [reply, setReply] = useState('');
  const [internal, setInternal] = useState(false);
  const [resolution, setResolution] = useState('');
  const [err, setErr] = useState(null);
  if (t.loading) return <Card><Spinner /></Card>;
  const d = t.data;
  const update = async (body) => { setErr(null); try { await api.post(`/admin/tickets/${id}`, body); t.reload(); onChanged(); } catch (e) { setErr(e); } };
  const send = async (e) => { e.preventDefault(); await api.post(`/admin/tickets/${id}/messages`, { body: reply, internal }); setReply(''); t.reload(); };
  return (
    <Card title={`#${d.ticket_number} ${d.subject}`} className="sticky">
      <div className="stack">
        <ErrorBox error={err} />
        <div><Badge status={d.status} /> <span className="small muted">{d.requester} ({d.requester_role}) · {fmtDateTime(d.created_at)}</span></div>
        {d.booking_id && <div className="small">Booking: <span className="mono">{d.booking_id.slice(0, 8).toUpperCase()}</span></div>}
        <div className="summary-box small" style={{ whiteSpace: 'pre-line' }}>{d.description}</div>
        <div className="stack-s" style={{ maxHeight: 280, overflowY: 'auto' }}>
          {d.messages.map((m) => <div key={m.ticket_message_id} className={`small ${m.internal ? 'alert alert-warn' : 'summary-box'}`} style={{ display: 'block', whiteSpace: 'pre-line' }}><strong>{m.author_name || titleCase(m.author_kind)}</strong>{m.internal && ' (internal)'} <span className="tiny muted">{fmtDateTime(m.created_at)}</span><div>{m.body}</div></div>)}
        </div>
        <form onSubmit={send} className="stack-s">
          <textarea rows={2} required value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to the user…" />
          <div className="row between"><label className="check small"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Internal note</label><Button size="sm" type="submit">Send</Button></div>
        </form>
        <div className="row wrap gap-s">
          {!d.assignee_user_id && <Button size="sm" variant="secondary" onClick={() => update({ assignToMe: true })}>Assign to me</Button>}
          {d.status !== 'escalated' && !['resolved', 'closed'].includes(d.status) && <Button size="sm" variant="secondary" onClick={() => update({ status: 'escalated', priority: 'urgent' })}>Escalate</Button>}
        </div>
        {!['resolved', 'closed'].includes(d.status) && (
          <div className="stack-s"><Field label="Resolution"><textarea rows={2} value={resolution} onChange={(e) => setResolution(e.target.value)} /></Field>
            <div><Button size="sm" disabled={!resolution} onClick={() => update({ status: 'resolved', resolution })}>Resolve</Button></div></div>
        )}
        {d.resolution && <div className="alert alert-ok small">Resolution: {d.resolution}</div>}
      </div>
    </Card>
  );
}
