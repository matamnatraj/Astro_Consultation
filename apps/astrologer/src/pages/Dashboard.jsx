import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useAsync, Card, Button, Badge, Spinner, Empty, Alert, Stat, rupees, fmtDateTime, mmss, useRealtimeEvent, useToast, Avatar, useRealtimeStatus } from '@astro/shared';

export default function Dashboard() {
  const { api } = useAuth();
  const nav = useNavigate();
  const me = useAsync(() => api.get('/astrologer/me'), []);
  const queue = useAsync(() => api.get('/consultations?status=requested,accepted,ready,in_progress'), []);
  const earnings = useAsync(() => api.get('/astrologer/me/earnings'), []);
  const announcements = useAsync(() => api.get('/content/announcements'), []);
  const [busy, setBusy] = useState(null);
  const [toast, showToast] = useToast();
  const [, tick] = useState(0);
  const conn = useRealtimeStatus();
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(t); }, []);
  useRealtimeEvent((ev) => {
    if (ev.type === 'consultation.request') { queue.reload(); showToast('New consultation request!', 'info'); }
    if (ev.type === 'notification' && ev.notification.data?.consultationId) queue.reload();
  });

  if (me.loading) return <Spinner />;
  const a = me.data;
  const approved = a.verificationStatus === 'approved';
  const requests = (queue.data || []).filter((c) => c.status === 'requested');
  const upcoming = (queue.data || []).filter((c) => c.status !== 'requested');

  const toggleOnline = async () => {
    try { const r = await api.put('/astrologer/me/online', { isOnline: !a.isOnline }); me.setData({ ...a, isOnline: r.isOnline }); } catch (e) { showToast(e.message, 'bad'); }
  };
  const act = async (c, action) => {
    setBusy(c.consultationId + action);
    try {
      const r = await api.post(`/consultations/${c.consultationId}/${action}`, action === 'reject' ? { reason: 'The astrologer is unavailable right now' } : undefined);
      queue.reload();
      if (action === 'accept' && r.status === 'ready') nav(`/consultations/${c.consultationId}`);
    } catch (e) { showToast(e.message, 'bad'); queue.reload(); } finally { setBusy(null); }
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div><h1>Welcome, {a.displayName.split(' ')[0]}</h1><p>{approved ? 'Go online to receive instant consultation requests.' : 'Complete onboarding to start taking consultations.'}</p></div>
        {approved && (
          <div className="row">
            <span className="small muted">{conn === 'online' ? '' : 'Connecting…'}</span>
            <button className={`btn ${a.isOnline ? 'btn-primary' : 'btn-secondary'}`} onClick={toggleOnline} aria-pressed={a.isOnline}>
              <span className={`dot ${a.isOnline ? 'online' : ''}`} />{a.isOnline ? 'Online — accepting requests' : 'Offline'}
            </button>
          </div>
        )}
      </div>
      {!approved && (
        <Alert tone={a.verificationStatus === 'rejected' || a.verificationStatus === 'suspended' ? 'bad' : 'warn'}>
          <div><strong>Verification: {a.verificationStatus}</strong>{a.verificationNotes && <div className="small">{a.verificationNotes}</div>}
            <div className="small">{a.verificationStatus === 'submitted' ? 'Our team is reviewing your profile.' : 'Complete your profile, upload ID and submit for verification.'}</div></div>
          <Link to="/profile" className="btn btn-primary btn-sm">Go to profile</Link>
        </Alert>
      )}
      {announcements.data?.map((n) => <div key={n.announcement_id} className="alert alert-info small"><span><strong>{n.title}:</strong> {n.body}</span></div>)}

      <div className="grid-stats">
        <Stat label="Pending requests" value={requests.length} tone={requests.length ? 'warn' : undefined} />
        <Stat label="Upcoming" value={upcoming.length} />
        <Stat label="Rating" value={a.ratingCount ? a.ratingAvg.toFixed(1) : '—'} sub={`${a.ratingCount} reviews`} />
        <Stat label="Eligible for payout" value={rupees(earnings.data?.summary.eligible)} sub={`${rupees(earnings.data?.summary.on_hold)} on hold`} />
      </div>

      <Card title={<span>Incoming requests {requests.length > 0 && <Badge tone="live">{requests.length}</Badge>}</span>}>
        {queue.loading ? <Spinner /> : requests.length === 0 ? <Empty title="No pending requests" icon="☾">{a.isOnline ? 'You will be notified instantly.' : 'Go online to receive instant requests.'}</Empty> : (
          <div className="list">{requests.map((c) => {
            const left = Math.max(0, Math.floor((new Date(c.acceptDeadline) - Date.now()) / 1000));
            return (
              <div key={c.consultationId} className="list-item">
                <Avatar name={c.client.name || 'Client'} />
                <div className="grow">
                  <strong>{c.client.name || 'Client'}</strong> <Badge tone={c.bookingType === 'instant' ? 'live' : 'info'}>{c.bookingType}</Badge>
                  <div className="small muted">{c.bookingType === 'scheduled' ? fmtDateTime(c.scheduledAt) : 'Now'} · up to {c.durationMinutes} min · {rupees(c.ratePaise)}/min{c.topic ? ` · “${c.topic}”` : ''}</div>
                  <div className="tiny" style={{ color: left < 60 ? 'var(--bad)' : 'var(--muted)' }}>Respond within {mmss(left)}</div>
                </div>
                <div className="row gap-s">
                  <Button size="sm" variant="ghost" loading={busy === c.consultationId + 'reject'} onClick={() => act(c, 'reject')}>Decline</Button>
                  <Button size="sm" loading={busy === c.consultationId + 'accept'} onClick={() => act(c, 'accept')}>Accept</Button>
                </div>
              </div>
            );
          })}</div>
        )}
      </Card>

      <Card title="Accepted & live">
        {upcoming.length === 0 ? <p className="muted small">Nothing scheduled.</p> : (
          <div className="list">{upcoming.map((c) => (
            <div key={c.consultationId} className="list-item">
              <Avatar name={c.client.name || 'Client'} />
              <div className="grow"><strong>{c.client.name}</strong> <Badge status={c.status} />
                <div className="small muted">{c.bookingType === 'scheduled' ? fmtDateTime(c.scheduledAt) : 'Instant'} · up to {c.durationMinutes} min</div></div>
              <Link className="btn btn-primary btn-sm" to={`/consultations/${c.consultationId}`}>{c.status === 'in_progress' ? 'Resume' : 'Open workspace'}</Link>
            </div>
          ))}</div>
        )}
      </Card>
      {toast}
    </div>
  );
}
