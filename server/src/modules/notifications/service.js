import { db } from '../../lib/db.js';
import { publishToUser } from '../../realtime/hub.js';
import { sendPush } from '../../providers/push/expo.js';

// Channel adapters. In production wire these to push (FCM/APNs), email and SMS
// providers. Push previews deliberately exclude birth details and message
// contents (DPR §10).
const channelAdapters = {
  in_app: async () => 'delivered',
  push: async (n) => { log('push', n); return sendPush(n); },
  email: async (n) => { log('email', n); return 'sent'; },
  sms: async (n) => { log('sms', n); return 'sent'; },
};

function log(channel, n) {
  if (process.env.NODE_ENV !== 'test') console.log(`[notify:${channel}] user=${n.user_id} type=${n.type} title="${n.title}"`);
}

/**
 * Create a notification. Runs inside the caller's transaction; outbound delivery
 * happens after commit so a delivery failure cannot affect business state.
 */
export async function notify(t, userId, { type, title, body, data = {}, channels = ['in_app', 'push'], announcementId = null }) {
  const n = await db(t).one(
    `INSERT INTO notifications (user_id, type, title, body, data, channels, announcement_id)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [userId, type, title, body, data, channels, announcementId],
  );
  db(t).afterCommit(async () => {
    publishToUser(userId, { type: 'notification', notification: n });
    const delivery = {};
    for (const ch of channels) {
      try { delivery[ch] = await channelAdapters[ch](n); } catch { delivery[ch] = 'failed'; }
    }
    await db().query('UPDATE notifications SET delivery = $2 WHERE notification_id = $1', [n.notification_id, delivery]);
  });
  return n;
}
