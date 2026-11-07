import { Router } from 'express';
import { many, one } from '../../lib/db.js';
import { parse, z } from '../../lib/validate.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { authenticate } from '../../lib/auth.js';
import { pendingConsents, recordConsent, currentPolicy } from './service.js';

const r = Router();
const audienceFor = (role) => (role === 'astrologer' ? 'astrologers' : 'customers');

// Public: policies must be readable before sign-up.
r.get('/policies/:type', async (req, res) => {
  const p = await currentPolicy(null, req.params.type);
  if (!p) throw notFound('Policy');
  res.json({ noticeType: p.notice_type, version: p.version, title: p.title, body: p.body, config: p.config, publishedAt: p.published_at });
});

r.get('/faqs', async (req, res) => {
  const audience = req.query.audience === 'astrologers' ? 'astrologers' : 'customers';
  res.json(await many(
    `SELECT faq_id, question, answer, link FROM faqs WHERE published AND audience IN ($1,'all') ORDER BY sort_order, question`,
    [audience],
  ));
});

r.get('/announcements', authenticate, async (req, res) => {
  res.json(await many(
    `SELECT announcement_id, kind, title, body, published_at FROM announcements
     WHERE status = 'published' AND audience IN ($1,'all') AND (expires_at IS NULL OR expires_at > now())
     ORDER BY published_at DESC LIMIT 20`,
    [audienceFor(req.user.role)],
  ));
});

export const consentRouter = Router();
consentRouter.use(authenticate);

consentRouter.get('/pending', async (req, res) => {
  const rows = await pendingConsents(null, req.user.userId, req.user.role);
  res.json(rows.map((p) => ({ noticeType: p.notice_type, version: p.version, title: p.title, body: p.body })));
});

consentRouter.get('/', async (req, res) => {
  res.json(await many(
    'SELECT notice_type, notice_version, context, accepted_at FROM consent_records WHERE user_id = $1 ORDER BY accepted_at DESC',
    [req.user.userId],
  ));
});

consentRouter.post('/', async (req, res) => {
  const body = parse(z.object({
    accept: z.array(z.object({ noticeType: z.string(), version: z.number().int() })).min(1),
    context: z.string().max(100).default('app'),
  }), req.body);
  const out = [];
  for (const a of body.accept) {
    const p = await one('SELECT version FROM policy_documents WHERE notice_type = $1 AND is_current', [a.noticeType]);
    if (!p || p.version !== a.version) throw badRequest(`Notice ${a.noticeType} v${a.version} is not the current version`);
    out.push(await recordConsent(null, {
      userId: req.user.userId, noticeType: a.noticeType, version: a.version, context: body.context,
      ip: req.ip, userAgent: req.headers['user-agent'],
    }));
  }
  res.status(201).json(out);
});

export default r;
