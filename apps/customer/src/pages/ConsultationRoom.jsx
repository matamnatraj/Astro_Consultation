import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth, useAsync, useT, useMediaQuery, useConsultation, ChatPane, SessionTimer, ChartView, Button, Badge, Modal, Spinner, ErrorBox, Avatar } from '@astro/shared';

export default function ConsultationRoom() {
  const { id } = useParams();
  const { api } = useAuth();
  const t = useT();
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
  const waiting = { requested: t('room.requested'), accepted: t('room.accepted'), ready: t('room.ready') }[c.status];

  return (
    <div className="workspace">
      <div className="ws-head">
        <Link to={`/bookings/${c.bookingId}`} className="icon-btn" aria-label="Back">←</Link>
        <Avatar name={c.astrologer.name} size={36} />
        <div className="grow"><strong className="ellipsis">{c.astrologer.name}</strong>
          <div className="tiny muted">{session.presence.length > 1 ? t('room.inSession') : t('room.notConnected')}</div></div>
        <SessionTimer session={session} />
        <Button variant="secondary" size="sm" className="hide-mobile" onClick={() => setChartOpen(!chartOpen)}>{chartOpen ? t('room.hideChart') : t('room.myChart')}</Button>
        {c.status === 'in_progress' && <Button variant="danger" size="sm" onClick={() => setConfirmEnd(true)}>{t('room.end')}</Button>}
        {c.status === 'completed' && <Badge status="completed" />}
      </div>
      <div className="ws-mobile-tabs">
        <button className={view === 'chat' ? 'active' : ''} onClick={() => setView('chat')}>{t('common.chat')}{view !== 'chat' && session.unread ? ` (${session.unread})` : ''}</button>
        <button className={view === 'chart' ? 'active' : ''} onClick={() => setView('chart')}>{t('room.myChart')}</button>
      </div>
      <div className={`ws-body ${chartOpen ? '' : 'chart-closed'}`} data-view={view}>
        <div className="ws-chat">
          {waiting && <div className="alert alert-info" style={{ borderRadius: 0 }}>{waiting}</div>}
          <ChatPane session={session} visible={!isMobile || view === 'chat'} disabledReason={c.status === 'completed' ? t('room.ended') : undefined} />
        </div>
        <div className="ws-chart">
          {chart.loading ? <Spinner /> : chart.error ? <ErrorBox error={chart.error} /> : <ChartView chart={chart.data.chart} birthProfile={chart.data.birthProfile} availability={chart.data.availability} compact />}
        </div>
      </div>
      <Modal open={confirmEnd} onClose={() => setConfirmEnd(false)} title={t('room.endQ')} footer={<><Button variant="ghost" onClick={() => setConfirmEnd(false)}>{t('room.keep')}</Button><Button variant="danger" loading={busy} onClick={end}>{t('room.endSession')}</Button></>}>
        <p>{t('room.charged', { n: session.timer?.billedMinutes || 1 })}</p>
      </Modal>
    </div>
  );
}
