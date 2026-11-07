// Real-time hub: WebSocket connections keyed by user, plus consultation rooms.
// Messages are persisted to PostgreSQL before broadcast (durable storage);
// clients resume from their last seen sequence number after reconnecting.
const userSockets = new Map(); // userId -> Set<ws>
const rooms = new Map(); // consultationId -> Set<ws>

export function addUserSocket(userId, ws) {
  if (!userSockets.has(userId)) userSockets.set(userId, new Set());
  userSockets.get(userId).add(ws);
}

export function removeSocket(userId, ws) {
  userSockets.get(userId)?.delete(ws);
  if (userSockets.get(userId)?.size === 0) userSockets.delete(userId);
  for (const [id, set] of rooms) {
    set.delete(ws);
    if (set.size === 0) rooms.delete(id);
  }
}

export function joinRoom(consultationId, ws) {
  if (!rooms.has(consultationId)) rooms.set(consultationId, new Set());
  rooms.get(consultationId).add(ws);
}

export function leaveRoom(consultationId, ws) {
  rooms.get(consultationId)?.delete(ws);
}

function send(ws, event) {
  if (ws.readyState === 1) ws.send(JSON.stringify(event));
}

export function publishToUser(userId, event) {
  for (const ws of userSockets.get(userId) || []) send(ws, event);
}

export function publishToRoom(consultationId, event, exceptWs) {
  for (const ws of rooms.get(consultationId) || []) if (ws !== exceptWs) send(ws, event);
}

export function isUserOnline(userId) {
  return (userSockets.get(userId)?.size || 0) > 0;
}

export function roomPresence(consultationId) {
  const users = new Set();
  for (const ws of rooms.get(consultationId) || []) users.add(ws.userId);
  return [...users];
}
