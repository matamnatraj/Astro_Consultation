import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { Button } from './ui.jsx';

/** Floating support assistant. Labelled as automated, with explicit consent before sharing the transcript on handoff. */
export function AssistantWidget() {
  const { api } = useAuth();
  const [open, setOpen] = useState(false);
  const [intro, setIntro] = useState(null);
  const [log, setLog] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [share, setShare] = useState(true);
  const listRef = useRef();
  useEffect(() => { if (open && !intro) api.get('/assistant/intro').then(setIntro).catch(() => {}); }, [open, intro, api]);
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [log, handoff]);

  const ask = async (e) => {
    e.preventDefault();
    const q = text.trim();
    if (!q) return;
    setText(''); setBusy(true);
    setLog((l) => [...l, { from: 'user', text: q }]);
    try {
      const r = await api.post('/assistant/message', { message: q });
      setLog((l) => [...l, { from: 'assistant', text: r.reply, link: r.link, suggestHandoff: r.suggestHandoff }]);
    } catch (err) { setLog((l) => [...l, { from: 'assistant', text: err.message }]); } finally { setBusy(false); }
  };
  const doHandoff = async () => {
    setBusy(true);
    const firstUser = log.find((m) => m.from === 'user')?.text || 'Help requested via assistant';
    try {
      const r = await api.post('/assistant/handoff', { summary: firstUser.slice(0, 300), transcript: log.map(({ from, text: t }) => ({ from, text: t })), shareTranscript: share });
      setLog((l) => [...l, { from: 'assistant', text: r.reply, link: '/support' }]);
      setHandoff(false);
    } catch (err) { setLog((l) => [...l, { from: 'assistant', text: err.message }]); } finally { setBusy(false); }
  };

  return (
    <>
      <button className="fab" onClick={() => setOpen(!open)} aria-label="Open help assistant">{open ? '✕' : '?'}</button>
      {open && (
        <div className="assistant" role="dialog" aria-label="Help assistant">
          <header><strong>Help</strong><span className="badge tone-info">{intro?.label || 'Automated assistant (AI)'}</span></header>
          <div className="assistant-list" ref={listRef}>
            <div className="msg theirs"><div className="bubble small">{intro?.disclosure || 'Loading…'}</div></div>
            {log.map((m, i) => (
              <div key={i} className={`msg ${m.from === 'user' ? 'mine' : 'theirs'}`}>
                <div className="bubble" style={{ whiteSpace: 'pre-line' }}>{m.text}{m.link && <><br /><Link to={m.link} onClick={() => setOpen(false)}>Open →</Link></>}</div>
                {m.suggestHandoff && <button className="link small" onClick={() => setHandoff(true)}>Talk to a human</button>}
              </div>
            ))}
            {handoff && (
              <div className="handoff">
                <label className="check small"><input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} /> Share this conversation with the support agent</label>
                <div className="row gap-s"><Button size="sm" loading={busy} onClick={doHandoff}>Create support ticket</Button><Button size="sm" variant="ghost" onClick={() => setHandoff(false)}>Cancel</Button></div>
              </div>
            )}
          </div>
          <form className="composer" onSubmit={ask}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Ask about bookings, payments, the app…" aria-label="Ask the assistant" maxLength={500} />
            <Button type="submit" loading={busy}>Ask</Button>
          </form>
          <div className="assistant-foot"><button className="link small" onClick={() => setHandoff(true)}>Talk to a human</button></div>
        </div>
      )}
    </>
  );
}
