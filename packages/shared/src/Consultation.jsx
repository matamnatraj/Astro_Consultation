import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from './auth.jsx';
import { useRealtimeClient, useRealtimeEvent, useRealtimeStatus } from './realtime.js';
import { mmss, fmtTime, rupees } from './format.js';
import { Badge, Button } from './ui.jsx';
import { useT } from './i18n.jsx';

/**
 * Single source of truth for a live consultation: state, messages, timer and
 * connection. Mount it once at the workspace level so switching between chat and
 * chart views never resets the session, timer or unread state.
 */
export function useConsultation(consultationId) {
  const { api, me } = useAuth();
  const rt = useRealtimeClient();
  const connection = useRealtimeStatus();
  const [consultation, setConsultation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState([]);
  const [error, setError] = useState(null);
  const [typing, setTyping] = useState(false);
  const [presence, setPresence] = useState([]);
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const lastSeq = useRef(0);
  const typingTimer = useRef();

  const mergeMessages = useCallback((incoming) => {
    setMessages((prev) => {
      const map = new Map(prev.map((m) => [m.messageId, m]));
      for (const m of incoming) map.set(m.messageId, { ...map.get(m.messageId), ...m });
      const list = [...map.values()].sort((a, b) => a.seq - b.seq);
      lastSeq.current = list.length ? list[list.length - 1].seq : lastSeq.current;
      return list;
    });
    const ids = new Set(incoming.map((m) => m.clientMsgId).filter(Boolean));
    if (ids.size) setPending((p) => p.filter((x) => !ids.has(x.clientMsgId)));
  }, []);

  const applyState = useCallback((c) => {
    setConsultation(c);
    if (c.serverTime) setClockOffset(new Date(c.serverTime).getTime() - Date.now());
  }, []);

  const refresh = useCallback(async () => {
    try {
      const [c, msgs] = await Promise.all([api.get(`/consultations/${consultationId}`), api.get(`/consultations/${consultationId}/messages?afterSeq=0`)]);
      applyState(c);
      mergeMessages(msgs);
    } catch (e) { setError(e); }
  }, [api, consultationId, applyState, mergeMessages]);

  useEffect(() => {
    refresh();
    rt.join(consultationId, 0);
    return () => rt.leave(consultationId);
  }, [consultationId, rt, refresh]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  useRealtimeEvent((ev) => {
    if (ev.type === 'joined' && ev.consultation.consultationId === consultationId) { applyState(ev.consultation); mergeMessages(ev.messages); }
    if (ev.type === 'message' && ev.message.consultationId === consultationId) mergeMessages([ev.message]);
    if (ev.type === 'ack' && ev.message?.consultationId === consultationId) mergeMessages([ev.message]);
    if (ev.type === 'consultation.state' && ev.consultation.consultationId === consultationId) applyState(ev.consultation);
    if (ev.type === 'typing' && ev.consultationId === consultationId) {
      setTyping(true); clearTimeout(typingTimer.current); typingTimer.current = setTimeout(() => setTyping(false), 3000);
    }
    if (ev.type === 'presence' && ev.consultationId === consultationId) setPresence(ev.online);
    if (ev.type === 'read' && ev.consultationId === consultationId && ev.userId !== me.user.userId) {
      setMessages((ms) => ms.map((m) => (m.seq <= ev.upToSeq && m.senderUserId === me.user.userId && !m.readAt ? { ...m, readAt: new Date().toISOString() } : m)));
    }
    if (ev.type === 'error' && ev.clientMsgId) {
      setPending((p) => p.map((x) => (x.clientMsgId === ev.clientMsgId ? { ...x, failed: ev.message } : x)));
    }
  });

  const send = useCallback(async (content) => {
    const clientMsgId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    setPending((p) => [...p, { clientMsgId, content, createdAt: new Date().toISOString() }]);
    const ok = rt.send({ type: 'message', consultationId, content, clientMsgId });
    if (!ok) {
      // REST fallback when the socket is reconnecting
      try { mergeMessages([await api.post(`/consultations/${consultationId}/messages`, { content, clientMsgId })]); } catch (e) {
        setPending((p) => p.map((x) => (x.clientMsgId === clientMsgId ? { ...x, failed: e.message } : x)));
      }
    }
  }, [rt, api, consultationId, mergeMessages]);

  const retry = useCallback((p) => { setPending((ps) => ps.filter((x) => x !== p)); send(p.content); }, [send]);
  const notifyTyping = useCallback(() => rt.send({ type: 'typing', consultationId }), [rt, consultationId]);
  const markRead = useCallback(() => {
    const otherUnread = messages.some((m) => !m.readAt && m.senderUserId && m.senderUserId !== me.user.userId);
    if (otherUnread && lastSeq.current) rt.send({ type: 'read', consultationId, upToSeq: lastSeq.current }) || api.post(`/consultations/${consultationId}/read`, { upToSeq: lastSeq.current }).catch(() => {});
    if (otherUnread) setMessages((ms) => ms.map((m) => (m.senderUserId !== me.user.userId ? { ...m, readAt: m.readAt || new Date().toISOString() } : m)));
  }, [messages, rt, api, consultationId, me]);

  const timer = useMemo(() => {
    if (!consultation?.startedAt) return null;
    const end = consultation.endedAt ? new Date(consultation.endedAt).getTime() : now + clockOffset;
    const elapsed = Math.max(0, Math.floor((end - new Date(consultation.startedAt).getTime()) / 1000));
    const remaining = Math.max(0, consultation.maxBillableSeconds - elapsed);
    const billedMinutes = Math.min(Math.ceil(Math.max(1, elapsed) / 60), consultation.maxBillableSeconds / 60);
    return { elapsed, remaining, billedMinutes, runningAmount: billedMinutes * consultation.ratePaise };
  }, [consultation, now, clockOffset]);

  const unread = messages.filter((m) => m.kind === 'text' && !m.readAt && m.senderUserId !== me.user.userId).length;

  return { consultation, messages, pending, error, typing, presence, connection, timer, unread, send, retry, notifyTyping, markRead, refresh, setConsultation: applyState, myUserId: me.user.userId };
}

export function SessionTimer({ session, compact }) {
  const { consultation: c, timer } = session;
  if (!c) return null;
  if (c.status !== 'in_progress' && c.status !== 'completed') return <Badge status={c.status} />;
  const low = c.status === 'in_progress' && timer.remaining <= 120;
  return (
    <div className={`timer ${low ? 'low' : ''} ${compact ? 'compact' : ''}`} aria-live="off">
      <span className={`dot ${c.status === 'in_progress' ? 'live' : ''}`} />
      <span className="timer-main">{mmss(timer.elapsed)}</span>
      {!compact && <span className="timer-sub">{c.status === 'in_progress' ? `${mmss(timer.remaining)} left · ${rupees(timer.runningAmount)}` : `Billed ${rupees(c.finalAmountPaise)}`}</span>}
    </div>
  );
}

/** Chat pane. Stays mounted while hidden so the live connection and state persist. */
export function ChatPane({ session, visible = true, placeholder, disabledReason }) {
  const tr = useT();
  const { consultation: c, messages, pending, typing, send, retry, notifyTyping, markRead, myUserId, connection } = session;
  const [text, setText] = useState('');
  const listRef = useRef();
  const lastTyping = useRef(0);
  const atBottom = useRef(true);

  useEffect(() => {
    const el = listRef.current;
    if (el && (atBottom.current || pending.length)) el.scrollTop = el.scrollHeight;
  }, [messages.length, pending.length, visible]);
  useEffect(() => { if (visible && document.visibilityState === 'visible') markRead(); }, [visible, messages.length, markRead]);

  const canSend = c?.status === 'in_progress';
  const submit = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t || !canSend) return;
    send(t);
    setText('');
  };
  return (
    <div className="chat" hidden={!visible}>
      {connection !== 'online' && <div className="chat-banner">{tr('core.reconnecting')}</div>}
      <div className="chat-list" ref={listRef} onScroll={(e) => { const el = e.currentTarget; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40; }}>
        {messages.map((m) => (m.kind === 'system'
          ? <div key={m.messageId} className="msg-system">{m.content}</div>
          : (
            <div key={m.messageId} className={`msg ${m.senderUserId === myUserId ? 'mine' : 'theirs'}`}>
              <div className="bubble">{m.content}</div>
              <div className="msg-meta">{fmtTime(m.createdAt)}{m.senderUserId === myUserId && <span className="tick">{m.readAt ? ' ✓✓' : ' ✓'}</span>}</div>
            </div>
          )))}
        {pending.map((p) => (
          <div key={p.clientMsgId} className="msg mine pending">
            <div className="bubble">{p.content}</div>
            <div className="msg-meta">{p.failed ? <button className="link small bad" onClick={() => retry(p)}>{tr('core.failed')}</button> : tr('core.sending')}</div>
          </div>
        ))}
        {typing && <div className="typing"><span /><span /><span /></div>}
      </div>
      <form className="composer" onSubmit={submit}>
        <textarea
          rows={1}
          value={text}
          placeholder={canSend ? (placeholder || tr('core.typeMsg')) : (disabledReason || tr('core.chatOpens'))}
          disabled={!canSend}
          onChange={(e) => {
            setText(e.target.value);
            if (Date.now() - lastTyping.current > 2000) { lastTyping.current = Date.now(); notifyTyping(); }
          }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) submit(e); }}
          aria-label="Message"
          maxLength={4000}
        />
        <Button type="submit" disabled={!canSend || !text.trim()} aria-label="Send">{tr('core.send')}</Button>
      </form>
    </div>
  );
}
