import { Link } from 'react-router-dom';
import { useAuth, useAsync, useT, Card, Badge, Spinner, Empty, ErrorBox, rupees, fmtDateTime, Avatar, useRealtimeEvent } from '@astro/shared';

export default function Bookings() {
  const { api } = useAuth();
  const t = useT();
  const { data, loading, error, reload } = useAsync(() => api.get('/bookings'), []);
  useRealtimeEvent((ev) => { if (ev.type === 'notification' && ev.notification.type.startsWith('booking.')) reload(); });
  return (
    <div className="stack">
      <div className="page-head"><div><h1>{t('nav.sessions')}</h1><p>{t('sessions.sub')}</p></div></div>
      <ErrorBox error={error} onRetry={reload} />
      {loading ? <Spinner /> : !data?.length ? <Empty title={t('sessions.none')}><Link to="/astrologers">{t('astro.title')} →</Link></Empty> : (
        <Card pad={false}>
          <div className="list" style={{ padding: '0 18px' }}>
            {data.map((b) => {
              const status = b.consultation?.status || b.status;
              return (
                <Link key={b.bookingId} to={`/bookings/${b.bookingId}`} className="list-item" style={{ color: 'inherit', textDecoration: 'none' }}>
                  <Avatar name={b.astrologerName} />
                  <div className="grow">
                    <div><strong>{b.astrologerName}</strong> <Badge status={status} /></div>
                    <div className="small muted">{b.bookingType === 'scheduled' ? fmtDateTime(b.scheduledAt) : `${t('common.instant')} · ${fmtDateTime(b.createdAt)}`} · {t('common.min', { n: b.durationMinutes })} · {t('sessions.for', { name: b.birthProfileName })}</div>
                  </div>
                  <div className="right">
                    <strong>{rupees(b.consultation?.finalAmountPaise ?? b.quotedAmountPaise)}</strong>
                    {b.consultation?.status === 'completed' && !b.consultation.reviewed && <div className="tiny" style={{ color: 'var(--accent)' }}>{t('sessions.rate')}</div>}
                  </div>
                </Link>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
