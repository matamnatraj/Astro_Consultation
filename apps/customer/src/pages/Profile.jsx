import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth, useAsync, Card, Button, Field, Modal, Spinner, ErrorBox, Badge, Alert, useToast, fmtDate, fmtDateTime, titleCase } from '@astro/shared';

export default function Profile() {
  const { api, logout } = useAuth();
  const [params, setParams] = useSearchParams();
  const profile = useAsync(() => api.get('/clients/me'), []);
  const births = useAsync(() => api.get('/clients/me/birth-profiles'), []);
  const consents = useAsync(() => api.get('/consents'), []);
  const [editing, setEditing] = useState(null); // null | 'new' | birthProfile
  const [toast, showToast] = useToast();

  useEffect(() => { if (params.get('add')) { setEditing('new'); setParams({}, { replace: true }); } }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="stack">
      <div className="page-head"><div><h1>Profile & charts</h1><p>Your details are saved to your account and available on any device.</p></div></div>
      {profile.loading ? <Spinner /> : <PersonalCard profile={profile.data} onSaved={(p) => { profile.setData((d) => ({ ...d, ...p })); showToast('Profile saved'); }} />}

      <Card title="Birth profiles" actions={<Button size="sm" onClick={() => setEditing('new')}>+ Add</Button>}>
        {births.loading ? <Spinner /> : births.data.length === 0 ? (
          <div className="stack-s"><p className="muted">No birth details yet. Add yours (and family members') to get a chart and share it with astrologers.</p></div>
        ) : (
          <div className="list">
            {births.data.map((b) => (
              <div key={b.birthProfileId} className="list-item">
                <div className="grow">
                  <strong>{b.fullName}</strong> <span className="chip">{b.label}</span>{b.isPrimary && <Badge tone="info">Primary</Badge>}
                  <div className="small muted">{fmtDate(b.birthDate)} · {b.birthTime ? b.birthTime.slice(0, 5) : 'Time unknown'}{b.timeAccuracy === 'approximate' && ' (approx.)'} · {b.placeName}</div>
                  <div className="tiny muted">Version {b.version} · updated {fmtDateTime(b.updatedAt)}</div>
                </div>
                <div className="row gap-s">
                  {b.latestChart ? <Badge status={b.latestChart.status}>{b.latestChart.status === 'stale' ? 'Chart outdated' : 'Chart ready'}</Badge> : <Badge tone="muted">No chart</Badge>}
                  <Link className="btn btn-secondary btn-sm" to={`/charts/${b.birthProfileId}`}>View chart</Link>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(b)}>Edit</Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Privacy & data">
        <div className="stack">
          <p className="small muted">Your birth details are shown only to the astrologer assigned to an accepted consultation, and every access is logged. Birth details and message contents are never shown in push notification previews.</p>
          <div className="row wrap gap-s">
            <Button variant="secondary" size="sm" onClick={() => api.download('/clients/me/export', 'my-data.json')}>Download my data</Button>
            <DeletionButton onDone={(n) => showToast(`Deletion request #${n} submitted`)} />
            <Button variant="ghost" size="sm" onClick={logout}>Sign out</Button>
          </div>
          <details>
            <summary className="small">Notices you've accepted</summary>
            <div className="table-wrap mt"><table className="table compact small">
              <thead><tr><th>Notice</th><th>Version</th><th>Context</th><th>Accepted</th></tr></thead>
              <tbody>{consents.data?.map((c, i) => <tr key={i}><td>{titleCase(c.notice_type)}</td><td>v{c.notice_version}</td><td>{c.context}</td><td>{fmtDateTime(c.accepted_at)}</td></tr>)}</tbody>
            </table></div>
          </details>
        </div>
      </Card>

      {editing && (
        <BirthProfileModal
          initial={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(r) => {
            setEditing(null);
            births.reload();
            profile.reload();
            showToast(r.chartAffected ? 'Saved. Your chart is now out of date — open it to regenerate.' : 'Birth profile saved', r.chartAffected ? 'info' : 'ok');
          }}
        />
      )}
      {toast}
    </div>
  );
}

function PersonalCard({ profile, onSaved }) {
  const { api } = useAuth();
  const [f, setF] = useState({ fullName: profile.fullName || '', gender: profile.gender || '', contactEmail: profile.contactEmail || '', preferredLanguage: profile.preferredLanguage || 'en', notificationPrefs: profile.notificationPrefs });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try { onSaved(await api.put('/clients/me', { ...f, gender: f.gender || null, contactEmail: f.contactEmail || null })); } catch (x) { setErr(x); } finally { setBusy(false); }
  };
  return (
    <Card title="Personal details">
      <form onSubmit={save} className="stack">
        <ErrorBox error={err} />
        <div className="form-grid">
          <Field label="Full name"><input required value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></Field>
          <Field label="Gender"><select value={f.gender} onChange={(e) => setF({ ...f, gender: e.target.value })}>
            <option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="non_binary">Non-binary</option></select></Field>
          <Field label="Email (for receipts)"><input type="email" value={f.contactEmail} onChange={(e) => setF({ ...f, contactEmail: e.target.value })} /></Field>
          <Field label="Preferred language"><select value={f.preferredLanguage} onChange={(e) => setF({ ...f, preferredLanguage: e.target.value })}>
            <option value="en">English</option><option value="hi">हिन्दी</option><option value="ta">தமிழ்</option><option value="te">తెలుగు</option><option value="mr">मराठी</option><option value="bn">বাংলা</option></select></Field>
        </div>
        <div className="row wrap"><span className="field-label">Notify me by</span>
          {['push', 'email', 'sms'].map((ch) => (
            <label key={ch} className="check small"><input type="checkbox" checked={!!f.notificationPrefs?.[ch]} onChange={(e) => setF({ ...f, notificationPrefs: { ...f.notificationPrefs, [ch]: e.target.checked } })} /> {ch.toUpperCase()}</label>
          ))}
        </div>
        <div><Button type="submit" loading={busy}>Save</Button></div>
      </form>
    </Card>
  );
}

function DeletionButton({ onDone }) {
  const { api } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} style={{ color: 'var(--bad)' }}>Request account deletion</Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Request account deletion" footer={<Button variant="danger" loading={busy} onClick={async () => { setBusy(true); const r = await api.post('/clients/me/deletion-request', { reason: reason || undefined }); setBusy(false); setOpen(false); onDone(r.ticketNumber); }}>Submit request</Button>}>
        <p className="small">Our team will process your request within 72 hours. Some records (such as payment and tax records) must be retained for legal periods; everything else is deleted or anonymised.</p>
        <Field label="Reason (optional)"><textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      </Modal>
    </>
  );
}

const TIMEZONES = ['Asia/Kolkata', 'Asia/Kathmandu', 'Asia/Colombo', 'Asia/Dhaka', 'Asia/Karachi', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Toronto', 'Australia/Sydney', 'Australia/Melbourne'];

export function BirthProfileModal({ initial, onClose, onSaved }) {
  const { api } = useAuth();
  const [f, setF] = useState(() => initial ? {
    label: initial.label, fullName: initial.fullName, gender: initial.gender || '', birthDate: initial.birthDate,
    birthTime: initial.birthTime?.slice(0, 5) || '', timeAccuracy: initial.timeAccuracy, timeSource: initial.timeSource || '',
    placeName: initial.placeName, latitude: initial.latitude, longitude: initial.longitude, tzName: initial.tzName, placeConfirmed: initial.placeConfirmed, isPrimary: initial.isPrimary,
  } : { label: 'Self', fullName: '', gender: '', birthDate: '', birthTime: '', timeAccuracy: 'exact', timeSource: '', placeName: '', latitude: '', longitude: '', tzName: 'Asia/Kolkata', placeConfirmed: false, isPrimary: false });
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  useEffect(() => {
    if (q.length < 2) { setResults([]); return undefined; }
    const t = setTimeout(() => api.get(`/places?q=${encodeURIComponent(q)}`).then(setResults).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q, api]);

  const chartFieldsChanged = initial && (f.birthDate !== initial.birthDate || (f.birthTime || '') !== (initial.birthTime?.slice(0, 5) || '') || f.timeAccuracy !== initial.timeAccuracy
    || Number(f.latitude) !== initial.latitude || Number(f.longitude) !== initial.longitude || f.tzName !== initial.tzName);

  const save = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const body = { ...f, gender: f.gender || null, birthTime: f.timeAccuracy === 'unknown' ? null : f.birthTime, timeSource: f.timeSource || null, latitude: Number(f.latitude), longitude: Number(f.longitude) };
      const r = initial ? await api.put(`/clients/me/birth-profiles/${initial.birthProfileId}`, body) : await api.post('/clients/me/birth-profiles', body);
      onSaved(r);
    } catch (x) { setErr(x); setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm('Remove this birth profile? Past consultations keep their records.')) return;
    await api.del(`/clients/me/birth-profiles/${initial.birthProfileId}`);
    onSaved({});
  };

  return (
    <Modal open wide onClose={onClose} title={initial ? `Edit ${initial.fullName}` : 'Add birth details'}
      footer={<>{initial && <Button variant="ghost" onClick={remove} style={{ marginRight: 'auto', color: 'var(--bad)' }}>Remove</Button>}<Button variant="ghost" onClick={onClose}>Cancel</Button><Button form="bpform" type="submit" loading={busy} disabled={!f.latitude || !f.placeConfirmed}>Save</Button></>}>
      <form id="bpform" onSubmit={save} className="stack">
        <ErrorBox error={err} />
        <div className="form-grid">
          <Field label="Full name"><input required value={f.fullName} onChange={set('fullName')} /></Field>
          <Field label="Relationship"><select value={f.label} onChange={set('label')}>{['Self', 'Spouse', 'Child', 'Parent', 'Sibling', 'Friend', 'Other'].map((l) => <option key={l}>{l}</option>)}</select></Field>
          <Field label="Gender"><select value={f.gender} onChange={set('gender')}><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option><option value="non_binary">Non-binary</option></select></Field>
        </div>
        <div className="form-grid">
          <Field label="Date of birth"><input type="date" required value={f.birthDate} max={new Date().toISOString().slice(0, 10)} min="1800-01-01" onChange={set('birthDate')} /></Field>
          <Field label="Time accuracy"><select value={f.timeAccuracy} onChange={set('timeAccuracy')}>
            <option value="exact">Exact (certificate/records)</option><option value="approximate">Approximate</option><option value="unknown">I don't know</option></select></Field>
          {f.timeAccuracy !== 'unknown' && <Field label="Time of birth (local)"><input type="time" required value={f.birthTime} onChange={set('birthTime')} /></Field>}
          {f.timeAccuracy !== 'unknown' && <Field label="Source of time (optional)"><input value={f.timeSource} onChange={set('timeSource')} placeholder="e.g. birth certificate" /></Field>}
        </div>
        {f.timeAccuracy !== 'exact' && <Alert tone="warn">Without an exact time, the ascendant (lagna), houses and dasha dates may be inaccurate. Astrologers will see this warning.</Alert>}

        <div className="stack-s">
          <span className="field-label">Place of birth</span>
          {f.placeName && !manual ? (
            <div className="summary-box">
              <div className="row between wrap"><div><strong>{f.placeName}</strong><div className="small muted">{Number(f.latitude).toFixed(4)}, {Number(f.longitude).toFixed(4)} · {f.tzName}</div></div>
                <Button size="sm" variant="ghost" onClick={() => setF({ ...f, placeName: '', placeConfirmed: false })}>Change</Button></div>
              <label className="check small mt"><input type="checkbox" checked={f.placeConfirmed} onChange={set('placeConfirmed')} /> I confirm this location and time zone are correct</label>
            </div>
          ) : !manual ? (
            <>
              <input placeholder="Search city…" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
              {results.length > 0 && <div className="card">{results.map((p) => (
                <button key={p.label} type="button" className="notif" onClick={() => { setF({ ...f, placeName: p.label, latitude: p.latitude, longitude: p.longitude, tzName: p.tzName, placeConfirmed: false }); setQ(''); setResults([]); }}>
                  <div className="notif-title">{p.label}</div><div className="notif-time">{p.latitude}, {p.longitude} · {p.tzName}</div></button>
              ))}</div>}
              <button type="button" className="link small" onClick={() => setManual(true)}>Can't find it? Enter coordinates manually</button>
            </>
          ) : (
            <div className="stack-s">
              <div className="form-grid">
                <Field label="Place name"><input required value={f.placeName} onChange={set('placeName')} /></Field>
                <Field label="Latitude" hint="North positive"><input type="number" step="0.0001" min="-90" max="90" required value={f.latitude} onChange={set('latitude')} /></Field>
                <Field label="Longitude" hint="East positive"><input type="number" step="0.0001" min="-180" max="180" required value={f.longitude} onChange={set('longitude')} /></Field>
                <Field label="Time zone"><select value={f.tzName} onChange={set('tzName')}>{TIMEZONES.map((t) => <option key={t}>{t}</option>)}</select></Field>
              </div>
              <label className="check small"><input type="checkbox" checked={f.placeConfirmed} onChange={set('placeConfirmed')} /> I confirm these coordinates and time zone are correct</label>
              <button type="button" className="link small" onClick={() => setManual(false)}>Search instead</button>
            </div>
          )}
          <span className="field-hint">The historical UTC offset for your birth date is calculated automatically (including daylight saving and war time).</span>
        </div>
        <label className="check small"><input type="checkbox" checked={!!f.isPrimary} onChange={set('isPrimary')} /> Use as my default profile for bookings</label>
        {chartFieldsChanged && <Alert tone="info">Changing date, time or place will mark the existing chart as out of date. Earlier versions are kept in history.</Alert>}
      </form>
    </Modal>
  );
}
