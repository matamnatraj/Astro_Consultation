import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth, useAsync, useT, Card, Button, Field, Spinner, ErrorBox, Alert, fmtDate } from '@astro/shared';

const EMPTY = { source: 'manual', birthProfileId: '', name: '', birthDate: '', birthTime: '', unknownTime: false, place: null };
// Same thresholds as the server's verdict, so the label shows in the app language.
export const verdictKey = (total) => (total >= 33 ? 'match.excellent' : total >= 25 ? 'match.veryGood' : total >= 18 ? 'match.average' : 'match.notRecommended');
const scoreTone = (total) => (total >= 25 ? 'var(--ok)' : total >= 18 ? 'var(--accent)' : 'var(--bad)');
const ready = (p) => (p.source === 'saved' ? !!p.birthProfileId : !!(p.name.trim() && p.birthDate && (p.unknownTime || p.birthTime) && p.place));
const toBody = (p) => (p.source === 'saved' ? { birthProfileId: p.birthProfileId } : {
  name: p.name.trim(), birthDate: p.birthDate, birthTime: p.unknownTime ? null : p.birthTime, timeAccuracy: p.unknownTime ? 'unknown' : 'exact',
  placeName: p.place.label, latitude: p.place.latitude, longitude: p.place.longitude, tzName: p.place.tzName,
});

function PlaceSearch({ value, onChange, label }) {
  const { api } = useAuth();
  const t = useT();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  useEffect(() => {
    if (q.length < 2) { setResults([]); return undefined; }
    const h = setTimeout(() => api.get(`/places?q=${encodeURIComponent(q)}`).then(setResults).catch(() => {}), 250);
    return () => clearTimeout(h);
  }, [q, api]);
  if (value) {
    return (
      <div className="summary-box row between">
        <span><strong>{value.label}</strong><span className="tiny muted"> · {value.tzName}</span></span>
        <button type="button" className="link small" onClick={() => onChange(null)} aria-label={`${label}: ${t('match.change')}`}>{t('match.change')}</button>
      </div>
    );
  }
  return (
    <div className="stack-s">
      <input placeholder={t('match.searchCity')} value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" aria-label={label} />
      {results.length > 0 && <div className="card">{results.slice(0, 6).map((p) => (
        <button key={p.label} type="button" className="notif" onClick={() => { onChange(p); setQ(''); setResults([]); }}>
          <div className="notif-title">{p.label}</div><div className="notif-time">{p.tzName}</div>
        </button>
      ))}</div>}
    </div>
  );
}

function PersonForm({ side, value, onChange, profiles }) {
  const t = useT();
  const set = (patch) => onChange({ ...value, ...patch });
  const title = t(side === 'boy' ? 'match.boy' : 'match.girl');
  return (
    <Card title={<span className="row gap-s"><span className={`match-side ${side}`}>{side === 'boy' ? '♂' : '♀'}</span>{title}</span>}>
      <div className="stack">
        {profiles.length > 0 && (
          <div className="segmented" role="radiogroup" aria-label={title}>
            <button type="button" className={value.source === 'manual' ? 'active' : ''} onClick={() => set({ source: 'manual' })}>{t('match.enterDetails')}</button>
            <button type="button" className={value.source === 'saved' ? 'active' : ''} onClick={() => set({ source: 'saved' })}>{t('match.useSaved')}</button>
          </div>
        )}
        {value.source === 'saved' ? (
          <div className="stack-s">{profiles.map((p) => (
            <label key={p.birthProfileId} className="check">
              <input type="radio" name={`${side}-bp`} checked={value.birthProfileId === p.birthProfileId} onChange={() => set({ birthProfileId: p.birthProfileId })} />
              <span><strong>{p.fullName}</strong> <span className="muted small">({p.label}) · {fmtDate(p.birthDate)} {p.birthTime?.slice(0, 5) || t('match.timeUnknown')} · {p.placeName}</span></span>
            </label>
          ))}</div>
        ) : (
          <>
            <Field label={t('match.name')}><input value={value.name} onChange={(e) => set({ name: e.target.value })} placeholder={t('match.enterName')} aria-label={`${title}: ${t('match.name')}`} /></Field>
            <div className="form-grid">
              <Field label={t('match.birthDate')}><input type="date" value={value.birthDate} max={new Date().toISOString().slice(0, 10)} min="1800-01-01" onChange={(e) => set({ birthDate: e.target.value })} aria-label={`${title}: ${t('match.birthDate')}`} /></Field>
              {!value.unknownTime && <Field label={t('match.birthTime')}><input type="time" value={value.birthTime} onChange={(e) => set({ birthTime: e.target.value })} aria-label={`${title}: ${t('match.birthTime')}`} /></Field>}
            </div>
            <label className="check small"><input type="checkbox" checked={value.unknownTime} onChange={(e) => set({ unknownTime: e.target.checked })} /> {t('match.dontKnow')}</label>
            {value.unknownTime && <Alert tone="warn">{t('match.timeNote')}</Alert>}
            <Field label={t('match.birthPlace')}><PlaceSearch value={value.place} onChange={(place) => set({ place })} label={`${title}: ${t('match.birthPlace')}`} /></Field>
          </>
        )}
      </div>
    </Card>
  );
}

export default function Matching() {
  const { api } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const profiles = useAsync(() => api.get('/clients/me/birth-profiles'), []);
  const recent = useAsync(() => api.get('/matching'), []);
  const [boy, setBoy] = useState(EMPTY);
  const [girl, setGirl] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const submit = async () => {
    setBusy(true); setErr(null);
    try { const m = await api.post('/matching', { boy: toBody(boy), girl: toBody(girl) }); navigate(`/matching/${m.matchId}`); } catch (e) { setErr(e); setBusy(false); }
  };
  return (
    <div className="stack">
      <div className="page-head"><div><h1>{t('match.title')}</h1><p>{t('match.sub')}</p></div></div>
      {profiles.loading ? <Spinner /> : (
        <div className="grid-2">
          <PersonForm side="boy" value={boy} onChange={setBoy} profiles={profiles.data || []} />
          <PersonForm side="girl" value={girl} onChange={setGirl} profiles={profiles.data || []} />
        </div>
      )}
      <ErrorBox error={err} />
      <div><Button size="lg" disabled={!ready(boy) || !ready(girl)} loading={busy} onClick={submit}>♥ {t('match.cta')}</Button></div>
      <Card title={t('match.recent')}>
        {recent.loading ? <Spinner /> : !recent.data?.length ? <p className="muted">{t('match.empty')}</p> : (
          <div className="list">{recent.data.map((m) => (
            <Link key={m.matchId} to={`/matching/${m.matchId}`} className="list-item" style={{ color: 'inherit' }} aria-label={`${m.boy.name} & ${m.girl.name}, ${m.total} / 36`}>
              <span className="match-mini" style={{ borderColor: scoreTone(m.total), color: scoreTone(m.total) }}>{m.total}</span>
              <div className="grow"><strong>{m.boy.name} & {m.girl.name}</strong><div className="small muted">{t(verdictKey(m.total))} · {fmtDate(m.createdAt)}</div></div>
              <span className="muted">›</span>
            </Link>
          ))}</div>
        )}
      </Card>
    </div>
  );
}

function ScoreRing({ total, max = 36 }) {
  const size = 150; const stroke = 12; const r = (size - stroke) / 2; const len = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${total} / ${max}`}>
      <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--surface-2)" strokeWidth={stroke} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={scoreTone(total)} strokeWidth={stroke} fill="none" strokeLinecap="round"
        strokeDasharray={`${(len * total) / max} ${len}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="48%" textAnchor="middle" fontSize="36" fontWeight="700" fill={scoreTone(total)}>{total}</text>
      <text x="50%" y="66%" textAnchor="middle" fontSize="14" fill="var(--muted)">/ {max}</text>
    </svg>
  );
}

function PersonSummary({ p, side, manglik }) {
  const t = useT();
  return (
    <Card>
      <div className="stack-s">
        <div className="row gap-s"><span className={`match-side ${side}`}>{side === 'boy' ? '♂' : '♀'}</span><strong>{p.name}</strong></div>
        <div className="small muted">{fmtDate(p.birthDate)}{p.birthTime ? `, ${p.birthTime.slice(0, 5)}` : ''} · {p.placeName}</div>
        <div className="small">☾ {p.moonSign} · {p.nakshatra}{p.lagna ? ` · ${t('match.lagna')} ${p.lagna}` : ''}</div>
        <div><span className={`badge ${manglik.isManglik ? 'tone-bad' : 'tone-ok'}`}>{t(manglik.isManglik ? 'match.isManglik' : 'match.notManglik')}</span></div>
      </div>
    </Card>
  );
}

export function MatchResult() {
  const { id } = useParams();
  const { api } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const m = useAsync(() => api.get(`/matching/${id}`), [id]);
  if (m.loading) return <Spinner />;
  if (m.error) return <ErrorBox error={m.error} onRetry={m.reload} />;
  const x = m.data;
  const remove = async () => {
    if (!window.confirm(t('match.deleteQ'))) return;
    await api.del(`/matching/${id}`);
    navigate('/matching');
  };
  return (
    <div className="stack">
      <div className="row between"><Link to="/matching" className="small">← {t('match.title')}</Link><button className="link small bad" onClick={remove}>{t('match.delete')}</button></div>
      <Card>
        <div className="match-score">
          <ScoreRing total={x.total} max={x.max} />
          <div>
            <h1 style={{ color: scoreTone(x.total) }}>{t(verdictKey(x.total))}</h1>
            <p className="muted">{t('match.gunas', { n: x.total })}</p>
            <p className="small muted">{x.note}</p>
          </div>
        </div>
      </Card>
      <div className="grid-2">
        <PersonSummary p={x.boy} side="boy" manglik={x.manglik.boy} />
        <PersonSummary p={x.girl} side="girl" manglik={x.manglik.girl} />
      </div>
      <Card title={t('match.breakdown')}>
        <div className="list">{x.kootas.map((k) => {
          const pct = k.max ? k.points / k.max : 0;
          const tone = pct >= 0.75 ? 'var(--ok)' : pct >= 0.4 ? 'var(--accent)' : 'var(--bad)';
          return (
            <div key={k.key} className="koota" aria-label={`${k.name}: ${k.points} / ${k.max}`}>
              <div className="row between"><span><strong>{k.name}</strong> <span className="small muted">· {t(`koota.${k.key}`)}</span></span><strong style={{ color: tone }}>{k.points} <span className="muted small">/ {k.max}</span></strong></div>
              <div className="koota-bar"><span style={{ width: `${pct * 100}%`, background: tone }} /></div>
              <div className="tiny muted">{k.boy} · {k.girl}</div>
            </div>
          );
        })}</div>
      </Card>
      <div className="grid-2">
        <Card title={t('match.doshas')}>
          {x.doshas.length ? <div className="stack-s">{x.doshas.map((d) => <div key={d.key}><strong className="bad">⚠ {d.name}</strong><div className="small muted">{d.detail}</div></div>)}</div>
            : <p className="small">✓ {t('match.noDoshas')}</p>}
        </Card>
        <Card title={t('match.manglik')}><p className="small">{x.manglik.verdict}</p></Card>
      </div>
      {x.warnings?.map((w) => <Alert key={w} tone="warn">{w}</Alert>)}
      <div><Link className="btn btn-primary" to="/astrologers?specialty=Kundli%20Matching">{t('match.ask')}</Link></div>
    </div>
  );
}
