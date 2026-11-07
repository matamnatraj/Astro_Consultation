import { useState } from 'react';
import { useAuth, useAsync, Card, Button, Badge, Modal, Spinner, Field, ErrorBox, Tabs, fmtDateTime, titleCase, useToast } from '@astro/shared';

export default function Content() {
  const [tab, setTab] = useState('announcements');
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Content</h1><p>Announcements, banners, FAQ knowledge base (used by the assistant) and versioned policies/disclaimers.</p></div></div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'announcements', label: 'Announcements' }, { value: 'faqs', label: 'FAQs' }, { value: 'policies', label: 'Policies & disclaimers' }]} />
      {tab === 'announcements' && <Announcements />}{tab === 'faqs' && <Faqs />}{tab === 'policies' && <Policies />}
    </div>
  );
}

function Announcements() {
  const { api, can } = useAuth();
  const list = useAsync(() => api.get('/admin/announcements'), []);
  const [f, setF] = useState({ kind: 'announcement', title: '', body: '', audience: 'all' });
  const [err, setErr] = useState(null);
  const [toast, showToast] = useToast();
  const create = async (e) => { e.preventDefault(); setErr(null); try { await api.post('/admin/announcements', f); setF({ ...f, title: '', body: '' }); list.reload(); } catch (x) { setErr(x); } };
  const publish = async (a) => { const r = await api.post(`/admin/announcements/${a.announcement_id}/publish`); showToast(`Delivered to ${r.recipients} users`); list.reload(); };
  return (
    <div className="stack">
      {can('content.manage') && (
        <Card title="New announcement">
          <form onSubmit={create} className="stack">
            <ErrorBox error={err} />
            <div className="form-grid">
              <Field label="Type"><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}><option value="announcement">Announcement (notification)</option><option value="banner">Home banner</option></select></Field>
              <Field label="Audience"><select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}><option value="all">Everyone</option><option value="customers">Customers</option><option value="astrologers">Astrologers</option></select></Field>
              <Field label="Title"><input required value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
            </div>
            <Field label="Message"><textarea required rows={3} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
            <div><Button type="submit">Save draft</Button></div>
          </form>
        </Card>
      )}
      <Card pad={false}>{list.loading ? <Spinner /> : <div className="table-wrap"><table className="table">
        <thead><tr><th>Title</th><th>Type</th><th>Audience</th><th>Status</th><th>Delivery</th><th /></tr></thead>
        <tbody>{list.data.map((a) => <tr key={a.announcement_id}><td><strong>{a.title}</strong><div className="tiny muted">{a.body.slice(0, 100)}</div></td><td>{titleCase(a.kind)}</td><td>{a.audience}</td><td><Badge status={a.status} /><div className="tiny muted">{fmtDateTime(a.published_at)}</div></td>
          <td className="small">{a.delivered} delivered · {a.read} read</td>
          <td>{can('content.manage') && (a.status === 'draft' ? <Button size="sm" onClick={() => publish(a)}>Publish</Button> : a.status === 'published' && <Button size="sm" variant="ghost" onClick={async () => { await api.post(`/admin/announcements/${a.announcement_id}/archive`); list.reload(); }}>Archive</Button>)}</td></tr>)}</tbody>
      </table></div>}</Card>
      {toast}
    </div>
  );
}

function Faqs() {
  const { api, can } = useAuth();
  const list = useAsync(() => api.get('/admin/faqs'), []);
  const [edit, setEdit] = useState(null);
  return (
    <div className="stack">
      {can('content.manage') && <div><Button onClick={() => setEdit({ question: '', answer: '', keywords: [], audience: 'customers', link: '', sortOrder: 0, published: true })}>New FAQ</Button></div>}
      <Card pad={false}>{list.loading ? <Spinner /> : <div className="table-wrap"><table className="table">
        <thead><tr><th>Question</th><th>Audience</th><th>Keywords</th><th>Published</th></tr></thead>
        <tbody>{list.data.map((q) => <tr key={q.faq_id} className={can('content.manage') ? 'clickable' : ''} onClick={() => can('content.manage') && setEdit({ ...q, sortOrder: q.sort_order })}><td><strong className="small">{q.question}</strong><div className="tiny muted">{q.answer.slice(0, 120)}</div></td><td>{q.audience}</td><td className="tiny">{q.keywords.join(', ')}</td><td>{q.published ? <Badge tone="ok">Yes</Badge> : <Badge tone="muted">No</Badge>}</td></tr>)}</tbody>
      </table></div>}</Card>
      {edit && <FaqModal faq={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); list.reload(); }} />}
    </div>
  );
}

function FaqModal({ faq, onClose, onSaved }) {
  const { api } = useAuth();
  const [f, setF] = useState({ ...faq, keywords: (faq.keywords || []).join(', '), link: faq.link || '' });
  const [err, setErr] = useState(null);
  const save = async () => {
    const body = { question: f.question, answer: f.answer, keywords: f.keywords.split(',').map((s) => s.trim()).filter(Boolean), audience: f.audience, link: f.link || null, sortOrder: Number(f.sortOrder) || 0, published: f.published };
    try { if (faq.faq_id) await api.put(`/admin/faqs/${faq.faq_id}`, body); else await api.post('/admin/faqs', body); onSaved(); } catch (x) { setErr(x); }
  };
  return (
    <Modal open wide onClose={onClose} title={faq.faq_id ? 'Edit FAQ' : 'New FAQ'} footer={<>{faq.faq_id && <Button variant="ghost" style={{ marginRight: 'auto', color: 'var(--bad)' }} onClick={async () => { await api.del(`/admin/faqs/${faq.faq_id}`); onSaved(); }}>Delete</Button>}<Button onClick={save}>Save</Button></>}>
      <ErrorBox error={err} />
      <Field label="Question"><input value={f.question} onChange={(e) => setF({ ...f, question: e.target.value })} /></Field>
      <Field label="Approved answer" hint="The assistant answers FAQs only from this text."><textarea rows={4} value={f.answer} onChange={(e) => setF({ ...f, answer: e.target.value })} /></Field>
      <div className="form-grid">
        <Field label="Keywords (comma-separated)"><input value={f.keywords} onChange={(e) => setF({ ...f, keywords: e.target.value })} /></Field>
        <Field label="Audience"><select value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}><option value="customers">Customers</option><option value="astrologers">Astrologers</option><option value="all">All</option></select></Field>
        <Field label="In-app link"><input value={f.link} onChange={(e) => setF({ ...f, link: e.target.value })} placeholder="/profile" /></Field>
        <Field label="Order"><input type="number" value={f.sortOrder} onChange={(e) => setF({ ...f, sortOrder: e.target.value })} /></Field>
      </div>
      <label className="check"><input type="checkbox" checked={f.published} onChange={(e) => setF({ ...f, published: e.target.checked })} /> Published</label>
    </Modal>
  );
}

function Policies() {
  const { api, can } = useAuth();
  const list = useAsync(() => api.get('/admin/policies'), []);
  const [edit, setEdit] = useState(null);
  const [toast, showToast] = useToast();
  return (
    <div className="stack">
      <p className="small muted">Publishing a new version makes it current; users are asked to accept it again and acceptances are recorded per version. Bookings keep the cancellation-policy version accepted at checkout.</p>
      <Card pad={false}>{list.loading ? <Spinner /> : <div className="table-wrap"><table className="table">
        <thead><tr><th>Notice</th><th>Version</th><th>Audience</th><th>Published</th><th>Acceptances</th><th /></tr></thead>
        <tbody>{list.data.map((p) => <tr key={p.policy_id} style={{ opacity: p.is_current ? 1 : 0.55 }}><td><strong>{p.title}</strong><div className="tiny muted">{p.notice_type}</div></td><td>v{p.version} {p.is_current && <Badge tone="ok">current</Badge>}</td><td>{p.audience}</td><td className="small">{fmtDateTime(p.published_at)}</td><td>{p.acceptances}</td>
          <td>{can('content.manage') && p.is_current && <Button size="sm" variant="secondary" onClick={() => setEdit(p)}>New version</Button>}</td></tr>)}</tbody>
      </table></div>}</Card>
      {edit && <PolicyModal p={edit} onClose={() => setEdit(null)} onSaved={(v) => { setEdit(null); list.reload(); showToast(`Published v${v}`); }} />}
      {toast}
    </div>
  );
}

function PolicyModal({ p, onClose, onSaved }) {
  const { api } = useAuth();
  const [f, setF] = useState({ title: p.title, body: p.body, config: JSON.stringify(p.config || {}, null, 2), announce: true });
  const [err, setErr] = useState(null);
  const save = async () => {
    try {
      const r = await api.post('/admin/policies', { noticeType: p.notice_type, title: f.title, body: f.body, audience: p.audience, config: JSON.parse(f.config || '{}'), announce: f.announce });
      onSaved(r.version);
    } catch (x) { setErr(x); }
  };
  return (
    <Modal open wide onClose={onClose} title={`New version of ${p.title}`} footer={<Button onClick={save}>Publish v{p.version + 1}</Button>}>
      <ErrorBox error={err} />
      <Field label="Title"><input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
      <Field label="Text"><textarea rows={10} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></Field>
      {p.notice_type === 'cancellation_policy' && <Field label="Rules (JSON)" hint="fullRefundHoursBefore, lateCancelRefundPct"><textarea rows={4} className="mono" value={f.config} onChange={(e) => setF({ ...f, config: e.target.value })} /></Field>}
      <label className="check"><input type="checkbox" checked={f.announce} onChange={(e) => setF({ ...f, announce: e.target.checked })} /> Notify affected users about this update</label>
    </Modal>
  );
}
