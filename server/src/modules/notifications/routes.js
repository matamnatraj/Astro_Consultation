import { Router } from 'express';
import { many, query, one } from '../../lib/db.js';
import { authenticate } from '../../lib/auth.js';

const r = Router();
r.use(authenticate);

r.get('/', async (req, res) => {
  const [items, unread] = await Promise.all([
    many(`SELECT notification_id, type, title, body, data, read_at, created_at FROM notifications
          WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`, [req.user.userId]),
    one('SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL', [req.user.userId]),
  ]);
  res.json({ items, unreadCount: unread.n });
});

r.post('/read-all', async (req, res) => {
  await query('UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL', [req.user.userId]);
  res.json({ ok: true });
});

r.post('/:id/read', async (req, res) => {
  await query('UPDATE notifications SET read_at = now() WHERE notification_id = $1 AND user_id = $2', [req.params.id, req.user.userId]);
  res.json({ ok: true });
});

export default r;
