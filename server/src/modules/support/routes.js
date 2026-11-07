import { Router } from 'express';
import { one, many, tx } from '../../lib/db.js';
import { parse, z } from '../../lib/validate.js';
import { notFound, badRequest } from '../../lib/errors.js';
import { authenticate } from '../../lib/auth.js';

const r = Router();
r.use(authenticate);

export const CATEGORIES = ['booking', 'payment', 'refund', 'consultation_quality', 'technical', 'account', 'complaint', 'other'];
const SLA_HOURS = { urgent: 4, high: 24, normal: 48, low: 96 };

export async function createTicket(t, { userId, bookingId, category, subject, description, priority = 'normal', source = 'user', transcript }) {
  const row = await t.one(
    `INSERT INTO support_tickets (requester_user_id, booking_id, category, subject, description, priority, source, sla_due_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7, now() + make_interval(hours => $8)) RETURNING *`,
    [userId, bookingId || null, category, subject, description, priority, source, SLA_HOURS[priority]],
  );
  if (transcript) {
    await t.query(`INSERT INTO ticket_messages (ticket_id, author_kind, body, internal) VALUES ($1,'assistant',$2,true)`,
      [row.ticket_id, `Assistant conversation (shared with consent):\n${transcript}`]);
  }
  return row;
}

r.post('/tickets', async (req, res) => {
  const b = parse(z.object({
    category: z.enum(CATEGORIES), subject: z.string().trim().min(3).max(150), description: z.string().trim().min(5).max(4000),
    bookingId: z.string().uuid().optional(),
  }), req.body);
  if (b.bookingId) {
    const ok = await one(
      `SELECT 1 FROM bookings b LEFT JOIN client_profiles cp USING (client_id) LEFT JOIN astrologer_profiles ap USING (astrologer_id)
       WHERE b.booking_id = $1 AND (cp.user_id = $2 OR ap.user_id = $2)`, [b.bookingId, req.user.userId],
    );
    if (!ok) throw badRequest('Unknown booking');
  }
  const priority = b.category === 'complaint' || b.category === 'payment' ? 'high' : 'normal';
  const t = await tx((t) => createTicket(t, { userId: req.user.userId, ...b, priority }));
  res.status(201).json(t);
});

r.get('/tickets', async (req, res) => {
  res.json(await many(
    `SELECT ticket_id, ticket_number, category, subject, status, priority, created_at, updated_at FROM support_tickets
     WHERE requester_user_id = $1 ORDER BY created_at DESC`, [req.user.userId],
  ));
});

r.get('/tickets/:id', async (req, res) => {
  const t = await one('SELECT * FROM support_tickets WHERE ticket_id = $1 AND requester_user_id = $2', [req.params.id, req.user.userId]);
  if (!t) throw notFound('Ticket');
  const messages = await many(
    `SELECT ticket_message_id, author_kind, body, created_at FROM ticket_messages WHERE ticket_id = $1 AND NOT internal ORDER BY created_at`, [t.ticket_id],
  );
  res.json({ ...t, messages });
});

r.post('/tickets/:id/messages', async (req, res) => {
  const { body } = parse(z.object({ body: z.string().trim().min(1).max(4000) }), req.body);
  const t = await one('SELECT ticket_id, status FROM support_tickets WHERE ticket_id = $1 AND requester_user_id = $2', [req.params.id, req.user.userId]);
  if (!t) throw notFound('Ticket');
  const m = await one(
    `INSERT INTO ticket_messages (ticket_id, author_user_id, author_kind, body) VALUES ($1,$2,'requester',$3) RETURNING *`,
    [t.ticket_id, req.user.userId, body],
  );
  await one(`UPDATE support_tickets SET updated_at = now(), status = CASE WHEN status IN ('resolved','closed') THEN 'open' ELSE status END WHERE ticket_id = $1`, [t.ticket_id]);
  res.status(201).json(m);
});

export default r;
