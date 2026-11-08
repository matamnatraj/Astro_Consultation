// Push delivery through Expo's push service, which forwards to FCM (Android) and APNs (iOS).
// Payloads carry only a title, a short body and routing data — never birth details or chat text.
import { many, query } from '../../lib/db.js';

const EXPO_PUSH_URL = process.env.EXPO_PUSH_URL || 'https://exp.host/--/api/v2/push/send';

export async function sendPush(notification) {
  if (process.env.NODE_ENV === 'test' || process.env.PUSH_DISABLED === 'true') return 'skipped';
  const devices = await many('SELECT token FROM device_tokens WHERE user_id = $1', [notification.user_id]);
  if (!devices.length) return 'no_device';
  const data = { type: notification.type, ...pick(notification.data, ['consultationId', 'bookingId', 'ticketId']) };
  const messages = devices.map((d) => ({ to: d.token, title: notification.title, body: notification.body, data, sound: 'default', channelId: 'default' }));
  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...(process.env.EXPO_ACCESS_TOKEN ? { authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}) },
    body: JSON.stringify(messages),
    signal: AbortSignal.timeout(8000),
  });
  const body = await res.json().catch(() => ({}));
  // Drop tokens for uninstalled apps.
  (body.data || []).forEach((t, i) => {
    if (t?.details?.error === 'DeviceNotRegistered') query('DELETE FROM device_tokens WHERE token = $1', [devices[i].token]).catch(() => {});
  });
  return res.ok ? 'sent' : 'failed';
}

const pick = (o = {}, keys) => Object.fromEntries(keys.filter((k) => o[k]).map((k) => [k, o[k]]));
