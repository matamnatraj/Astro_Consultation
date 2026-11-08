import { useEffect, useRef, useState, createContext, useContext } from 'react';
import { API_URL } from './api.js';

/**
 * One WebSocket per app session with auto-reconnect and exponential backoff.
 * Consumers subscribe to events; rooms are re-joined after reconnect with the
 * last seen message sequence so nothing is lost.
 */
export function createRealtime(api) {
  let ws = null;
  let attempts = 0;
  let closedByUser = false;
  let timer = null;
  const handlers = new Set();
  const statusHandlers = new Set();
  const rooms = new Map(); // consultationId -> lastSeq
  let status = 'idle';
  const setStatus = (s) => { status = s; statusHandlers.forEach((h) => h(s)); };

  async function connect() {
    const token = await api.accessToken().catch(() => null);
    if (!token) return;
    closedByUser = false;
    setStatus('connecting');
    const wsBase = API_URL ? API_URL.replace(/^http/, 'ws') : `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;
    ws = new WebSocket(`${wsBase}/v1/realtime?token=${encodeURIComponent(token)}`);
    ws.onopen = () => {
      attempts = 0;
      setStatus('online');
      for (const [id, afterSeq] of rooms) ws.send(JSON.stringify({ type: 'join', consultationId: id, afterSeq }));
    };
    ws.onmessage = (e) => {
      const ev = JSON.parse(e.data);
      if (ev.type === 'message' && rooms.has(ev.message.consultationId)) {
        rooms.set(ev.message.consultationId, Math.max(rooms.get(ev.message.consultationId), ev.message.seq));
      }
      handlers.forEach((h) => h(ev));
    };
    ws.onclose = () => {
      setStatus('offline');
      if (closedByUser) return;
      const delay = Math.min(15000, 500 * 2 ** attempts++);
      timer = setTimeout(connect, delay);
    };
  }

  const send = (msg) => {
    if (ws?.readyState === 1) { ws.send(JSON.stringify(msg)); return true; }
    return false;
  };

  return {
    connect,
    disconnect() { closedByUser = true; clearTimeout(timer); ws?.close(); },
    send,
    join(consultationId, afterSeq = 0) {
      rooms.set(consultationId, Math.max(rooms.get(consultationId) || 0, afterSeq));
      send({ type: 'join', consultationId, afterSeq: rooms.get(consultationId) });
    },
    leave(consultationId) { rooms.delete(consultationId); send({ type: 'leave', consultationId }); },
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
