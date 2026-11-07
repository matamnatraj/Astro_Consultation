import { useState } from 'react';
import { useAuth, useAsync, Card, Button, Badge, Tabs, Modal, Spinner, ErrorBox, Field, Empty, rupees, fmtDateTime, titleCase, useToast } from '@astro/shared';

export default function Astrologers() {
  const { api, can } = useAuth();
  const [tab, setTab] = useState('submitted');
  const list = useAsync(() => api.get(`/admin/astrologers${tab === 'all' ? '' : `?status=${tab}`}`), [tab]);
  const [openId, setOpenId] = useState(null);
  const [toast, showToast] = useToast();
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Astrologers</h1><p>Verify, approve, suspend and moderate astrologer profiles. Only approved astrologers are bookable.</p></div></div>
      <Tabs value={tab} onChange={setTab} tabs={['submitted', 'approved', 'rejected', 'suspended', 'draft', 'all'].map((v) => ({ value: v, label: v === 'submitted' ? 'Awaiting review' : titleCase(v) }))} />
      <ErrorBox error={list.error} />
      {list.loading ? <Spinner /> : !list.data.length ? <Empty title="No astrologers in this state" /> : (
        <Card pad={false}><div className="table-wrap"><table className="table">
          <thead><tr><th>Name</th><th>Contact</th><th>Experience</th><th>Rate</th><th>Rating</th><th>Sessions</th><th>Status</th></tr></thead>
          <tbody>{list.data.map((a) => (
            <tr key={a.astrologer_id} className="clickable" onClick={() => setOpenId(a.astrologer_id)}>
              <td><strong>{a.display_name}</strong>{a.is_online && <Badge tone="ok">online</Badge>}<div className="tiny muted">{a.specialties.join(', ')}</div></td>
              <td className="small">{a.phone || a.email}</td><td>{a.experience_years} yrs</td><td>{rupees(a.chat_rate_paise)}/min</td>
              <td>{a.rating_count ? `${Number(a.rating_avg).toFixed(1)} (${a.rating_count})` : '—'}</td><td>{a.completed_consultations}</td>
              <td><Badge status={a.verification_status} /></td>
            </tr>
          ))}</tbody>
        </table></div></Card>
      )}
      {openId && <Detail id={openId} canManage={can('astrologers.manage')} onClose={() => setOpenId(null)} onChanged={(msg) => { setOpenId(null); list.reload(); showToast(msg); }} />}
      {toast}
    </div>
  );
}

function Detail({ id, onClose, onChanged, canManage }) {
  const { api } = useAuth();
  const { data: a, loading } = useAsync(() => api.get(`/admin/astrologers/${id}`), [id]);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const decide = async (decision) => {
    setBusy(decision); setErr(null);
    try { const r = await api.post(`/admin/astrologers/${id}/verification`, { decision, notes: notes || undefined }); onChanged(`${a.display_name}: ${r.verificationStatus}`); } catch (e) { setErr(e); } finally { setBusy(null); }
  };
  const s = a?.verification_status;
  return (
    <Modal open wide onClose={onClose} title={a ? a.display_name : 'Astrologer'}
      footer={a && canManage && <>
        {['submitted', 'rejected'].includes(s) && <Button loading={busy === 'approve'} onClick={() => decide('approve')}>Approve</Button>}
        {s === 'submitted' && <Button variant="secondary" loading={busy === 'reject'} onClick={() => decide('reject')}>Request changes / reject</Button>}
        {s === 'approved' && <Button variant="danger" loading={busy === 'suspend'} onClick={() => decide('suspend')}>Suspend</Button>}
        {s === 'suspended' && <Button loading={busy === 'reinstate'} onClick={() => decide('reinstate')}>Reinstate</Button>}
      </>}>
      {loading ? <Spinner /> : (
        <div className="stack">
          <ErrorBox error={err} />
          <div><Badge status={s} /> <span className="small muted">Joined {fmtDateTime(a.created_at)} · {a.phone || a.email}</span></div>
          <p style={{ whiteSpace: 'pre-line' }}>{a.bio || <em className="muted">No bio</em>}</p>
          <dl className="kv">
            <dt>Experience</dt><dd>{a.experience_years} years</dd><dt>Languages</dt><dd>{a.languages.join(', ')}</dd>
            <dt>Specialties</dt><dd>{a.specialties.join(', ')}</dd><dt>Modes</dt><dd>{a.modes.join(', ')}</dd>
            <dt>Rates</dt><dd>chat {rupees(a.chat_rate_paise)} · voice {rupees(a.voice_rate_paise)} · video {rupees(a.video_rate_paise)} /min</dd>
            <dt>Bank</dt><dd>{a.payout_details ? `${a.payout_details.accountHolder} · ${a.payout_details.accountNumber} · ${a.payout_details.ifsc}` : 'Not provided'}</dd>
            <dt>Consultations</dt><dd>{a.stats.completed} completed · {a.stats.rejected} declined · {a.stats.expired} expired</dd>
          </dl>
          <div><div className="field-label">Documents (links expire in 5 minutes)</div>
            {a.documents.length === 0 ? <p className="small muted">None uploaded.</p> : a.documents.map((d) => (
              <div key={d.documentId} className="row small"><a href={d.url} target="_blank" rel="noreferrer">{titleCase(d.docType)} — {d.fileName}</a><span className="muted">{Math.round(d.sizeBytes / 1024)} KB</span><Badge status={d.status === 'accepted' ? 'approved' : d.status} /></div>
            ))}</div>
          {canManage && <Field label="Notes to astrologer" hint="Required when rejecting; shown to the astrologer."><textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>}
        </div>
      )}
    </Modal>
  );
}
