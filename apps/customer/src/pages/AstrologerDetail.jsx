import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth, useAsync, useT, useToast, Spinner, ErrorBox, rupees, fmtDate } from '@astro/shared';
import { Icon, AstroAvatar, HeartButton, useAppConfig, useFavoriteToggle } from '../brand.jsx';

function Tile({ icon, value, label }) {
  return <div className="av-tile"><span className="ico"><Icon name={icon} size={20} /></span><span className="v">{value}</span><span className="l">{label}</span></div>;
}

export default function AstrologerDetail() {
  const { id } = useParams();
  const { api } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const cfg = useAppConfig();
  const a = useAsync(() => api.get(`/astrologers/${id}`), [id]);
  const [tab, setTab] = useState('about');
  const [toast, show] = useToast();
  const toggleFavorite = useFavoriteToggle(a.setData, show);
  if (a.loading) return <Spinner />;
  if (a.error) return <ErrorBox error={a.error} onRetry={a.reload} />;
  const x = a.data;
  const callEnabled = cfg.enabledModes.includes('voice') && x.modes.includes('voice');
  return (
    <div className="stack" style={{ gap: 16, maxWidth: 760, margin: '0 auto', width: '100%' }}>
      <Link to="/astrologers" className="small row gap-s"><Icon name="left" size={16} />{t('detail.all')}</Link>
      <div className="stack-s" style={{ alignItems: 'center', textAlign: 'center' }}>
        <div style={{ position: 'relative', padding: 8, borderRadius: '50%', background: '#FBE6D3' }}>
          <AstroAvatar name={x.displayName} size={112} online={x.isOnline} label />
          <span style={{ position: 'absolute', top: 2, right: -4, background: '#fff', borderRadius: '50%', boxShadow: 'var(--shadow)', width: 40, height: 40, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <HeartButton active={x.isFavorite} onClick={() => toggleFavorite(x)} label={`Favourite ${x.displayName}`} />
          </span>
        </div>
        <h1 className="av-h1 row gap-s" style={{ marginTop: 10, justifyContent: 'center' }}>{x.displayName}{x.verified && <Icon name="badge" size={22} style={{ color: 'var(--primary)' }} />}</h1>
        <div style={{ color: 'var(--text-2)' }}>{x.specialties.slice(0, 3).join(' • ')}</div>
        <span className="av-rating" style={{ fontSize: 14 }}><span className="star">★</span>{x.ratingCount ? x.ratingAvg.toFixed(1) : t('common.new')} <span className="muted" style={{ fontWeight: 400 }}>({t('common.reviews', { n: x.ratingCount })})</span></span>
      </div>
      <div className="av-tiles">
        <Tile icon="shield" value={t('x.yearsPlus', { n: x.experienceYears })} label={t('x.experience')} />
        <Tile icon="chat" value={`${x.consultations ?? 0}+`} label={t('x.consultations')} />
        <Tile icon="globe" value={x.languages.length} label={t('x.languages')} />
      </div>
      <div className="av-pilltabs" role="tablist">
        {[['about', t('x.about')], ['reviews', t('x.reviewsTab')], ['services', t('x.services')]].map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={tab === v} className={tab === v ? 'active' : ''} onClick={() => setTab(v)}>{l}</button>)}
      </div>
      <div className="av-card">
        {tab === 'about' ? (
          <>
            <strong className="row gap-s" style={{ fontSize: 17 }}><Icon name="star" size={18} style={{ color: 'var(--primary)' }} />{t('x.aboutName', { name: x.displayName.split(' ').slice(0, 2).join(' ') })}</strong>
            <p style={{ color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-line', margin: 0 }}>{x.bio}</p>
            <span className="small muted">{t('x.languages')}: {x.languages.join(', ')}</span>
          </>
        ) : tab === 'reviews' ? (
          <>
            {x.topTags?.length > 0 && <div className="chips">{x.topTags.map((tg) => <span key={tg.tag} className="chip active">✓ {tg.tag} · {tg.count}</span>)}</div>}
            {!x.reviews.length ? <p className="muted">{t('detail.noReviews')}</p> : x.reviews.map((r, i) => (
              <div key={i} style={{ borderTop: i ? '1px solid var(--border)' : 0, paddingTop: i ? 10 : 0 }}>
                <div className="row between"><strong>{r.reviewer}</strong><span className="tiny muted">{fmtDate(r.created_at)}</span></div>
                <div style={{ color: 'var(--accent)' }}>{'★'.repeat(r.rating)}<span style={{ color: '#E9D9C9' }}>{'★'.repeat(5 - r.rating)}</span></div>
                {r.comment && <p className="small" style={{ color: 'var(--text-2)', margin: '4px 0 0' }}>{r.comment}</p>}
              </div>
            ))}
          </>
        ) : (
          <>
            <div className="chips">{[...x.specialties, ...x.services].map((s) => <span key={s} className="chip">{s}</span>)}</div>
            {x.modes.map((m) => <div key={m} className="av-row"><span>{t(`mode.${m}`)}</span><strong>{rupees(x.rates[m])}/min</strong></div>)}
            <span className="small muted">{t('detail.slots', { n: x.slots.length })}</span>
          </>
        )}
      </div>
      <div className="row" style={{ gap: 12 }}>
        <button type="button" className="av-soft filled" disabled={x.isBusy} onClick={() => navigate(`/consult/${x.astrologerId}?mode=chat`)} aria-label={`${t('common.chat')} · ${rupees(x.rates.chat)}/min`}><Icon name="chat" size={18} />{x.isBusy ? t('common.busy') : `${t('common.chat')} · ${rupees(x.rates.chat)}/min`}</button>
        <button type="button" className="av-soft" disabled={!callEnabled} onClick={() => navigate(`/consult/${x.astrologerId}?mode=voice`)}><Icon name="phone" size={18} />{callEnabled ? `${t('common.call')} · ${rupees(x.rates.voice)}/min` : t('common.callSoon')}</button>
      </div>
      {toast}
    </div>
  );
}
