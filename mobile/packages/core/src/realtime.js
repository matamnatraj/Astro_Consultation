import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { API_URL } from './config.js';

/**
 * One WebSocket per app with auto-reconnect (exponential backoff), reconnect when the
 * app returns to the foreground, and room re-join from the last seen message sequence.
 */
export function createRealtime(api) {
  let ws = null; let attempts = 0; let closedByUser = true; let timer = null;
  const handlers = new Set(); const statusHandlers = new Set(); const rooms = new Map();
  let status = 'idle';
  const setStatus = (s) => { status = s; statusHandlers.forEach((h) => h(s)); };

  async function connect() {
    if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
    const token = await api.accessToken().catch(() => null);
    if (!token) return;
    closedByUser = false;
    setStatus('connecting');
    ws = new WebSocket(`${API_URL.replace(/^http/, 'ws')}/v1/realtime?token=${encodeURIComponent(token)}`);
    ws.onopen = () => {
      attempts = 0;
      setStatus('online');
      for (const [id, afterSeq] of rooms) ws.send(JSON.stringify({ type: 'join', consultationId: id, afterSeq }));
    };
    ws.onmessage = (e) => {
      let ev; try { ev = JSON.parse(e.data); } catch { return; }
      if (ev.type === 'message' && rooms.has(ev.message.consultationId)) rooms.set(ev.message.consultationId, Math.max(rooms.get(ev.message.consultationId), ev.message.seq));
      handlers.forEach((h) => h(ev));
    };
    ws.onclose = () => {
      ws = null;
      setStatus('offline');
      if (closedByUser) return;
      timer = setTimeout(connect, Math.min(15000, 500 * 2 ** attempts++));
    };
    ws.onerror = () => {};
  }

  AppState.addEventListener('change', (s) => { if (s === 'active' && !closedByUser) connect(); });

  const send = (msg) => { if (ws?.readyState === 1) { ws.send(JSON.stringify(msg)); return true; } return false; };
  return {
    connect,
    disconnect() { closedByUser = true; clearTimeout(timer); ws?.close(); ws = null; },
    send,
    join(id, afterSeq = 0) { rooms.set(id, Math.max(rooms.get(id) || 0, afterSeq)); send({ type: 'join', consultationId: id, afterSeq: rooms.get(id) }); },
    leave(id) { rooms.delete(id); send({ type: 'leave', consultationId: id }); },
    on(h) { handlers.add(h); return () => handlers.delete(h); },
    onStatus(h) { statusHandlers.add(h); h(status); return () => statusHandlers.delete(h); },
  };
}

export const RealtimeContext = createContext(null);
export const useRealtimeClient = () => useContext(RealtimeContext);
export function useRealtimeEvent(handler) {
  const rt = useRealtimeClient();
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => rt?.on((ev) => ref.current(ev)), [rt]);
}
export function useRealtimeStatus() {
  const rt = useRealtimeClient();
  const [s, setS] = useState('idle');
  useEffect(() => rt?.onStatus(setS), [rt]);
  return s;
}
