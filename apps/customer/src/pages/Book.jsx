import { useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth, useAsync, useT, Card, Button, Spinner, ErrorBox, Avatar, Badge, rupees, fmtTime, Alert } from '@astro/shared';

const DURATIONS = [5, 10, 15, 20, 30];

export default function Book() {
  const { astrologerId } = useParams();
  const [params] = useSearchParams();
  const { api } = useAuth();
  const t = useT();
  const astro = useAsync(() => api.get(`/astrologers/${astrologerId}`), [astrologerId]);
  const profiles = useAsync(() => api.get('/clients/me/birth-profiles'), []);
  const [type, setType] = useState(params.get('type') === 'instant' ? 'instant' : 'scheduled');
  const [slotId, setSlotId] = useState(null);
  const [duration, setDuration] = useState(15);
  const [birthProfileId, setBirthProfileId] = useState(null);
  const [topic, setTopic] = useState('');
  const [policyOk, setPolicyOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const idempotencyKey = useMemo(() => `bk-${crypto.randomUUID()}`, []);
  const quote = useAsync(() => api.get(`/bookings/quote?astrologerId=${astrologerId}&mode=chat&durationMinutes=${duration}`), [astrologerId, duration]);

  const slotsByDay = useMemo(() => {
    const m = new Map();
    for (const s of astro.data?.slots || []) {
      const day = new Date(s.startAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
      if (!m.has(day)) m.set(day, []);
      m.get(day).push(s);
    }
    return [...m.entries()];
  }, [astro.data]);

  if (astro.loading || profiles.loading) return <Spinner />;
  if (astro.error) return <ErrorBox error={astro.error} />;
  const a = astro.data;
  const bp = birthProfileId || profiles.data?.find((p) => p.isPrimary)?.birthProfileId || profiles.data?.[0]?.birthProfileId;
  const instantAvailable = a.isOnline && !a.isBusy;
  const slot = a.slots.find((s) => s.slotId === slotId);
  const maxDuration = type === 'scheduled' && slot ? (new Date(slot.endAt) - new Date(slot.startAt)) / 60000 : 120;
  const ready = bp && policyOk && quote.data && (type === 'instant' ? instantAvailable : slot) && duration <= maxDuration;

  const confirm = async () => {
    setBusy(true); setError(null);
    try {
      const booking = await api.post('/bookings', {
        astrologerId, birthProfileId: bp, mode: 'chat', bookingType: type, slotId: type === 'scheduled' ? slotId : undefined,
        durationMinutes: duration, topic: topic || undefined, acceptedCancellationPolicyVersion: quote.data.cancellationPolicy.version, idempotencyKey,
      });
      const co = await api.post('/payments/checkout', { bookingId: booking.bookingId, returnUrl: `${window.location.origin}/bookings/${booking.bookingId}` });
      window.location.assign(co.checkoutUrl); // hosted gateway checkout — card data never touches our app
    } catch (e) {
      setError(e);
      setBusy(false);
      if (e.details?.code === 'policy_changed') quote.reload();
    }
  };

  return (
    <div className="layout-side">
      <div className="full"><Link to={`/astrologers/${astrologerId}`} className="small">← {a.displayName}</Link></div>
      <div className="stack" style={{ minWidth: 0 }}>
        <Card title={`1. ${t('book.when')}`}>
          <div className="stack">
            <div className="segmented" role="radiogroup" aria-label="Booking type">
              <button className={type === 'instant' ? 'active' : ''} onClick={() => setType('instant')} disabled={!instantAvailable} aria-pressed={type === 'instant'}>{t('book.now')}</button>
              <button className={type === 'scheduled' ? 'active' : ''} onClick={() => setType('scheduled')} aria-pressed={type === 'scheduled'}>{t('common.schedule')}</button>
            </div>
            {type === 'instant' && (instantAvailable
              ? <p className="small muted">{t('book.onlineNote', { name: a.displayName })}</p>
              : <Alert tone="warn">{t(a.isBusy ? 'book.busy' : 'book.offline', { name: a.displayName })}</Alert>)}
            {type === 'scheduled' && (slotsByDay.length === 0 ? <p className="muted">{t('book.noSlots')}</p> : slotsByDay.map(([day, slots]) => (
              <div key={day}>
                <div className="field-label">{day}</div>
                <div className="slot-grid">{slots.map((s) => (
                  <button key={s.slotId} className={`slot ${slotId === s.slotId ? 'selected' : ''}`} onClick={() => { setSlotId(s.slotId); setDuration((d) => Math.min(d, (new Date(s.endAt) - new Date(s.startAt)) / 60000)); }}>{fmtTime(s.startAt)}</button>
                ))}</div>
              </div>
            )))}
          </div>
        </Card>
        <Card title={`2. ${t('book.duration')}`}>
          <div className="chips">{DURATIONS.filter((d) => d <= maxDuration).map((d) => (
            <button key={d} className={`chip ${duration === d ? 'active' : ''}`} onClick={() => setDuration(d)}>{t('common.min', { n: d })}</button>
          ))}</div>
          <p className="small muted mt">{t('book.durationNote')}</p>
        </Card>
        <Card title={`3. ${t('book.whose')}`}>
          {profiles.data.length === 0 ? (
            <Alert tone="warn"><span>{t('book.addBirthNote')}</span><Link className="btn btn-primary btn-sm" to="/profile?add=1">{t('home.addBirth')}</Link></Alert>
          ) : (
            <div className="stack-s">
              {profiles.data.map((p) => (
                <label key={p.birthProfileId} className="check">
                  <input type="radio" name="bp" checked={bp === p.birthProfileId} onChange={() => setBirthProfileId(p.birthProfileId)} />
                  <span><strong>{p.fullName}</strong> <span className="muted small">({p.label}) · {p.birthDate} {p.birthTime?.slice(0, 5) || t('match.timeUnknown')} · {p.placeName}</span>
                    {p.latestChart?.status === 'stale' && <Badge tone="warn">{t('book.chartOutdated')}</Badge>}</span>
                </label>
              ))}
              <p className="tiny muted">{t('book.chartPrivacy')}</p>
            </div>
          )}
          <label className="field mt"><span className="field-label">{t('book.topic')}</span>
            <textarea rows={2} value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={300} placeholder={t('book.topicPh')} /></label>
        </Card>
      </div>
      <Card title={t('book.summary')} className="sticky">
        <div className="stack">
          <div className="row"><Avatar name={a.displayName} /><div><strong>{a.displayName}</strong><div className="small muted">{t('book.chatConsult')}</div></div></div>
          {quote.data && (
            <div className="summary-box kv">
              <dt>{t('book.rate')}</dt><dd>{rupees(quote.data.ratePaise)}/min</dd>
              <dt>{t('book.duration')}</dt><dd>{t('common.upTo', { n: duration })}</dd>
              <dt>{t('book.when')}</dt><dd>{type === 'instant' ? t('book.nowShort') : slot ? new Date(slot.startAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</dd>
              <dt><strong>{t('book.authorize')}</strong></dt><dd><strong>{rupees(quote.data.amountPaise)}</strong></dd>
            </div>
          )}
          {quote.data && (
            <details className="notice">
              <summary className="small"><strong>{quote.data.cancellationPolicy.title}</strong> (v{quote.data.cancellationPolicy.version})</summary>
              <div className="notice-body">{quote.data.cancellationPolicy.body}</div>
            </details>
          )}
          <label className="check small"><input type="checkbox" checked={policyOk} onChange={(e) => setPolicyOk(e.target.checked)} /> {t('book.policyOk')}</label>
          <ErrorBox error={error} />
          <Button size="lg" className="btn-block" disabled={!ready} loading={busy} onClick={confirm}>{t('book.continue')}</Button>
          <p className="tiny muted">{t('book.gateway')}</p>
        </div>
      </Card>
    </div>
  );
}
