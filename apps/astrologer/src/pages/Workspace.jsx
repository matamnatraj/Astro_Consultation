import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth, useMediaQuery, useConsultation, ChatPane, SessionTimer, ChartView, Button, Badge, Modal, Spinner, ErrorBox, Alert, Avatar, Field, fmtDateTime, fmtTime, rupees, titleCase, useToast } from '@astro/shared';

/**
 * Consultation workspace (DPR §6):
 *  - Desktop: persistent header + timer, chat on one side, client chart on the other.
 *  - Mobile: Chat / Birth Chart tabs. Both panes stay mounted, so switching never
 *    resets the consultation, real-time connection, unread state, timer or billing.
 *  - The client's chart loads automatically using the consultation ID; the backend
 *    verifies assignment and logs every access.
 */
export default function Workspace() {
  const { id } = useParams();
  const { api } = useAuth();
  const session = useConsultation(id);
  const c = session.consultation;
  const [view, setView] = useState('chat'); // mobile tab
  const [chartOpen, setChartOpen] = useState(true); // desktop side panel
  const [chartState, setChartState] = useState({ loading: true });
  const [summary, setSummary] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [toast, showToast] = useToast();
  const isMobile = useMediaQuery('(max-width: 900px)');

  const canAccessChart = c && ['accepted', 'ready', 'in_progress', 'completed'].includes(c.status);
  const loadChart = useCallback(async () => {
    setChartState((s) => ({ ...s, loading: true }));
    try {
      const [chart, sum] = await Promise.all([api.get(`/consultations/${id}/client-chart`), api.get(`/consultations/${id}/client-summary`)]);
      setChartState({ loading: false, data: chart });
      setSummary(sum);
    } catch (e) { setChartState({ loading: false, error: e }); }
  }, [api, id]);
  useEffect(() => { if (canAccessChart) loadChart(); }, [canAccessChart, loadChart]);

  if (session.error) return <main className="main"><ErrorBox error={session.error} /></main>;
  if (!c) return <Spinner />;

  const action = async (name, body) => {
    setBusy(name);
    try { session.setConsultation(await api.post(`/consultations/${id}/${name}`, body)); setConfirmEnd(false); } catch (e) { showToast(e.message, 'bad'); } finally { setBusy(null); }
  };
  const generate = async () => {
    setGenerating(true);
    try { await api.post(`/consultations/${id}/client-chart/generate`); await loadChart(); showToast('Chart regenerated from current birth details'); } catch (e) { showToast(e.message, 'bad'); } finally { setGenerating(false); }
  };
  // Dedicated Birth Chart button: side panel on desktop, tab switch on mobile.
  const onChartButton = () => {
    if (isMobile) setView(view === 'chart' ? 'chat' : 'chart');
    else setChartOpen(!chartOpen);
  };
  const chartVisible = isMobile ? view === 'chart' : chartOpen;

  return (
    <div className="workspace">
      <div className="ws-head">
        <Link to="/" className="icon-btn" aria-label="Back to dashboard">←</Link>
        <Avatar name={c.client.name || 'Client'} size={36} />
        <div className="grow">
          <strong className="ellipsis">{c.client.name || 'Client'}</strong>
          <div className="tiny muted">{titleCase(c.bookingType)} · {rupees(c.ratePaise)}/min · up to {c.durationMinutes} min{c.scheduledAt ? ` · ${fmtDateTime(c.scheduledAt)}` : ''}</div>
        </div>
        <SessionTimer session={session} />
        <Button variant={chartVisible ? 'primary' : 'secondary'} size="sm" onClick={onChartButton} aria-pressed={chartVisible} disabled={!canAccessChart}>☉ Birth Chart</Button>
        <Button variant="ghost" size="sm" onClick={() => setNotesOpen(true)} disabled={!canAccessChart}>Notes</Button>
        {c.status === 'requested' && <><Button size="sm" variant="ghost" loading={busy === 'reject'} onClick={() => action('reject', { reason: 'The astrologer is unavailable' })}>Decline</Button><Button size="sm" loading={busy === 'accept'} onClick={() => action('accept')}>Accept</Button></>}
        {c.status === 'accepted' && <Badge status="accepted">Starts {fmtTime(c.scheduledAt)}</Badge>}
        {c.status === 'ready' && <Button size="sm" loading={busy === 'start'} onClick={() => action('start')}>Start session</Button>}
        {c.status === 'in_progress' && <Button size="sm" variant="danger" onClick={() => setConfirmEnd(true)}>End session</Button>}
        {['completed', 'rejected', 'cancelled', 'expired'].includes(c.status) && <Badge status={c.status} />}
      </div>

      <div className="ws-mobile-tabs" role="tablist">
        <button role="tab" aria-selected={view === 'chat'} className={view === 'chat' ? 'active' : ''} onClick={() => setView('chat')}>Chat{view !== 'chat' && session.unread ? ` • ${session.unread} new` : ''}</button>
        <button role="tab" aria-selected={view === 'chart'} className={view === 'chart' ? 'active' : ''} onClick={() => setView('chart')}>Birth Chart</button>
      </div>

      <div className={`ws-body ${chartOpen ? '' : 'chart-closed'}`} data-view={view}>
        <div className="ws-chat">
          {c.status === 'ready' && <div className="alert alert-info" style={{ borderRadius: 0 }}><span>The client has been notified. Review the chart, then start the session — billing begins when you start.</span></div>}
          {c.status === 'requested' && <div className="alert alert-warn" style={{ borderRadius: 0 }}>Accept the request to view the client's chart.</div>}
          <ChatPane session={session} visible={!isMobile || view === 'chat'} placeholder="Reply to your client…" disabledReason={c.status === 'ready' ? 'Start the session to begin chatting' : c.status === 'completed' ? 'This consultation has ended' : undefined} />
        </div>
        <aside className="ws-chart" aria-label="Client birth chart">
          {!canAccessChart ? <Alert tone="info">The client's birth chart becomes available once you accept this consultation.</Alert>
            : chartState.loading && !chartState.data ? <Spinner label="Loading client chart…" />
              : chartState.error ? <ErrorBox error={chartState.error} onRetry={loadChart} />
                : (
                  <div className="stack">
                    {summary && (
                      <details className="card card-body" open>
                        <summary><strong>Client summary</strong></summary>
                        <dl className="kv small mt">
                          <dt>Name</dt><dd>{chartState.data.birthProfile.fullName}{summary.gender ? ` · ${titleCase(summary.gender)}` : ''}</dd>
                          <dt>Born</dt><dd>{chartState.data.birthProfile.birthDate} {chartState.data.birthProfile.birthTime?.slice(0, 5) || '(time unknown)'} <Badge tone={chartState.data.birthProfile.timeAccuracy === 'exact' ? 'ok' : 'warn'}>{chartState.data.birthProfile.timeAccuracy}</Badge></dd>
                          <dt>Place</dt><dd>{chartState.data.birthProfile.placeName}</dd>
                          {summary.topic && <><dt>Topic</dt><dd>{summary.topic}</dd></>}
                          <dt>Language</dt><dd>{summary.preferredLanguage}</dd>
                          <dt>History</dt><dd>{summary.previousConsultationsWithYou.length ? `${summary.previousConsultationsWithYou.length} previous session(s) with you` : 'First session with you'}</dd>
                        </dl>
                      </details>
                    )}
                    <ChartView chart={chartState.data.chart} birthProfile={chartState.data.birthProfile} availability={chartState.data.availability}
                      onRegenerate={chartState.data.canGenerate ? generate : undefined} regenerating={generating} compact />
                    <p className="tiny muted">Access to this chart is limited to this consultation and is logged.</p>
                  </div>
                )}
        </aside>
      </div>

      <Modal open={confirmEnd} onClose={() => setConfirmEnd(false)} title="End this session?" footer={<><Button variant="ghost" onClick={() => setConfirmEnd(false)}>Keep going</Button><Button variant="danger" loading={busy === 'end'} onClick={() => action('end')}>End session</Button></>}>
        <p>The client will be billed for {session.timer?.billedMinutes || 1} minute(s) ({rupees((session.timer?.billedMinutes || 1) * c.ratePaise)}).</p>
      </Modal>
      {notesOpen && <NotesModal id={id} onClose={() => setNotesOpen(false)} />}
      {toast}
    </div>
  );
}

function NotesModal({ id, onClose }) {
  const { api } = useAuth();
  const [notes, setNotes] = useState(null);
  const [body, setBody] = useState('');
  const [err, setErr] = useState(null);
  useEffect(() => { api.get(`/consultations/${id}/notes`).then(setNotes).catch(setErr); }, [api, id]);
  const add = async (e) => {
    e.preventDefault();
    try { const n = await api.post(`/consultations/${id}/notes`, { body }); setNotes([...(notes || []), n]); setBody(''); } catch (x) { setErr(x); }
  };
  return (
    <Modal open onClose={onClose} title="Private notes">
      <p className="tiny muted">Visible only to you. Retained with the consultation record per the data retention policy.</p>
      <ErrorBox error={err} />
      {notes?.map((n) => <div key={n.note_id} className="summary-box small"><div style={{ whiteSpace: 'pre-line' }}>{n.body}</div><div className="tiny muted">{fmtDateTime(n.created_at)}</div></div>)}
      <form onSubmit={add} className="stack-s"><Field label="Add note"><textarea rows={3} value={body} onChange={(e) => setBody(e.target.value)} required maxLength={4000} /></Field><Button type="submit">Save note</Button></form>
    </Modal>
  );
}
