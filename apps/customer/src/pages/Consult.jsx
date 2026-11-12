import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth, useAsync, useT, Modal, Spinner, ErrorBox, rupees, fmtTime } from '@astro/shared';
import { Icon, AstroAvatar, useWallet, useAppConfig } from '../brand.jsx';

const DURATIONS = [5, 10, 15, 20, 30];

/** Consultation setup, paid from the wallet: the amount is held and only used minutes are charged. */
export default function Consult() {
  const { astrologerId } = useParams();
  const [params] = useSearchParams();
  const { api } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const cfg = useAppConfig();
  const [balance, refreshWallet] = useWallet();
  const a = useAsync(() => api.get(`/astrologers/${astrologerId}`), [astrologerId]);
  const profiles = useAsync(() => api.get('/clients/me/birth-profiles'), []);
  const [mode, setMode] = useState(params.get('mode') === 'voice' ? 'voice' : 'chat');
  const [duration, setDuration] = useState(10);
  const [when, setWhen] = useState(null);
  const [slotId, setSlotId] = useState(null);
  const [bpId, setBpId] = useState(null);
  const [topic, setTopic] = useState('');
  const [policyOpen, setPolicyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const idempotencyKey = useMemo(() => `w-${crypto.randomUUID()}`, []);
  const quote = useAsync(() => api.get(`/bookings/quote?astrologerId=${astrologerId}&mode=${mode}&durationMinutes=${duration}&paymentMethod=wallet`), [astrologerId, mode, duration]);

  if (a.loading || profiles.loading) return <Spinner />;
  if (a.error) return <ErrorBox error={a.error} />;
  const x = a.data;
  const canNow = x.isOnline && !x.isBusy;
  const type = when || (canNow ? 'now' : 'scheduled');
  const slot = x.slots.find((s) => s.slotId === slotId);
  const maxDuration = type === 'scheduled' && slot ? (new Date(slot.endAt) - new Date(slot.startAt)) / 60000 : 120;
  const bp = bpId || profiles.data.find((p) => p.isPrimary)?.birthProfileId || profiles.data[0]?.birthProfileId;
  const q = quote.data;
  const payable = q?.payablePaise ?? 0;
  const wallet = q?.walletBalancePaise ?? balance ?? 0;
  const shortfall = Math.max(0, payable - wallet);
  const callEnabled = cfg.enabledModes.includes('voice') && x.modes.includes('voice');
  const ready = q && bp && (type === 'now' ? canNow : slot) && duration <= maxDuration;
  const slotsByDay = [...x.slots.reduce((m, s) => { const d = new Date(s.startAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }); if (!m.has(d)) m.set(d, []); m.get(d).push(s); return m; }, new Map())];

  const confirm = async () => {
    if (shortfall > 0) { navigate(`/wallet?add=${Math.ceil(shortfall / 100)}&back=${encodeURIComponent(`/consult/${astrologerId}?mode=${mode}`)}`); return; }
    setBusy(true); setErr(null);
    try {
      const b = await api.post('/bookings', {
        astrologerId, birthProfileId: bp, mode, bookingType: type === 'now' ? 'instant' : 'scheduled', slotId: type === 'scheduled' ? slotId : undefined,
        durationMinutes: duration, topic: topic || undefined, acceptedCancellationPolicyVersion: q.cancellationPolicy.version, idempotencyKey, paymentMethod: 'wallet',
      });
      refreshWallet();
      const detail = await api.get(`/bookings/${b.bookingId}`);
      navigate(detail.consultation ? `/consultations/${detail.consultation.consultationId}` : `/bookings/${b.bookingId}`, { replace: true });
    } catch (e) {
      setErr(e); setBusy(false);
      if (['insufficient_balance', 'policy_changed'].includes(e.details?.code)) quote.reload();
    }
  };
  const ctaLabel = shortfall > 0 ? t('consult.addToWallet', { amt: rupees(shortfall) }) : t(type === 'now' ? (mode === 'voice' ? 'consult.confirmCall' : 'consult.confirmChat') : 'consult.bookSlot');

  return (
    <div className="layout-side">
      <div className="full"><Link to={`/astrologers/${astrologerId}`} className="small row gap-s"><Icon name="left" size={16} />{x.displayName}</Link></div>
      <div className="stack" style={{ gap: 18, minWidth: 0 }}>
        <div className="row" style={{ gap: 14 }}>
          <AstroAvatar name={x.displayName} size={60} online={x.isOnline} />
          <div className="grow"><strong style={{ fontSize: 18 }}>{x.displayName}</strong>
            <div className="small" style={{ color: 'var(--text-2)' }}>{x.specialties.slice(0, 2).join(', ')} • {t('common.yrsExp', { n: x.experienceYears })}</div>
            <div className="small"><span style={{ color: 'var(--accent)' }}>★</span> <strong>{x.ratingCount ? x.ratingAvg.toFixed(1) : t('common.new')}</strong> <span className="muted">({t('common.reviews', { n: x.ratingCount })})</span></div></div>
        </div>

        <h3 style={{ margin: 0 }}>{t('consult.mode')}</h3>
        <div className="row" style={{ gap: 12, alignItems: 'stretch' }}>
          <button type="button" className={`av-mode ${mode === 'chat' ? 'active' : ''}`} onClick={() => setMode('chat')} aria-pressed={mode === 'chat'}>
            {mode === 'chat' && <span className="tag">ACTIVE</span>}<span className="ico"><Icon name="chat" /></span><strong>{t('common.chat')}</strong><span className="small muted">{rupees(x.rates.chat)}/min</span>
          </button>
          <button type="button" className={`av-mode ${mode === 'voice' ? 'active' : ''}`} onClick={() => setMode('voice')} disabled={!callEnabled} aria-pressed={mode === 'voice'}>
            <span className="ico"><Icon name="phone" /></span><strong>{t('consult.audio')}</strong><span className="small muted">{callEnabled ? `${rupees(x.rates.voice)}/min` : t('consult.soon')}</span>
          </button>
        </div>

        {(!canNow || x.slots.length > 0) && (
          <div className="stack-s">
            <div className="segmented" role="radiogroup">
              <button type="button" className={type === 'now' ? 'active' : ''} disabled={!canNow} onClick={() => setWhen('now')}>⚡ {t('consult.now')}</button>
              <button type="button" className={type === 'scheduled' ? 'active' : ''} onClick={() => setWhen('scheduled')}>📅 {t('consult.schedule')}</button>
            </div>
            {type === 'now' && !canNow && <span className="small" style={{ color: 'var(--warn)' }}>{t(x.isBusy ? 'consult.busyNow' : 'consult.offline', { name: x.displayName })}</span>}
            {type === 'scheduled' && (slotsByDay.length ? slotsByDay.map(([day, list]) => (
              <div key={day}><div className="field-label">{day}</div>
                <div className="chips">{list.map((s) => <button type="button" key={s.slotId} className={`chip ${slotId === s.slotId ? 'active' : ''}`} onClick={() => { setSlotId(s.slotId); setDuration((d) => Math.min(d, (new Date(s.endAt) - new Date(s.startAt)) / 60000)); }}>{fmtTime(s.startAt)}</button>)}</div></div>
            )) : <span className="small muted">{t('book.noSlots')}</span>)}
          </div>
        )}

        <div className="row between"><h3 style={{ margin: 0 }}>{t('consult.duration')}</h3><span className="small muted">{t('consult.extendable')}</span></div>
        <div className="av-durations" role="radiogroup">{DURATIONS.filter((d) => d <= maxDuration).slice(0, 4).map((d) => (
          <button key={d} type="button" role="radio" aria-checked={duration === d} className={duration === d ? 'active' : ''} onClick={() => setDuration(d)}>{t('common.min', { n: d })}</button>
        ))}</div>

        <div className="av-card" style={{ gap: 6 }}>
          <strong className="row gap-s"><Icon name="kundli" size={18} style={{ color: 'var(--primary)' }} />{t('consult.kundliShared')}</strong>
          {profiles.data.length === 0 ? (
            <div className="row between wrap"><span className="small muted">{t('book.addBirthNote')}</span><Link className="btn btn-primary btn-sm" to="/account?add=1">{t('consult.addBirth')}</Link></div>
          ) : profiles.data.map((p) => (
            <label key={p.birthProfileId} className="check">
              <input type="radio" name="bp" checked={bp === p.birthProfileId} onChange={() => setBpId(p.birthProfileId)} />
              <span><strong>{p.fullName}</strong> <span className="muted small">({p.label}) · {p.birthDate} {p.birthTime?.slice(0, 5) || t('match.timeUnknown')} · {p.placeName}</span></span>
            </label>
          ))}
          <label className="field mt"><span className="field-label">{t('book.topic')}</span><textarea rows={2} value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={300} placeholder={t('book.topicPh')} /></label>
        </div>
      </div>

      <div className="stack sticky" style={{ gap: 14 }}>
        <div className="av-card" style={{ gap: 2 }}>
          {!q ? <Spinner /> : (
            <>
              <div className="av-row"><span>{t('consult.rate')}</span><span>{rupees(q.ratePaise)} / min</span></div>
              <div className="av-row"><span>{t('consult.estDuration')}</span><span>{t('consult.minutesLong', { n: duration })}</span></div>
              <div className="av-row"><span>{t('consult.gross')}</span><span>{rupees(q.amountPaise)}</span></div>
              {q.discountPaise ? <div className="av-row" style={{ color: 'var(--pill-text)', borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 10 }}><span style={{ color: 'inherit' }}>🎁 {q.discountLabel}</span><span>-{rupees(q.discountPaise)}</span></div> : null}
              <div className="av-total" style={{ borderTop: '1px solid var(--border)', marginTop: 6, paddingTop: 10 }}>
                <div><strong style={{ fontSize: 18 }}>{t('consult.payable')}</strong><div className="small muted">{t('consult.refundable')}</div></div>
                <span className="amt">{rupees(payable)}</span>
              </div>
            </>
          )}
        </div>
        <div className="av-card" style={{ flexDirection: 'row', alignItems: 'center', gap: 14, border: '1px solid #E9D9C9', boxShadow: 'none' }}>
          <span className="av-tile" style={{ boxShadow: 'none', padding: 0, background: 'none' }}><span className="ico" style={{ background: '#E5F5EC', color: 'var(--ok)', width: 46, height: 46 }}><Icon name="wallet" /></span></span>
          <div className="grow"><div className="small muted">{t('consult.walletBalance', { wallet: cfg.walletName })}</div><strong style={{ fontSize: 20, color: shortfall ? 'var(--bad)' : 'var(--ok)' }}>{rupees(wallet)}</strong></div>
          <Link to={`/wallet?back=${encodeURIComponent(`/consult/${astrologerId}?mode=${mode}`)}`} className="btn btn-secondary btn-sm">{t('home.add')}</Link>
        </div>
        <ErrorBox error={err} />
        <button type="button" className="btn btn-primary btn-lg btn-block" disabled={!ready || busy} onClick={confirm} aria-label={ctaLabel}>{busy ? t('common.loading') : ctaLabel}</button>
        <p className="tiny muted" style={{ textAlign: 'center' }}>{t('consult.agree')} <button type="button" className="link tiny" onClick={() => setPolicyOpen(true)}>{t('consult.policy')}{q ? ` (v${q.cancellationPolicy.version})` : ''}</button>. {t('consult.onlyUsed')}</p>
      </div>
      <Modal open={policyOpen} onClose={() => setPolicyOpen(false)} title={q?.cancellationPolicy.title || t('consult.policy')}><p className="small" style={{ whiteSpace: 'pre-line' }}>{q?.cancellationPolicy.body}</p></Modal>
    </div>
  );
}
