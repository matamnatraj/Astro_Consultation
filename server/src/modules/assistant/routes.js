// Support assistant (DPR §12). Clearly labelled as automated, limited to
// approved topics, answers FAQs only from admin-approved knowledge content, and
// fetches transactional facts (booking/payment status, prices) live from the
// backend — it never states them from memory. Anything else is handed off to a
// human via a support ticket. The answer engine is a retrieval provider; an LLM
// provider can be plugged in later behind `answer()` with the same grounding rules.
import { Router } from 'express';
import { many, one, tx } from '../../lib/db.js';
import { parse, z } from '../../lib/validate.js';
import { authenticate } from '../../lib/auth.js';
import { rupees } from '../../lib/money.js';
import { createTicket } from '../support/routes.js';

const r = Router();
r.use(authenticate);

const DISCLOSURE = 'I am an automated assistant, not a human or an astrologer. I can help with app questions, bookings and payments. I cannot give astrological predictions.';
const STOP = new Set('a an the is are was i my me to of for in on and or do does can how what when why where with it this that you your be have has'.split(' '));
const tokens = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));

const ASTROLOGY_PATTERNS = /\b(predict|prediction|future|horoscope|will i|marriage|when will|kundli match|compatib|lucky|remedy|gemstone|dosha)\b/i;
const HUMAN_PATTERNS = /\b(human|agent|person|talk to someone|support team|complain|complaint|escalate)\b/i;
const BOOKING_PATTERNS = /\b(booking|consultation|session|status|accepted|appointment)\b/i;
const PAYMENT_PATTERNS = /\b(payment|refund|charged|money|paid|deducted|receipt)\b/i;
const PRICE_PATTERNS = /\b(price|cost|rate|charge|fee|how much)\b/i;

export async function answer(user, message) {
  const text = message.trim();
  if (HUMAN_PATTERNS.test(text)) return { intent: 'handoff', reply: 'I can connect you with our support team. Tap "Talk to a human" and I will create a ticket with this conversation.', suggestHandoff: true };
  if (ASTROLOGY_PATTERNS.test(text)) {
    return { intent: 'astrology_out_of_scope', reply: 'I cannot provide astrological readings or predictions. For guidance on your chart, please book a consultation with one of our verified astrologers.', link: '/astrologers' };
  }
  if (user.role === 'customer' && PAYMENT_PATTERNS.test(text)) {
    const rows = await many(
      `SELECT p.status, p.amount_paise, p.captured_paise, p.refunded_paise, p.created_at, a.display_name FROM payment_transactions p
       JOIN bookings b USING (booking_id) JOIN client_profiles cp USING (client_id) JOIN astrologer_profiles a USING (astrologer_id)
       WHERE cp.user_id = $1 AND p.status <> 'created' ORDER BY p.created_at DESC LIMIT 3`, [user.userId],
    );
    if (!rows.length) return { intent: 'payment_status', reply: 'I could not find any payments on your account.' };
    const lines = rows.map((p) => `• ${p.display_name}: ₹${rupees(p.amount_paise)} — ${p.status.replace('_', ' ')}${p.captured_paise ? `, charged ₹${rupees(p.captured_paise)}` : ''}${p.refunded_paise ? `, refunded ₹${rupees(p.refunded_paise)}` : ''}`);
    return { intent: 'payment_status', reply: `Here are your latest payments (live from our records):\n${lines.join('\n')}\nIf something looks wrong, I can hand you over to support.`, link: '/history', suggestHandoff: true };
  }
  if (user.role === 'customer' && BOOKING_PATTERNS.test(text) && !PRICE_PATTERNS.test(text)) {
    const rows = await many(
      `SELECT b.status AS booking_status, c.status AS consultation_status, b.scheduled_at, b.booking_type, a.display_name FROM bookings b
       JOIN client_profiles cp USING (client_id) JOIN astrologer_profiles a USING (astrologer_id) LEFT JOIN consultations c USING (booking_id)
       WHERE cp.user_id = $1 ORDER BY b.created_at DESC LIMIT 3`, [user.userId],
    );
    if (!rows.length) return { intent: 'booking_status', reply: 'You have no bookings yet. You can browse astrologers to book one.', link: '/astrologers' };
    const lines = rows.map((b) => `• ${b.display_name} (${b.booking_type}${b.scheduled_at ? `, ${new Date(b.scheduled_at).toUTCString()}` : ''}): ${(b.consultation_status || b.booking_status).replace('_', ' ')}`);
    return { intent: 'booking_status', reply: `Your latest bookings (live status):\n${lines.join('\n')}`, link: '/history' };
  }
  if (PRICE_PATTERNS.test(text)) {
    const names = await many(`SELECT display_name, chat_rate_paise FROM astrologer_profiles WHERE verification_status = 'approved'`);
    const hit = names.find((a) => text.toLowerCase().includes(a.display_name.toLowerCase().split(' ')[0]));
    if (hit) return { intent: 'pricing', reply: `${hit.display_name}'s current chat rate is ₹${rupees(hit.chat_rate_paise)} per minute (live from our pricing service). The exact total is shown before you pay.` };
    const range = await one(`SELECT min(chat_rate_paise) AS lo, max(chat_rate_paise) AS hi FROM astrologer_profiles WHERE verification_status = 'approved'`);
    if (range?.lo) return { intent: 'pricing', reply: `Each astrologer sets their own per-minute rate — currently between ₹${rupees(range.lo)} and ₹${rupees(range.hi)} per minute for chat. You always see the exact price before paying.`, link: '/astrologers' };
  }
  // FAQ retrieval over approved knowledge content
  const audience = user.role === 'astrologer' ? 'astrologers' : 'customers';
  const faqs = await many(`SELECT question, answer, keywords, link FROM faqs WHERE published AND audience IN ($1,'all')`, [audience]);
  const q = new Set(tokens(text));
  let best = null; let bestScore = 0;
  for (const f of faqs) {
    const ft = new Set([...tokens(f.question), ...f.keywords.map((k) => k.toLowerCase())]);
    let score = 0;
    for (const w of q) if (ft.has(w)) score += 1;
    const norm = score / Math.sqrt(ft.size || 1);
    if (norm > bestScore) { bestScore = norm; best = f; }
  }
  if (best && bestScore >= 0.3) return { intent: 'faq', reply: best.answer, link: best.link, source: best.question };
  return { intent: 'fallback', reply: "I'm not sure about that. I can connect you with our support team if you'd like.", suggestHandoff: true };
}

r.get('/intro', (_req, res) => res.json({ disclosure: DISCLOSURE, label: 'Automated assistant (AI)' }));

r.post('/message', async (req, res) => {
  const { message } = parse(z.object({ message: z.string().trim().min(1).max(500) }), req.body);
  res.json({ label: 'Automated assistant (AI)', ...(await answer(req.user, message)) });
});

r.post('/handoff', async (req, res) => {
  const b = parse(z.object({
    summary: z.string().trim().min(3).max(300),
    transcript: z.array(z.object({ from: z.enum(['user', 'assistant']), text: z.string().max(2000) })).max(40).default([]),
    shareTranscript: z.boolean().default(false),
    category: z.enum(['booking', 'payment', 'refund', 'technical', 'account', 'complaint', 'other']).default('other'),
  }), req.body);
  const ticket = await tx((t) => createTicket(t, {
    userId: req.user.userId, category: b.category, subject: b.summary.slice(0, 150), description: b.summary,
    source: 'assistant_handoff',
    transcript: b.shareTranscript ? b.transcript.map((m) => `${m.from}: ${m.text}`).join('\n') : null,
  }));
  res.status(201).json({ ticketId: ticket.ticket_id, ticketNumber: ticket.ticket_number, reply: `I've created support ticket #${ticket.ticket_number}. A member of our team will respond soon.` });
});

export default r;
