import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth, useAsync, useMediaQuery, useConsultation, ChatPane, SessionTimer, ChartView, Button, Badge, Modal, Spinner, ErrorBox, Avatar } from '@astro/shared';

export default function ConsultationRoom() {
  const { id } = useParams();
  const { api } = useAuth();
  const session = useConsultation(id);
  const [view, setView] = useState('chat');
  const [chartOpen, setChartOpen] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [busy, setBusy] = useState(false);
  const chart = useAsync(() => api.get(`/consultations/${id}/client-chart`), [id]);
  const c = session.consultation;
  const isMobile = useMediaQuery('(max-width: 900px)');

  if (session.error) return <main className="main"><ErrorBox error={session.error} /></main>;
  if (!c) return <Spinner />;

  const end = async () => {
    setBusy(true);
    try { session.setConsultation(await api.post(`/consultations/${id}/end`)); setConfirmEnd(false); } catch (e) { alert(e.message); } finally { setBusy(false); }
  };
  const waiting = { requested: 'Waiting for the astrologer to accept…', accepted: 'Accepted. The session will open at the scheduled time.', ready: 'The astrologer will start the session shortly. Stay on this screen.' }[c.status];

  return (
    <div className="workspace">
      <div className="ws-head">
        <Link to={`/bookings/${c.bookingId}`} className="icon-btn" aria-label="Back">←</Link>
        <Avatar name={c.astrologer.name} size={36} />
        <div className="grow"><strong className="ellipsis">{c.astrologer.name}</strong>
          <div className="tiny muted">{session.presence.length > 1 ? 'In the session' : 'Not connected'}</div></div>
        <SessionTimer session={session} />
        <Button variant="secondary" size="sm" className="hide-mobile" onClick={() => setChartOpen(!chartOpen)}>{chartOpen ? 'Hide my chart' : 'My chart'}</Button>
        {c.status === 'in_progress' && <Button variant="danger" size="sm" onClick={() => setConfirmEnd(true)}>End</Button>}
        {c.status === 'completed' && <Badge status="completed" />}
      </div>
      <div className="ws-mobile-tabs">
        <button className={view === 'chat' ? 'active' : ''} onClick={() => setView('chat')}>Chat{view !== 'chat' && session.unread ? ` (${session.unread})` : ''}</button>
        <button className={view === 'chart' ? 'active' : ''} onClick={() => setView('chart')}>My chart</button>
      </div>
      <div className={`ws-body ${chartOpen ? '' : 'chart-closed'}`} data-view={view}>
        <div className="ws-chat">
          {waiting && <div className="alert alert-info" style={{ borderRadius: 0 }}>{waiting}</div>}
          <ChatPane session={session} visible={!isMobile || view === 'chat'} disabledReason={c.status === 'completed' ? 'This consultation has ended' : undefined} />
        </div>
        <div className="ws-chart">
          {chart.loading ? <Spinner /> : chart.error ? <ErrorBox error={chart.error} /> : <ChartView chart={chart.data.chart} birthProfile={chart.data.birthProfile} availability={chart.data.availability} compact />}
        </div>
      </div>
      <Modal open={confirmEnd} onClose={() => setConfirmEnd(false)} title="End consultation?" footer={<><Button variant="ghost" onClick={() => setConfirmEnd(false)}>Continue chatting</Button><Button variant="danger" loading={busy} onClick={end}>End session</Button></>}>
        <p>You'll be charged for {session.timer?.billedMinutes || 1} started minute(s). Any unused amount is released.</p>
      </Modal>
    </div>
  );
}
