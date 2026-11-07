import { useState } from 'react';
import { useAuth, useAsync, Card, Button, Field, Spinner, ErrorBox, Badge, Alert, useToast, fmtDateTime, titleCase } from '@astro/shared';

const SPECIALTIES = ['Vedic', 'Western', 'KP System', 'Nadi', 'Career', 'Marriage', 'Relationships', 'Finance', 'Business', 'Health', 'Education', 'Kundli Matching', 'Muhurta', 'Nakshatra', 'Remedies', 'Tarot', 'Numerology', 'Vastu', 'Family', 'Property'];
const LANGUAGES = ['English', 'Hindi', 'Bengali', 'Marathi', 'Telugu', 'Tamil', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi', 'Odia', 'Sanskrit'];

const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

export default function ProfilePage() {
  const { api } = useAuth();
  const me = useAsync(() => api.get('/astrologer/me'), []);
  const [toast, showToast] = useToast();
  if (me.loading) return <Spinner />;
  if (me.error) return <ErrorBox error={me.error} />;
  const a = me.data;
  const editable = true;
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Profile & onboarding</h1><p>Verification status: <Badge status={a.verificationStatus} /></p></div></div>
      {a.verificationNotes && <Alert tone={a.verificationStatus === 'rejected' ? 'bad' : 'info'}>Reviewer notes: {a.verificationNotes}</Alert>}
      <ProfileForm a={a} editable={editable} onSaved={(p) => { me.setData({ ...a, ...p }); showToast('Profile saved'); }} />
      <Documents a={a} onChange={me.reload} showToast={showToast} />
      <Payout a={a} onSaved={() => { me.reload(); showToast('Bank details saved'); }} />
      {['draft', 'rejected'].includes(a.verificationStatus) && (
        <Card title="Submit for verification">
          <p className="small muted">Our team reviews your profile and documents before you become bookable. You'll be notified of the decision.</p>
          <SubmitButton onDone={() => { me.reload(); showToast('Submitted for verification'); }} />
        </Card>
      )}
      {toast}
    </div>
  );
}

function SubmitButton({ onDone }) {
  const { api } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  return (<div className="stack-s mt"><ErrorBox error={err} /><div><Button loading={busy} onClick={async () => { setBusy(true); setErr(null); try { await api.post('/astrologer/me/submit-verification'); onDone(); } catch (e) { setErr(e); } finally { setBusy(false); } }}>Submit for verification</Button></div></div>);
}

function ProfileForm({ a, onSaved }) {
  const { api } = useAuth();
  const [f, setF] = useState({
    displayName: a.displayName, bio: a.bio, experienceYears: a.experienceYears, languages: a.languages, specialties: a.specialties,
    services: a.services.join(', '), modes: a.modes, rates: { chat: a.rates.chat / 100, voice: a.rates.voice / 100, video: a.rates.video / 100 },
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      onSaved(await api.put('/astrologer/me', {
        ...f, experienceYears: Number(f.experienceYears), services: f.services.split(',').map((s) => s.trim()).filter(Boolean),
        rates: { chat: Math.round(f.rates.chat * 100), voice: Math.round((f.rates.voice || 0) * 100), video: Math.round((f.rates.video || 0) * 100) },
      }));
    } catch (x) { setErr(x); } finally { setBusy(false); }
  };
  return (
    <Card title="Public profile">
      <form onSubmit={save} className="stack">
        <ErrorBox error={err} />
        <div className="form-grid">
          <Field label="Display name"><input required value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} /></Field>
          <Field label="Years of experience"><input type="number" min="0" max="70" value={f.experienceYears} onChange={(e) => setF({ ...f, experienceYears: e.target.value })} /></Field>
        </div>
        <Field label="About you" hint={`${f.bio.length}/2000 · at least 50 characters`}><textarea rows={4} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} maxLength={2000} /></Field>
        <Field label="Languages"><div className="chips">{LANGUAGES.map((l) => <button type="button" key={l} className={`chip ${f.languages.includes(l) ? 'active' : ''}`} onClick={() => setF({ ...f, languages: toggle(f.languages, l) })}>{l}</button>)}</div></Field>
        <Field label="Specialties"><div className="chips">{SPECIALTIES.map((l) => <button type="button" key={l} className={`chip ${f.specialties.includes(l) ? 'active' : ''}`} onClick={() => setF({ ...f, specialties: toggle(f.specialties, l) })}>{l}</button>)}</div></Field>
        <Field label="Services offered" hint="Comma-separated"><input value={f.services} onChange={(e) => setF({ ...f, services: e.target.value })} /></Field>
        <div className="form-grid">
          {['chat', 'voice', 'video'].map((m) => (
            <Field key={m} label={`${titleCase(m)} rate (₹/min)`}>
              <div className="row gap-s">
                <input type="checkbox" checked={f.modes.includes(m)} onChange={() => setF({ ...f, modes: toggle(f.modes, m) })} aria-label={`Offer ${m}`} />
                <input type="number" min="0" step="1" disabled={!f.modes.includes(m)} value={f.rates[m]} onChange={(e) => setF({ ...f, rates: { ...f.rates, [m]: Number(e.target.value) } })} />
              </div>
            </Field>
          ))}
        </div>
        <p className="tiny muted">Chat is enabled for launch; voice/video become bookable once enabled by the platform.</p>
        <div><Button type="submit" loading={busy}>Save profile</Button></div>
      </form>
    </Card>
  );
}

function Documents({ a, onChange, showToast }) {
  const { api } = useAuth();
  const [docType, setDocType] = useState('government_id');
  const [busy, setBusy] = useState(false);
  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { showToast('File must be 5 MB or smaller', 'bad'); return; }
    setBusy(true);
    try {
      const b64 = await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
      await api.post('/astrologer/me/documents', { docType, fileName: file.name, mimeType: file.type, contentBase64: b64 });
      onChange(); showToast('Document uploaded (encrypted at rest)');
    } catch (x) { showToast(x.message, 'bad'); } finally { setBusy(false); e.target.value = ''; }
  };
  return (
    <Card title="Verification documents">
      <div className="stack">
        {a.documents.length === 0 ? <p className="muted small">No documents yet. A government ID is required.</p> : (
          <div className="list">{a.documents.map((d) => (
            <div key={d.document_id} className="list-item"><div className="grow"><strong className="small">{titleCase(d.doc_type)}</strong><div className="tiny muted">{d.file_name} · {fmtDateTime(d.uploaded_at)}</div></div><Badge status={d.status === 'accepted' ? 'approved' : d.status} /></div>
          ))}</div>
        )}
        <div className="row wrap gap-s">
          <select className="select-sm" value={docType} onChange={(e) => setDocType(e.target.value)} aria-label="Document type">
            <option value="government_id">Government ID</option><option value="address_proof">Address proof</option><option value="certification">Certification</option><option value="photo">Profile photo</option><option value="other">Other</option>
          </select>
          <label className="btn btn-secondary btn-sm">{busy ? 'Uploading…' : 'Upload file'}<input type="file" accept="application/pdf,image/jpeg,image/png" hidden onChange={upload} disabled={busy} /></label>
          <span className="tiny muted">PDF, JPG or PNG up to 5 MB. Visible only to the verification team.</span>
        </div>
      </div>
    </Card>
  );
}

function Payout({ a, onSaved }) {
  const { api } = useAuth();
  const [f, setF] = useState({ accountHolder: a.payoutDetails?.accountHolder || '', accountNumber: '', ifsc: a.payoutDetails?.ifsc || '', pan: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { await api.put('/astrologer/me/payout-details', { ...f, ifsc: f.ifsc.toUpperCase(), pan: f.pan ? f.pan.toUpperCase() : undefined }); onSaved(); setF({ ...f, accountNumber: '' }); } catch (x) { setErr(x); } finally { setBusy(false); }
  };
  return (
    <Card title="Payout bank account">
      <form onSubmit={save} className="stack">
        {a.payoutDetails && <p className="small">On file: {a.payoutDetails.accountHolder} · {a.payoutDetails.accountNumber} · {a.payoutDetails.ifsc}</p>}
        <ErrorBox error={err} />
        <div className="form-grid">
          <Field label="Account holder"><input required value={f.accountHolder} onChange={(e) => setF({ ...f, accountHolder: e.target.value })} /></Field>
          <Field label="Account number"><input required inputMode="numeric" pattern="\d{9,18}" value={f.accountNumber} onChange={(e) => setF({ ...f, accountNumber: e.target.value })} autoComplete="off" /></Field>
          <Field label="IFSC"><input required pattern="[A-Za-z]{4}0[A-Za-z0-9]{6}" value={f.ifsc} onChange={(e) => setF({ ...f, ifsc: e.target.value })} /></Field>
          <Field label="PAN (optional)"><input pattern="[A-Za-z]{5}\d{4}[A-Za-z]" value={f.pan} onChange={(e) => setF({ ...f, pan: e.target.value })} /></Field>
        </div>
        <div><Button type="submit" variant="secondary" loading={busy}>{a.payoutDetails ? 'Update bank details' : 'Save bank details'}</Button></div>
      </form>
    </Card>
  );
}
