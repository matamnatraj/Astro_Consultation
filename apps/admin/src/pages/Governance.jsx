import { useState } from 'react';
import { useT, useAuth, useAsync, Card, Button, Badge, Spinner, Field, ErrorBox, fmtDateTime, titleCase, useToast } from '@astro/shared';

export function Admins() {
  const t = useT();
  const { api, me } = useAuth();
  const d = useAsync(() => api.get('/admin/admins'), []);
  const [f, setF] = useState({ email: '', displayName: '', adminRole: 'support' });
  const [err, setErr] = useState(null);
  const [toast, showToast] = useToast();
  const add = async (e) => { e.preventDefault(); setErr(null); try { await api.post('/admin/admins', f); setF({ email: '', displayName: '', adminRole: 'support' }); d.reload(); showToast('Admin added'); } catch (x) { setErr(x); } };
  const update = async (u, body) => { try { await api.put(`/admin/admins/${u.user_id}`, body); d.reload(); } catch (x) { showToast(x.message, 'bad'); } };
  if (d.loading) return <Spinner />;
  return (
    <div className="stack">
      <div className="page-head"><div><h1>{t('page.admins.title')}</h1><p>{t('page.admins.sub')}</p></div></div>
      <Card title="Add admin">
        <form onSubmit={add} className="stack"><ErrorBox error={err} />
          <div className="form-grid">
            <Field label="Email"><input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
            <Field label="Name"><input required value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></Field>
            <Field label="Role"><select value={f.adminRole} onChange={(e) => setF({ ...f, adminRole: e.target.value })}>{Object.keys(d.data.roles).map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}</select></Field>
          </div>
          <div><Button type="submit">Add admin</Button></div></form>
      </Card>
      <Card pad={false}><div className="table-wrap"><table className="table">
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last login</th><th>Status</th><th /></tr></thead>
        <tbody>{d.data.admins.map((u) => <tr key={u.user_id}><td>{u.display_name}</td><td className="small">{u.email}</td>
          <td>{u.user_id === me.user.userId ? titleCase(u.admin_role) : <select className="select-sm" value={u.admin_role} onChange={(e) => update(u, { adminRole: e.target.value })}>{Object.keys(d.data.roles).map((r) => <option key={r} value={r}>{titleCase(r)}</option>)}</select>}</td>
          <td className="small">{fmtDateTime(u.last_login_at)}</td><td><Badge status={u.status} /></td>
          <td>{u.user_id !== me.user.userId && (u.status === 'active' ? <Button size="sm" variant="ghost" onClick={() => update(u, { status: 'suspended' })}>Suspend</Button> : <Button size="sm" variant="ghost" onClick={() => update(u, { status: 'active' })}>Reactivate</Button>)}</td></tr>)}</tbody>
      </table></div></Card>
      <Card title="Role permissions"><dl className="kv small">{Object.entries(d.data.roles).map(([r, p]) => [<dt key={r}>{titleCase(r)}</dt>, <dd key={`${r}d`}>{p.join(', ')}</dd>])}</dl></Card>
      {toast}
    </div>
  );
}

export function Audit() {
  const t = useT();
  const { api } = useAuth();
  const [f, setF] = useState({ action: '', targetId: '', outcome: '' });
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString();
  const list = useAsync(() => api.get(`/admin/audit?${qs}&limit=200`), [qs]);
  return (
    <div className="stack">
      <div className="page-head"><div><h1>{t('page.audit.title')}</h1><p>{t('page.audit.sub')}</p></div></div>
      <div className="form-grid">
        <input placeholder="Action contains (e.g. chart, refund)" value={f.action} onChange={(e) => setF({ ...f, action: e.target.value })} />
        <input placeholder="Target ID" value={f.targetId} onChange={(e) => setF({ ...f, targetId: e.target.value })} />
        <select value={f.outcome} onChange={(e) => setF({ ...f, outcome: e.target.value })}><option value="">Any outcome</option><option value="success">Success</option><option value="denied">Denied</option><option value="failure">Failure</option></select>
      </div>
      <Card pad={false}>{list.loading ? <Spinner /> : <div className="table-wrap"><table className="table compact">
        <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Target</th><th>Purpose</th><th>Outcome</th><th>Context</th></tr></thead>
        <tbody>{list.data.map((e) => <tr key={e.event_id}><td className="small nowrap">{fmtDateTime(e.created_at)}</td><td className="small">{e.actor_name || '—'}<div className="tiny muted">{e.actor_role}</div></td><td className="mono">{e.action}</td>
          <td className="small">{e.target_type}<div className="mono">{e.target_id?.slice(0, 13)}</div></td><td className="small">{e.purpose}</td><td><Badge status={e.outcome === 'success' ? 'completed' : 'failed'}>{e.outcome}</Badge></td><td className="mono" style={{ maxWidth: 260, overflowWrap: 'anywhere' }}>{Object.keys(e.context || {}).length ? JSON.stringify(e.context) : ''}</td></tr>)}</tbody>
      </table></div>}</Card>
    </div>
  );
}

export function Consents() {
  const t = useT();
  const { api } = useAuth();
  const [type, setType] = useState('');
  const list = useAsync(() => api.get(`/admin/consents?noticeType=${type}`), [type]);
  return (
    <div className="stack">
      <div className="page-head"><div><h1>{t('page.consents.title')}</h1><p>{t('page.consents.sub')}</p></div>
        <select style={{ width: 240 }} value={type} onChange={(e) => setType(e.target.value)}><option value="">All notices</option>{['terms', 'privacy', 'astrology_disclaimer', 'cancellation_policy', 'astrologer_agreement'].map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}</select></div>
      <Card pad={false}>{list.loading ? <Spinner /> : <div className="table-wrap"><table className="table compact">
        <thead><tr><th>Accepted</th><th>User</th><th>Role</th><th>Notice</th><th>Version</th><th>Context</th><th>IP</th></tr></thead>
        <tbody>{list.data.map((c) => <tr key={c.consent_id}><td className="small">{fmtDateTime(c.accepted_at)}</td><td className="small">{c.identifier}</td><td>{c.role}</td><td>{titleCase(c.notice_type)}</td><td>v{c.notice_version}</td><td className="mono">{c.context}</td><td className="mono">{c.ip_address}</td></tr>)}</tbody>
      </table></div>}</Card>
    </div>
  );
}
