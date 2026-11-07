import { Link } from 'react-router-dom';
import { useAuth, useAsync, Card, Badge, Button, Spinner, Empty, rupees, fmtDateTime, Avatar, Stars } from '@astro/shared';

export default function Home() {
  const { api, me } = useAuth();
  const profile = useAsync(() => api.get('/clients/me'), []);
  const astrologers = useAsync(() => api.get('/astrologers?sort=rating'), []);
  const announcements = useAsync(() => api.get('/content/announcements'), []);
  const active = useAsync(() => api.get('/consultations?status=requested,accepted,ready,in_progress'), []);

  const first = (me.user.displayName || '').split(' ')[0];
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Namaste{first ? `, ${first}` : ''} 🙏</h1><p>Consult verified astrologers with your saved birth chart.</p></div></div>

      {announcements.data?.filter((a) => a.kind === 'banner').map((a) => (
        <div key={a.announcement_id} className="alert alert-info"><div><strong>{a.title}</strong><div className="small">{a.body}</div></div></div>
      ))}

      {profile.data && !profile.data.profileComplete && (
        <Card>
          <div className="row between wrap">
            <div><strong>Complete your profile</strong><div className="muted small">Add your birth details once — astrologers will see your chart automatically in every consultation.</div></div>
            <Link to="/profile?add=1" className="btn btn-primary">Add birth details</Link>
          </div>
        </Card>
      )}

      {active.data?.length > 0 && (
        <Card title="Your active consultations">
          <div className="list">
            {active.data.map((c) => (
              <div key={c.consultationId} className="list-item">
                <Avatar name={c.astrologer.name} />
                <div className="grow">
                  <strong>{c.astrologer.name}</strong> <Badge status={c.status} />
                  <div className="small muted">{c.bookingType === 'scheduled' ? fmtDateTime(c.scheduledAt) : 'Instant'} · {c.durationMinutes} min {c.mode}</div>
                </div>
                {['ready', 'in_progress'].includes(c.status)
                  ? <Link className="btn btn-primary btn-sm" to={`/consultations/${c.consultationId}`}>{c.status === 'in_progress' ? 'Open chat' : 'Join'}</Link>
                  : <Link className="btn btn-secondary btn-sm" to={`/bookings/${c.bookingId}`}>View</Link>}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="row between"><h2>Top astrologers</h2><Link to="/astrologers">See all →</Link></div>
      {astrologers.loading ? <Spinner /> : !astrologers.data?.length ? <Empty title="No astrologers available yet" /> : (
        <div className="grid-3">{astrologers.data.slice(0, 6).map((a) => <AstrologerCard key={a.astrologerId} a={a} />)}</div>
      )}
    </div>
  );
}

export function AstrologerCard({ a }) {
  return (
    <Card className="astro-card">
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <div style={{ position: 'relative' }}>
          <Avatar name={a.displayName} size={56} />
          {a.isOnline && <span className="dot online" style={{ position: 'absolute', right: 2, bottom: 2, width: 12, height: 12, border: '2px solid var(--surface)' }} />}
        </div>
        <div className="grow" style={{ minWidth: 0 }}>
          <Link to={`/astrologers/${a.astrologerId}`}><strong>{a.displayName}</strong></Link>
          <div className="small muted">{a.experienceYears} yrs · {a.languages.join(', ')}</div>
          <div className="small"><Stars value={a.ratingAvg} size="sm" /> {a.ratingCount ? `${a.ratingAvg.toFixed(1)} (${a.ratingCount})` : 'New'}</div>
        </div>
      </div>
      <div className="chips mt">{a.specialties.slice(0, 4).map((s) => <span key={s} className="chip">{s}</span>)}</div>
      <div className="row between mt">
        <div><strong>{rupees(a.rates.chat)}</strong><span className="muted small">/min</span></div>
        <div className="row gap-s">
          {a.isOnline && !a.isBusy && <Link className="btn btn-primary btn-sm" to={`/book/${a.astrologerId}?type=instant`}>Chat now</Link>}
          {a.isBusy && <Badge tone="warn">In session</Badge>}
          <Link className="btn btn-secondary btn-sm" to={`/book/${a.astrologerId}?type=scheduled`}>Schedule</Link>
        </div>
      </div>
    </Card>
  );
}

export { Button };
