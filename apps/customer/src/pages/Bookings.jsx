import { Link } from 'react-router-dom';
import { useAuth, useAsync, Card, Badge, Spinner, Empty, ErrorBox, rupees, fmtDateTime, Avatar, useRealtimeEvent } from '@astro/shared';

export default function Bookings() {
  const { api } = useAuth();
  const { data, loading, error, reload } = useAsync(() => api.get('/bookings'), []);
  useRealtimeEvent((ev) => { if (ev.type === 'notification' && ev.notification.type.startsWith('booking.')) reload(); });
  return (
    <div className="stack">
      <div className="page-head"><div><h1>My sessions</h1><p>Bookings, consultations, receipts and reviews.</p></div></div>
      <ErrorBox error={error} onRetry={reload} />
      {loading ? <Spinner /> : !data?.length ? <Empty title="No sessions yet"><Link to="/astrologers">Find an astrologer →</Link></Empty> : (
        <Card pad={false}>
          <div className="list" style={{ padding: '0 18px' }}>
            {data.map((b) => {
              const status = b.consultation?.status || b.status;
              return (
                <Link key={b.bookingId} to={`/bookings/${b.bookingId}`} className="list-item" style={{ color: 'inherit', textDecoration: 'none' }}>
                  <Avatar name={b.astrologerName} />
                  <div className="grow">
                    <div><strong>{b.astrologerName}</strong> <Badge status={status} /></div>
                    <div className="small muted">{b.bookingType === 'scheduled' ? fmtDateTime(b.scheduledAt) : `Instant · ${fmtDateTime(b.createdAt)}`} · {b.durationMinutes} min · for {b.birthProfileName}</div>
                  </div>
                  <div className="right">
                    <strong>{rupees(b.consultation?.finalAmountPaise ?? b.quotedAmountPaise)}</strong>
                    {b.consultation?.status === 'completed' && !b.consultation.reviewed && <div className="tiny" style={{ color: 'var(--accent)' }}>Rate session</div>}
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
