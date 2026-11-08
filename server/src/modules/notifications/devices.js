import { Router } from 'express';
import { query } from '../../lib/db.js';
import { parse, z } from '../../lib/validate.js';
import { authenticate } from '../../lib/auth.js';

// Register/unregister a phone for push notifications.
const r = Router();
r.use(authenticate);

r.post('/', async (req, res) => {
  const b = parse(z.object({
    token: z.string().regex(/^(Expo|Exponent)PushToken\[[\w-]+\]$/, 'Expected an Expo push token'),
    platform: z.enum(['android', 'ios', 'web']),
    app: z.enum(['customer', 'astrologer']),
  }), req.body);
  // A token moves to whoever is logged in on that device now.
  await query(
    `INSERT INTO device_tokens (token, user_id, platform, app) VALUES ($1,$2,$3,$4)
     ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, app = EXCLUDED.app, last_seen_at = now()`,
    [b.token, req.user.userId, b.platform, b.app],
  );
  res.status(201).json({ ok: true });
});

r.delete('/:token', async (req, res) => {
  await query('DELETE FROM device_tokens WHERE token = $1 AND user_id = $2', [req.params.token, req.user.userId]);
  res.json({ ok: true });
});

export default r;
