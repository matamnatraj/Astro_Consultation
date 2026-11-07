import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth, useAsync, Card, Button, Field, Modal, Spinner, Badge, ErrorBox, Empty, fmtDateTime, titleCase, useToast } from '@astro/shared';

const CATEGORIES = ['booking', 'payment', 'refund', 'consultation_quality', 'technical', 'account', 'complaint', 'other'];

export default function Support() {
  const { api } = useAuth();
  const [params] = useSearchParams();
  const tickets = useAsync(() => api.get('/support/tickets'), []);
  const faqs = useAsync(() => api.get('/content/faqs?audience=astrologers'), []);
  const [newOpen, setNewOpen] = useState(Boolean(params.get('bookingId')));
  const [openTicket, setOpenTicket] = useState(null);
  const [toast, showToast] = useToast();

  return (
    <div className="stack">
      <div className="page-head"><div><h1>Help & support</h1><p>Browse answers, ask the assistant (bottom-right), or raise a ticket with our team.</p></div>
        <Button onClick={() => setNewOpen(true)}>New ticket</Button></div>
      <div className="grid-2">
        <Card title="Your tickets">
          {tickets.loading ? <Spinner /> : !tickets.data.length ? <Empty title="No tickets" /> : (
            <div className="list">{tickets.data.map((t) => (
              <button key={t.ticket_id} className="list-item link" style={{ color: 'inherit', textAlign: 'left', width: '100%' }} onClick={() => setOpenTicket(t.ticket_id)}>
                <div className="grow"><strong>#{t.ticket_number} {t.subject}</strong><div className="tiny muted">{titleCase(t.category)} · {fmtDateTime(t.created_at)}</div></div>
                <Badge status={t.status} />
              </button>
            ))}</div>
          )}
        </Card>
        <Card title="Frequently asked questions">
          {faqs.data?.map((f) => <details key={f.faq_id} className="notice" style={{ marginBottom: 8 }}><summary><strong className="small">{f.question}</strong></summary><div className="notice-body">{f.answer}</div></details>)}
        </Card>
      </div>
      <NewTicket open={newOpen} bookingId={params.get('bookingId')} onClose={() => setNewOpen(false)} onCreated={(t) => { setNewOpen(false); tickets.reload(); showToast(`Ticket #${t.ticket_number} created`); }} />
      {openTicket && <TicketDetail id={openTicket} onClose={() => setOpenTicket(null)} />}
      {toast}
    </div>
  );
}

function NewTicket({ open, onClose, onCreated, bookingId }) {
  const { api } = useAuth();
  const [f, setF] = useState({ category: bookingId ? 'booking' : 'other', subject: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { onCreated(await api.post('/support/tickets', { ...f, bookingId: bookingId || undefined })); } catch (x) { setErr(x); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="New support ticket" footer={<Button form="tk" type="submit" loading={busy}>Submit</Button>}>
      <form id="tk" onSubmit={submit} className="stack">
        <ErrorBox error={err} />
        {bookingId && <p className="small muted">Linked to booking {bookingId.slice(0, 8).toUpperCase()}</p>}
        <Field label="Category"><select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })}>{CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}</select></Field>
        <Field label="Subject"><input required minLength={3} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
        <Field label="Describe the issue"><textarea required minLength={5} rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
      </form>
    </Modal>
  );
}

export function TicketDetail({ id, onClose }) {
  const { api } = useAuth();
  const t = useAsync(() => api.get(`/support/tickets/${id}`), [id]);
  const [reply, setReply] = useState('');
  const send = async (e) => { e.preventDefault(); await api.post(`/support/tickets/${id}/messages`, { body: reply }); setReply(''); t.reload(); };
  return (
    <Modal open onClose={onClose} title={t.data ? `#${t.data.ticket_number} ${t.data.subject}` : 'Ticket'}>
      {!t.data ? <Spinner /> : (
        <div className="stack">
          <div><Badge status={t.data.status} /> <span className="small muted">{titleCase(t.data.category)}</span></div>
          <div className="summary-box small" style={{ whiteSpace: 'pre-line' }}>{t.data.description}</div>
          {t.data.messages.map((m) => <div key={m.ticket_message_id} className={`msg ${m.author_kind === 'requester' ? 'mine' : 'theirs'}`}><div className="bubble small">{m.body}</div><div className="msg-meta">{m.author_kind === 'staff' ? 'Support' : 'You'} · {fmtDateTime(m.created_at)}</div></div>)}
          {t.data.resolution && <div className="alert alert-ok small">Resolution: {t.data.resolution}</div>}
          <form onSubmit={send} className="composer" style={{ padding: 0, border: 0 }}><input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Add a reply" required /><Button type="submit">Send</Button></form>
        </div>
      )}
    </Modal>
  );
}
