import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth, useAsync, useT, useToast, useConsultation, ChatPane, ChartView, Modal, Spinner, ErrorBox, mmss, rupees } from '@astro/shared';
import { Icon, AstroAvatar, useWallet } from '../brand.jsx';

const toBase64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });

export default function ConsultationRoom() {
  const { id } = useParams();
  const { api } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const session = useConsultation(id);
  const [, refreshWallet] = useWallet();
  const [menu, setMenu] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendMin, setExtendMin] = useState(10);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [busy, setBusy] = useState(null);
  const [toast, show] = useToast();
  const fileRef = useRef();
  const k = session.consultation;
  const chart = useAsync(() => (chartOpen ? api.get(`/consultations/${id}/client-chart`) : Promise.resolve(null)), [id, chartOpen]);
  const review = useAsync(() => api.get('/bookings').then((bs) => bs.find((b) => b.consultation?.consultationId === id)), [id, k?.status]);

  if (session.error) return <main className="main"><ErrorBox error={session.error} /></main>;
  if (!k) return <Spinner />;
  const live = k.status === 'in_progress';
  const ended = ['completed', 'cancelled', 'expired', 'rejected', 'failed'].includes(k.status);
  const astroOnline = session.presence.length > 1;
  const low = live && session.timer?.remaining <= 120;
  const waiting = { requested: t('chat.waiting', { name: k.astrologer.name }), accepted: t('room.accepted'), ready: t('room.ready') }[k.status];

  const end = async () => {
    setBusy('end');
    try { session.setConsultation(await api.post(`/consultations/${id}/end`)); setConfirmEnd(false); refreshWallet(); } catch (e) { show(e.message, 'bad'); } finally { setBusy(null); }
  };
  const extend = async () => {
    setBusy('extend');
    try { session.setConsultation(await api.post(`/consultations/${id}/extend`, { minutes: extendMin })); setExtendOpen(false); refreshWallet(); show(t('x.extended', { n: extendMin })); }
    catch (e) {
      if (e.details?.code === 'insufficient_balance') navigate(`/wallet?add=${Math.ceil((e.details.requiredPaise - e.details.balancePaise) / 100)}&back=${encodeURIComponent(`/consultations/${id}`)}`);
      else show(e.message, 'bad');
    } finally { setBusy(null); }
  };
  const attach = async (e) => {
    const f = e.target.files?.[0]; e.target.value = '';
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { show(t('x.tooBig'), 'bad'); return; }
    setBusy('attach');
    try { await api.post(`/consultations/${id}/attachments`, { fileName: f.name, mimeType: f.type || 'application/pdf', contentBase64: await toBase64(f) }); } catch (x) { show(x.message, 'bad'); } finally { setBusy(null); }
  };
  const items = [
    ['kundli', t('chat.viewKundli'), () => setChartOpen(true), true],
    ['timer', t('chat.extend'), () => setExtendOpen(true), live && k.paymentMethod === 'wallet'],
    ['receipt', t('chat.receipt'), () => navigate(`/bookings/${k.bookingId}`), true],
    ['lifebuoy', t('chat.report'), () => navigate('/support'), true],
    ['hangup', t('chat.end'), () => setConfirmEnd(true), live, true],
  ].filter((x) => x[3]);

  return (
    <div className="workspace">
      <div className="ws-head av-room-head" style={{ position: 'relative' }}>
        <Link to="/bookings" className="icon-btn" aria-label="Back"><Icon name="left" /></Link>
        <AstroAvatar name={k.astrologer.name} size={40} online={astroOnline} />
        <div className="grow" style={{ minWidth: 0 }}><strong className="ellipsis">{k.astrologer.name}</strong>
          <div className="tiny" style={{ color: astroOnline ? 'var(--ok)' : 'var(--muted)' }}>● {session.typing ? t('chat.typing') : astroOnline ? t('common.online') : t('common.offline')}</div></div>
        <button type="button" className="av-icon-btn" aria-label="More options" aria-expanded={menu} onClick={() => setMenu(!menu)}><Icon name="more" /></button>
        {menu && (
          <div className="av-menu" role="menu" onClick={() => setMenu(false)}>
            {items.map(([icon, label, fn, , danger]) => <button key={icon} type="button" role="menuitem" className={danger ? 'danger' : ''} onClick={fn}><Icon name={icon} size={20} style={{ color: danger ? 'var(--bad)' : 'var(--primary)' }} />{label}</button>)}
          </div>
        )}
      </div>
      {(live || k.status === 'completed') && (
        <div className="av-amountbar">
          <span>{t('chat.time')} <span className={`time ${low ? 'low' : ''}`}>{mmss(session.timer?.elapsed || 0)}</span>{live && <span className="muted small"> · {t('x.left', { t: mmss(session.timer?.remaining || 0) })}</span>}</span>
          <span>{live ? rupees(session.timer?.runningAmount || 0) : rupees(k.chargedPaise ?? k.finalAmountPaise ?? 0)}</span>
        </div>
      )}
      {waiting && <div className="alert alert-info" style={{ borderRadius: 0 }}><span>{waiting}{k.status === 'requested' && <><br /><span className="small">{t('chat.waitingNote')}</span></>}</span></div>}
      {session.connection !== 'online' && !ended && <div className="chat-banner">{t('core.reconnecting')}</div>}
      <div className="ws-body chart-closed" style={{ flex: 1, minHeight: 0 }}>
        <div className="ws-chat">
          <ChatPane session={session} placeholder={t('chat.type')} disabledReason={ended ? t('chat.ended') : t('chat.opens')}
            composerStart={live ? (
              <>
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden onChange={attach} />
                <button type="button" className="av-icon-btn" aria-label="Attach a file" disabled={busy === 'attach'} onClick={() => fileRef.current?.click()} style={{ flex: 'none' }}><Icon name="clip" size={20} /></button>
              </>
            ) : null} />
        </div>
      </div>
      {k.status === 'completed' && (
        <div className="av-done">
          <strong style={{ fontSize: 17 }}>✓ {t('chat.completed')}</strong>
          <span className="small" style={{ color: 'var(--text-2)' }}>{t('common.min', { n: Math.ceil((k.billableSeconds || 0) / 60) })} · {t('x.charged', { amt: rupees(k.chargedPaise ?? k.finalAmountPaise ?? 0) })}{k.discountPaise ? ` (${k.discountLabel})` : ''}</span>
          {review.data && !review.data.consultation?.reviewed && <Link className="btn btn-primary" to={`/rate/${id}`} aria-label={t('chat.rate')}>★ {t('chat.rate')}</Link>}
          <Link to={`/astrologers/${k.astrologer.astrologerId}`} className="small">{t('chat.chatAgain', { name: k.astrologer.name.split(' ')[0] })}</Link>
        </div>
      )}
      <Modal open={chartOpen} wide onClose={() => setChartOpen(false)} title={t('chat.viewKundli')}>
        {chart.loading || !chart.data ? <Spinner /> : chart.error ? <ErrorBox error={chart.error} /> : <ChartView chart={chart.data.chart} birthProfile={chart.data.birthProfile} availability={chart.data.availability} compact />}
      </Modal>
      <Modal open={extendOpen} onClose={() => setExtendOpen(false)} title={t('chat.extend')}
        footer={<button type="button" className="btn btn-primary btn-block" disabled={busy === 'extend'} onClick={extend} aria-label={`Extend · ${rupees(k.ratePaise * extendMin)}`}>{t('x.extendFor', { amt: rupees(k.ratePaise * extendMin) })}</button>}>
        <p className="small muted">{t('x.extendNote')}</p>
        <div className="chips">{[5, 10, 15, 20].map((m) => <button key={m} type="button" className={`chip ${extendMin === m ? 'active' : ''}`} onClick={() => setExtendMin(m)}>{t('common.min', { n: m })}</button>)}</div>
      </Modal>
      <Modal open={confirmEnd} onClose={() => setConfirmEnd(false)} title={t('room.endQ')}
        footer={<><button type="button" className="btn btn-ghost" onClick={() => setConfirmEnd(false)}>{t('room.keep')}</button><button type="button" className="btn btn-danger" disabled={busy === 'end'} onClick={end}>{t('room.endSession')}</button></>}>
        <p>{t('x.endNote', { n: session.timer?.billedMinutes || 1 })}</p>
      </Modal>
      {toast}
    </div>
  );
}
