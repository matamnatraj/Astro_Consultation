import { WebSocketServer } from 'ws';
import { verifyAccessToken } from '../lib/auth.js';
import { many } from '../lib/db.js';
import { hit } from '../lib/rateLimit.js';
import { addUserSocket, removeSocket, joinRoom, leaveRoom, publishToRoom, roomPresence } from './hub.js';
import { loadConsultation, participantRole, presentConsultation, presentMessage } from '../modules/consultations/service.js';
import { postMessage, markRead } from '../modules/consultations/routes.js';

/**
 * WebSocket endpoint: /v1/realtime?token=<access token>
 * Client → server: join {consultationId, afterSeq}, leave, message {consultationId, content, clientMsgId},
 *                  typing {consultationId}, read {consultationId, upToSeq}, ping
 * Server → client: hello, joined, message, consultation.state, typing, read, presence, notification, ack, error, pong
 */
export function attachRealtime(server) {
  const wss = new WebSocketServer({ server, path: '/v1/realtime', maxPayload: 16 * 1024 });

  wss.on('connection', async (ws, req) => {
    const url = new URL(req.url, 'http://x');
    let user;
    try {
      user = await verifyAccessToken(url.searchParams.get('token') || '');
    } catch {
      ws.close(4401, 'unauthorized');
      return;
    }
    ws.userId = user.userId;
    ws.isAlive = true;
    addUserSocket(user.userId, ws);
    const send = (e) => ws.readyState === 1 && ws.send(JSON.stringify(e));
    send({ type: 'hello', userId: user.userId, serverTime: new Date().toISOString() });
    const joined = new Set();

    ws.on('pong', () => { ws.isAlive = true; });
    ws.on('close', () => {
      removeSocket(user.userId, ws);
      for (const id of joined) publishToRoom(id, { type: 'presence', consultationId: id, online: roomPresence(id) });
    });

    ws.on('message', async (raw) => {
      let msg;
      try { msg = JSON.parse(raw); } catch { return send({ type: 'error', message: 'Invalid JSON' }); }
      try {
        if (msg.type === 'ping') return send({ type: 'pong', serverTime: new Date().toISOString() });
        if (msg.type === 'join') {
          const c = await loadConsultation(null, msg.consultationId);
          const role = participantRole(c, user);
          joinRoom(c.consultation_id, ws);
          joined.add(c.consultation_id);
          // Resume: deliver anything after the client's last seen sequence.
          const backlog = await many('SELECT * FROM messages WHERE consultation_id = $1 AND seq > $2 ORDER BY seq LIMIT 500',
            [c.consultation_id, Number(msg.afterSeq || 0)]);
          send({ type: 'joined', consultation: presentConsultation(c, role), messages: backlog.map(presentMessage) });
          publishToRoom(c.consultation_id, { type: 'presence', consultationId: c.consultation_id, online: roomPresence(c.consultation_id) });
          return;
        }
        if (msg.type === 'leave') {
          leaveRoom(msg.consultationId, ws);
          joined.delete(msg.consultationId);
          return;
        }
        if (!joined.has(msg.consultationId)) return send({ type: 'error', message: 'Join the consultation first' });
        if (msg.type === 'message') {
          hit(`ws-msg:${user.userId}`, 60, 60);
          const content = String(msg.content || '').trim().slice(0, 4000);
          if (!content) return;
          const c = await loadConsultation(null, msg.consultationId);
          const m = await postMessage(c, user, { content, clientMsgId: msg.clientMsgId });
          return send({ type: 'ack', clientMsgId: msg.clientMsgId, message: m });
        }
        if (msg.type === 'typing') {
          return publishToRoom(msg.consultationId, { type: 'typing', consultationId: msg.consultationId, userId: user.userId }, ws);
        }
        if (msg.type === 'read') return markRead(msg.consultationId, user.userId, Number(msg.upToSeq));
      } catch (e) {
        send({ type: 'error', message: e.message || 'Error', code: e.code, clientMsgId: msg.clientMsgId });
      }
    });
  });

  // Heartbeat to drop dead connections.
  const interval = setInterval(() => {
    for (const ws of wss.clients) {
      if (!ws.isAlive) { ws.terminate(); continue; }
      ws.isAlive = false;
      ws.ping();
    }
  }, 30_000);
  interval.unref();
  wss.on('close', () => clearInterval(interval));
  return wss;
}
