import { Link } from 'react-router-dom';
import { useAuth, useAsync, useT, Card, Badge, Button, Spinner, Empty, rupees, fmtDateTime, Avatar, Stars } from '@astro/shared';

export default function Home() {
  const { api, me } = useAuth();
  const t = useT();
  const profile = useAsync(() => api.get('/clients/me'), []);
  const astrologers = useAsync(() => api.get('/astrologers?sort=rating'), []);
  const announcements = useAsync(() => api.get('/content/announcements'), []);
  const active = useAsync(() => api.get('/consultations?status=requested,accepted,ready,in_progress'), []);

  const first = (me.user.displayName || '').split(' ')[0];
  return (
    <div className="stack">
      <div className="page-head"><div><h1>{first ? t('home.greetName', { name: first }) : t('home.greet')} 🙏</h1><p>{t('home.tagline')}</p></div></div>

      {announcements.data?.filter((a) => a.kind === 'banner').map((a) => (
        <div key={a.announcement_id} className="alert alert-info"><div><strong>{a.title}</strong><div className="small">{a.body}</div></div></div>
      ))}

      {profile.data && !profile.data.profileComplete && (
        <Card>
          <div className="row between wrap">
            <div><strong>{t('home.complete')}</strong><div className="muted small">{t('home.completeBody')}</div></div>
            <Link to="/profile?add=1" className="btn btn-primary">{t('home.addBirth')}</Link>
          </div>
        </Card>
      )}

      <Card>
        <div className="row between wrap">
          <div><strong>♥ {t('match.title')}</strong><div className="muted small">{t('match.sub')}</div></div>
          <Link to="/matching" className="btn btn-secondary">{t('match.cta')}</Link>
        </div>
      </Card>

      {active.data?.length > 0 && (
        <Card title={t('home.active')}>
          <div className="list">
            {active.data.map((c) => (
              <div key={c.consultationId} className="list-item">
                <Avatar name={c.astrologer.name} />
                <div className="grow">
                  <strong>{c.astrologer.name}</strong> <Badge status={c.status} />
                  <div className="small muted">{c.bookingType === 'scheduled' ? fmtDateTime(c.scheduledAt) : t('common.instant')} · {t('common.min', { n: c.durationMinutes })} · {t('common.chat')}</div>
                </div>
                {['ready', 'in_progress'].includes(c.status)
                  ? <Link className="btn btn-primary btn-sm" to={`/consultations/${c.consultationId}`}>{c.status === 'in_progress' ? t('home.openChat') : t('home.join')}</Link>
                  : <Link className="btn btn-secondary btn-sm" to={`/bookings/${c.bookingId}`}>{t('common.view')}</Link>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="row between"><h2>{t('home.top')}</h2><Link to="/astrologers">{t('common.seeAll')}</Link></div>
      {astrologers.loading ? <Spinner /> : !astrologers.data?.length ? <Empty title={t('home.none')} /> : (
        <div className="grid-3">{astrologers.data.slice(0, 6).map((a) => <AstrologerCard key={a.astrologerId} a={a} />)}</div>
      )}
    </div>
  );
}

export function AstrologerCard({ a }) {
  const t = useT();
  return (
    <Card className="astro-card">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ position: 'relative' }}>
          <Avatar name={a.displayName} size={56} />
          {a.isOnline && <span className="dot online" style={{ position: 'absolute', right: 2, bottom: 2, width: 12, height: 12, border: '2px solid var(--surface)' }} />}
        </div>
        <div className="grow" style={{ minWidth: 0 }}>
          <Link to={`/astrologers/${a.astrologerId}`}><strong>{a.displayName}</strong></Link>
          <div className="small muted">{t('common.yrs', { n: a.experienceYears })} · {a.languages.join(', ')}</div>
          <div className="small"><Stars value={a.ratingAvg} size="sm" /> {a.ratingCount ? `${a.ratingAvg.toFixed(1)} (${a.ratingCount})` : t('common.new')}</div>
        </div>
      </div>
      <div className="chips mt">{a.specialties.slice(0, 4).map((s) => <span key={s} className="chip">{s}</span>)}</div>
      <div className="row between mt">
        <div><strong>{rupees(a.rates.chat)}</strong><span className="muted small">/min</span></div>
        <div className="row gap-s">
          {a.isOnline && !a.isBusy && <Link className="btn btn-primary btn-sm" to={`/book/${a.astrologerId}?type=instant`}>{t('common.chatNow')}</Link>}
          {a.isBusy && <Badge tone="warn">{t('common.inSession')}</Badge>}
          <Link className="btn btn-secondary btn-sm" to={`/book/${a.astrologerId}?type=scheduled`}>{t('common.schedule')}</Link>
        </div>
      </div>
    </Card>
  );
}

export { Button };
