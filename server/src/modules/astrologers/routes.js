import { Router } from 'express';
import { one, many, tx, query } from '../../lib/db.js';
import { parse, z } from '../../lib/validate.js';
import { badRequest, notFound, forbidden, conflict } from '../../lib/errors.js';
import { authenticate, requireRole, astrologerIdFor } from '../../lib/auth.js';
import { isValidTimeZone } from '../../lib/timezone.js';
import { putObject } from '../files/storage.js';
import { isUserOnline } from '../../realtime/hub.js';
import { LANGUAGES } from '../../lib/languages.js';

// ───────────── Public discovery (customers) ─────────────
export const discoveryRouter = Router();
discoveryRouter.use(authenticate);

export const presentAstrologer = (a, { full = false } = {}) => ({
  astrologerId: a.astrologer_id,
  displayName: a.display_name,
  bio: full ? a.bio : a.bio.slice(0, 160),
  experienceYears: a.experience_years,
  languages: a.languages,
  specialties: a.specialties,
  services: a.services,
  modes: a.modes,
  rates: { chat: a.chat_rate_paise, voice: a.voice_rate_paise, video: a.video_rate_paise },
  ratingAvg: Number(a.rating_avg),
  ratingCount: a.rating_count,
  isOnline: a.is_online && isUserOnline(a.user_id),
  isBusy: Boolean(a.is_busy),
  timezone: a.timezone,
  consultations: a.consultations ?? undefined,
  isFavorite: a.is_favorite ?? false,
  verified: a.verification_status === 'approved',
});

const csv = (v) => (v ? String(v).split(',').map((x) => x.trim()).filter(Boolean) : []);
// Shared SELECT extras: busy flag, completed consultations, and whether the caller favourited them ($1 = user id).
const EXTRAS = `EXISTS (SELECT 1 FROM consultations c WHERE c.astrologer_id = a.astrologer_id AND c.status = 'in_progress') AS is_busy,
  (SELECT count(*) FROM consultations c WHERE c.astrologer_id = a.astrologer_id AND c.status = 'completed')::int AS consultations,
  EXISTS (SELECT 1 FROM favorite_astrologers f JOIN client_profiles cp USING (client_id) WHERE f.astrologer_id = a.astrologer_id AND cp.user_id = $1) AS is_favorite`;

discoveryRouter.get('/', async (req, res) => {
  const q = parse(z.object({
    q: z.string().max(60).optional(),
    language: z.string().max(200).optional(), // comma-separated; matches any
    specialty: z.string().max(300).optional(), // comma-separated; matches any
    mode: z.enum(['chat', 'voice', 'video']).optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    minRate: z.coerce.number().int().min(0).optional(),
    maxRate: z.coerce.number().int().min(0).optional(),
    minExp: z.coerce.number().int().min(0).optional(),
    maxExp: z.coerce.number().int().min(0).optional(),
    online: z.enum(['true', 'false']).optional(),
    favorites: z.enum(['true', 'false']).optional(),
    sort: z.enum(['popular', 'rating', 'price_asc', 'price_desc', 'experience']).default('rating'),
  }), req.query);
  const where = [`a.verification_status = 'approved'`, `u.status = 'active'`];
  const p = [req.user.userId];
  const add = (v) => { p.push(v); return `$${p.length}`; };
  const rateCol = { chat: 'a.chat_rate_paise', voice: 'a.voice_rate_paise', video: 'a.video_rate_paise' }[q.mode || 'chat'];
  if (q.q) where.push(`(a.display_name ILIKE ${add(`%${q.q}%`)} OR a.bio ILIKE $${p.length} OR array_to_string(a.specialties, ' ') ILIKE $${p.length})`);
  if (csv(q.language).length) where.push(`a.languages && ${add(csv(q.language))}::text[]`);
  if (csv(q.specialty).length) where.push(`a.specialties && ${add(csv(q.specialty))}::text[]`);
  if (q.mode) where.push(`${add(q.mode)} = ANY(a.modes)`);
  if (q.minRating) where.push(`a.rating_avg >= ${add(q.minRating)}`);
  if (q.minRate !== undefined) where.push(`${rateCol} >= ${add(q.minRate)}`);
  if (q.maxRate !== undefined) where.push(`${rateCol} <= ${add(q.maxRate)}`);
  if (q.minExp !== undefined) where.push(`a.experience_years >= ${add(q.minExp)}`);
  if (q.maxExp !== undefined) where.push(`a.experience_years <= ${add(q.maxExp)}`);
  if (q.online === 'true') where.push('a.is_online');
  if (q.favorites === 'true') where.push(`EXISTS (SELECT 1 FROM favorite_astrologers f JOIN client_profiles cp USING (client_id) WHERE f.astrologer_id = a.astrologer_id AND cp.user_id = $1)`);
  const order = {
    popular: 'consultations DESC, a.rating_count DESC', rating: 'a.rating_avg DESC, a.rating_count DESC',
    price_asc: `${rateCol} ASC`, price_desc: `${rateCol} DESC`, experience: 'a.experience_years DESC',
  }[q.sort];
  const rows = await many(
    `SELECT a.*, ${EXTRAS} FROM astrologer_profiles a JOIN user_accounts u USING (user_id)
     WHERE ${where.join(' AND ')} ORDER BY a.is_online DESC, ${order} LIMIT 100`, p,
  );
  // Online first, using live presence rather than the stored toggle alone (stable sort keeps the chosen order).
  const list = rows.map((a) => presentAstrologer(a));
  list.sort((x, y) => Number(y.isOnline) - Number(x.isOnline));
  res.json(q.online === 'true' ? list.filter((a) => a.isOnline) : list);
});

discoveryRouter.put('/:id/favorite', async (req, res) => {
  const cp = await one('SELECT client_id FROM client_profiles WHERE user_id = $1', [req.user.userId]);
  if (!cp) throw forbidden('Only customers can save favourites');
  const a = await one(`SELECT 1 FROM astrologer_profiles WHERE astrologer_id = $1 AND verification_status = 'approved'`, [req.params.id]);
  if (!a) throw notFound('Astrologer');
  await query('INSERT INTO favorite_astrologers (client_id, astrologer_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [cp.client_id, req.params.id]);
  res.json({ isFavorite: true });
});

discoveryRouter.delete('/:id/favorite', async (req, res) => {
  await query(
    'DELETE FROM favorite_astrologers f USING client_profiles cp WHERE f.client_id = cp.client_id AND cp.user_id = $1 AND f.astrologer_id = $2',
    [req.user.userId, req.params.id],
  );
  res.json({ isFavorite: false });
});

discoveryRouter.get('/filters', async (_req, res) => {
  const r = await one(
    `SELECT array(SELECT DISTINCT unnest(languages) FROM astrologer_profiles WHERE verification_status='approved' ORDER BY 1) AS languages,
            array(SELECT DISTINCT unnest(specialties) FROM astrologer_profiles WHERE verification_status='approved' ORDER BY 1) AS specialties`,
  );
  res.json(r);
});

discoveryRouter.get('/:id', async (req, res) => {
  const a = await one(
    `SELECT a.*, ${EXTRAS}
     FROM astrologer_profiles a JOIN user_accounts u USING (user_id)
     WHERE a.astrologer_id = $2 AND a.verification_status = 'approved' AND u.status = 'active'`, [req.user.userId, req.params.id],
  );
  if (!a) throw notFound('Astrologer');
  const [reviews, slots] = await Promise.all([
    many(`SELECT r.rating, r.comment, r.tags, r.created_at, COALESCE(split_part(cp.full_name,' ',1),'Customer') AS reviewer
          FROM reviews r JOIN client_profiles cp USING (client_id)
          WHERE r.astrologer_id = $1 AND r.status = 'published' ORDER BY r.created_at DESC LIMIT 20`, [a.astrologer_id]),
    many(`SELECT slot_id, start_at, end_at FROM availability_slots
          WHERE astrologer_id = $1 AND status = 'open' AND start_at > now() + interval '15 minutes' AND start_at < now() + interval '14 days'
          ORDER BY start_at LIMIT 100`, [a.astrologer_id]),
  ]);
  const tagCounts = {};
  for (const rv of reviews) for (const tag of rv.tags || []) tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  const topTags = Object.entries(tagCounts).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([tag, count]) => ({ tag, count }));
  res.json({ ...presentAstrologer(a, { full: true }), reviews, topTags, slots: slots.map((s) => ({ slotId: s.slot_id, startAt: s.start_at, endAt: s.end_at })) });
});

// ───────────── Astrologer self-service ─────────────
export const selfRouter = Router();
selfRouter.use(authenticate, requireRole('astrologer'));
selfRouter.use(async (req, _res, next) => { req.astrologerId = await astrologerIdFor(req.user.userId); next(); });

const presentSelf = (a) => ({
  ...presentAstrologer(a, { full: true }),
  isOnline: a.is_online,
  verificationStatus: a.verification_status,
  verificationNotes: a.verification_notes,
  workingHours: a.working_hours,
  appLanguage: a.app_language,
  payoutDetails: a.payout_details ? { ...a.payout_details, accountNumber: mask(a.payout_details.accountNumber) } : null,
});
const mask = (s) => (s ? `••••${String(s).slice(-4)}` : null);

selfRouter.get('/me', async (req, res) => {
  const a = await one('SELECT * FROM astrologer_profiles WHERE astrologer_id = $1', [req.astrologerId]);
  const docs = await many('SELECT document_id, doc_type, file_name, status, uploaded_at FROM astrologer_documents WHERE astrologer_id = $1 ORDER BY uploaded_at', [req.astrologerId]);
  res.json({ ...presentSelf(a), documents: docs });
});

const rate = z.number().int().min(0).max(100000);
selfRouter.put('/me', async (req, res) => {
  const b = parse(z.object({
    displayName: z.string().trim().min(2).max(60),
    bio: z.string().trim().max(2000),
    experienceYears: z.number().int().min(0).max(70),
    languages: z.array(z.string().trim().min(2).max(30)).min(1).max(10),
    specialties: z.array(z.string().trim().min(2).max(40)).min(1).max(15),
    services: z.array(z.string().trim().min(2).max(60)).max(15).default([]),
    modes: z.array(z.enum(['chat', 'voice', 'video'])).min(1),
    rates: z.object({ chat: rate, voice: rate.default(0), video: rate.default(0) }),
    timezone: z.string().default('Asia/Kolkata'),
    workingHours: z.array(z.object({ day: z.number().int().min(0).max(6), start: z.string(), end: z.string() })).default([]),
  }), req.body);
  if (!isValidTimeZone(b.timezone)) throw badRequest('Unknown time zone');
  for (const m of b.modes) if (!b.rates[m]) throw badRequest(`Set a per-minute rate for ${m}`);
  const a = await one(
    `UPDATE astrologer_profiles SET display_name=$2, bio=$3, experience_years=$4, languages=$5, specialties=$6, services=$7, modes=$8,
       chat_rate_paise=$9, voice_rate_paise=$10, video_rate_paise=$11, timezone=$12, working_hours=$13, updated_at=now()
     WHERE astrologer_id = $1 RETURNING *`,
    [req.astrologerId, b.displayName, b.bio, b.experienceYears, b.languages, b.specialties, b.services, b.modes,
     b.rates.chat, b.rates.voice, b.rates.video, b.timezone, JSON.stringify(b.workingHours)],
  );
  await query('UPDATE user_accounts SET display_name = $2 WHERE user_id = $1', [req.user.userId, b.displayName]);
  res.json(presentSelf(a));
});

selfRouter.patch('/me/app-language', async (req, res) => {
  const { language } = parse(z.object({ language: z.enum(LANGUAGES) }), req.body);
  await query('UPDATE astrologer_profiles SET app_language = $2, updated_at = now() WHERE astrologer_id = $1', [req.astrologerId, language]);
  res.json({ language });
});

selfRouter.put('/me/payout-details', async (req, res) => {
  const b = parse(z.object({
    accountHolder: z.string().trim().min(2).max(100),
    accountNumber: z.string().regex(/^\d{9,18}$/),
    ifsc: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/),
    pan: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/).optional(),
  }), req.body);
  await query('UPDATE astrologer_profiles SET payout_details = $2, updated_at = now() WHERE astrologer_id = $1',
    [req.astrologerId, { ...b, verified: false }]);
  res.json({ ok: true });
});

const ALLOWED_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
selfRouter.post('/me/documents', async (req, res) => {
  const b = parse(z.object({
    docType: z.enum(['government_id', 'address_proof', 'certification', 'photo', 'other']),
    fileName: z.string().min(1).max(120),
    mimeType: z.enum(ALLOWED_DOC_TYPES),
    contentBase64: z.string().min(10),
  }), req.body);
  const buf = Buffer.from(b.contentBase64, 'base64');
  if (buf.length > 5 * 1024 * 1024) throw badRequest('File must be 5 MB or smaller');
  const key = await putObject(buf);
  const d = await one(
    `INSERT INTO astrologer_documents (astrologer_id, doc_type, file_name, mime_type, size_bytes, storage_key)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING document_id, doc_type, file_name, status, uploaded_at`,
    [req.astrologerId, b.docType, b.fileName.replace(/[^\w.\- ]/g, '_'), b.mimeType, buf.length, key],
  );
  res.status(201).json(d);
});

selfRouter.post('/me/submit-verification', async (req, res) => {
  const a = await one('SELECT * FROM astrologer_profiles WHERE astrologer_id = $1', [req.astrologerId]);
  if (!['draft', 'rejected'].includes(a.verification_status)) throw conflict(`Profile is already ${a.verification_status}`);
  const missing = [];
  if (!a.bio || a.bio.length < 50) missing.push('bio (min 50 characters)');
  if (!a.languages.length) missing.push('languages');
  if (!a.specialties.length) missing.push('specialties');
  if (!a.chat_rate_paise) missing.push('chat rate');
  const docs = await many('SELECT doc_type FROM astrologer_documents WHERE astrologer_id = $1', [req.astrologerId]);
  if (!docs.some((d) => d.doc_type === 'government_id')) missing.push('government ID document');
  if (missing.length) throw badRequest(`Complete your profile first: ${missing.join(', ')}`, { missing });
  await query(`UPDATE astrologer_profiles SET verification_status = 'submitted', updated_at = now() WHERE astrologer_id = $1`, [req.astrologerId]);
  res.json({ verificationStatus: 'submitted' });
});

selfRouter.put('/me/online', async (req, res) => {
  const { isOnline } = parse(z.object({ isOnline: z.boolean() }), req.body);
  const a = await one('SELECT verification_status FROM astrologer_profiles WHERE astrologer_id = $1', [req.astrologerId]);
  if (isOnline && a.verification_status !== 'approved') throw forbidden('Your profile must be approved before going online');
  await query('UPDATE astrologer_profiles SET is_online = $2 WHERE astrologer_id = $1', [req.astrologerId, isOnline]);
  res.json({ isOnline });
});

// Availability
selfRouter.get('/me/availability', async (req, res) => {
  const rows = await many(
    `SELECT s.slot_id, s.start_at, s.end_at, s.status, b.booking_id FROM availability_slots s
     LEFT JOIN bookings b ON b.slot_id = s.slot_id AND b.status IN ('pending_payment','confirmed')
     WHERE s.astrologer_id = $1 AND s.end_at > now() - interval '1 day' ORDER BY s.start_at LIMIT 500`, [req.astrologerId],
  );
  res.json(rows.map((s) => ({ slotId: s.slot_id, startAt: s.start_at, endAt: s.end_at, status: s.status, bookingId: s.booking_id })));
});

selfRouter.post('/me/availability', async (req, res) => {
  const b = parse(z.object({
    startAt: z.string().datetime({ offset: true }),
    endAt: z.string().datetime({ offset: true }),
    slotMinutes: z.number().int().min(15).max(120).default(30),
  }), req.body);
  const start = new Date(b.startAt); const end = new Date(b.endAt);
  if (start < new Date()) throw badRequest('Availability must be in the future');
  if (end <= start || end - start > 14 * 3600_000) throw badRequest('Window must be positive and at most 14 hours');
  const a = await one('SELECT timezone FROM astrologer_profiles WHERE astrologer_id = $1', [req.astrologerId]);
  const created = await tx(async (t) => {
    const overlap = await t.one(
      `SELECT count(*)::int AS n FROM availability_slots WHERE astrologer_id = $1 AND status <> 'blocked'
       AND tstzrange(start_at, end_at) && tstzrange($2, $3)`, [req.astrologerId, start, end],
    );
    if (overlap.n) throw conflict('This window overlaps existing availability');
    const out = [];
    for (let s = start.getTime(); s + b.slotMinutes * 60000 <= end.getTime(); s += b.slotMinutes * 60000) {
      out.push(await t.one(
        `INSERT INTO availability_slots (astrologer_id, start_at, end_at, time_zone) VALUES ($1,$2,$3,$4) RETURNING slot_id, start_at, end_at, status`,
        [req.astrologerId, new Date(s), new Date(s + b.slotMinutes * 60000), a.timezone],
      ));
    }
    return out;
  });
  res.status(201).json(created.map((s) => ({ slotId: s.slot_id, startAt: s.start_at, endAt: s.end_at, status: s.status })));
});

selfRouter.delete('/me/availability/:slotId', async (req, res) => {
  const r = await query(`DELETE FROM availability_slots WHERE slot_id = $1 AND astrologer_id = $2 AND status = 'open'`, [req.params.slotId, req.astrologerId]);
  if (!r.rowCount) throw conflict('Only open slots can be removed');
  res.json({ ok: true });
});

// Earnings: ledger-based, never a mutable balance (DPR §11 financial controls)
selfRouter.get('/me/earnings', async (req, res) => {
  const [summary, ledger, payouts] = await Promise.all([
    one(`SELECT
           COALESCE(sum(gross_paise),0)::int AS gross, COALESCE(sum(platform_fee_paise),0)::int AS platform_fees,
           COALESCE(sum(payable_paise) FILTER (WHERE status = 'pending'),0)::int AS on_hold,
           COALESCE(sum(payable_paise) FILTER (WHERE status = 'eligible'),0)::int AS eligible,
           COALESCE(sum(payable_paise) FILTER (WHERE status = 'in_payout'),0)::int AS in_payout,
           COALESCE(sum(payable_paise) FILTER (WHERE status = 'paid'),0)::int AS paid,
           count(*) FILTER (WHERE entry_type = 'earning')::int AS consultations
         FROM commission_ledger WHERE astrologer_id = $1 AND status <> 'reversed'`, [req.astrologerId]),
    many(`SELECT l.*, c.started_at, c.billable_seconds, b.mode FROM commission_ledger l
          JOIN consultations c USING (consultation_id) JOIN bookings b USING (booking_id)
          WHERE l.astrologer_id = $1 ORDER BY l.created_at DESC LIMIT 100`, [req.astrologerId]),
    many('SELECT * FROM payouts WHERE astrologer_id = $1 ORDER BY created_at DESC LIMIT 50', [req.astrologerId]),
  ]);
  res.json({ summary, ledger, payouts });
});
