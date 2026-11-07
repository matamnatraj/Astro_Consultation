import { Router } from 'express';
import { one, many, tx } from '../../lib/db.js';
import { parse, z } from '../../lib/validate.js';
import { notFound, badRequest } from '../../lib/errors.js';
import { authenticate, requireRole, clientIdFor } from '../../lib/auth.js';
import { isValidTimeZone, zonedToUtc } from '../../lib/timezone.js';
import { searchPlaces } from '../../providers/geo/gazetteer.js';
import { generateChart, presentChart, CHART_AFFECTING_FIELDS } from '../charts/service.js';
import { audit } from '../../lib/audit.js';

const r = Router();
r.use(authenticate, requireRole('customer'));
r.use(async (req, _res, next) => { req.clientId = await clientIdFor(req.user.userId); next(); });

const presentProfile = (p) => ({
  clientId: p.client_id, fullName: p.full_name, gender: p.gender, contactEmail: p.contact_email,
  contactPhone: p.contact_phone, preferredLanguage: p.preferred_language, notificationPrefs: p.notification_prefs,
  marketingOptIn: p.marketing_opt_in, updatedAt: p.updated_at,
});

r.get('/me', async (req, res) => {
  const p = await one('SELECT * FROM client_profiles WHERE client_id = $1', [req.clientId]);
  const bps = await one('SELECT count(*)::int AS n FROM birth_profiles WHERE client_id = $1 AND archived_at IS NULL', [req.clientId]);
  res.json({ ...presentProfile(p), birthProfileCount: bps.n, profileComplete: Boolean(p.full_name) && bps.n > 0 });
});

const profileSchema = z.object({
  fullName: z.string().trim().min(1).max(100),
  gender: z.enum(['female', 'male', 'non_binary', 'prefer_not_to_say']).nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  preferredLanguage: z.string().min(2).max(10).optional(),
  notificationPrefs: z.object({ push: z.boolean(), email: z.boolean(), sms: z.boolean() }).optional(),
  marketingOptIn: z.boolean().optional(),
});

r.put('/me', async (req, res) => {
  const b = parse(profileSchema, req.body);
  const p = await tx(async (t) => {
    const row = await t.one(
      `UPDATE client_profiles SET full_name = $2, gender = COALESCE($3, gender), contact_email = COALESCE($4, contact_email),
         preferred_language = COALESCE($5, preferred_language), notification_prefs = COALESCE($6, notification_prefs),
         marketing_opt_in = COALESCE($7, marketing_opt_in), updated_at = now()
       WHERE client_id = $1 RETURNING *`,
      [req.clientId, b.fullName, b.gender, b.contactEmail, b.preferredLanguage, b.notificationPrefs, b.marketingOptIn],
    );
    await t.query('UPDATE user_accounts SET display_name = $2, updated_at = now() WHERE user_id = $1', [req.user.userId, b.fullName]);
    return row;
  });
  res.json(presentProfile(p));
});

// Data portability: export everything we hold for this customer.
r.get('/me/export', async (req, res) => {
  const [profile, birthProfiles, charts, bookings, consents] = await Promise.all([
    one('SELECT * FROM client_profiles WHERE client_id = $1', [req.clientId]),
    many('SELECT * FROM birth_profiles WHERE client_id = $1', [req.clientId]),
    many('SELECT chart_id, birth_profile_id, status, config, output, generated_at FROM birth_charts WHERE client_id = $1', [req.clientId]),
    many('SELECT * FROM bookings WHERE client_id = $1', [req.clientId]),
    many('SELECT notice_type, notice_version, context, accepted_at FROM consent_records WHERE user_id = $1', [req.user.userId]),
  ]);
  await audit(null, { actor: req.user, action: 'client.data_export', targetType: 'client', targetId: req.clientId, ip: req.ip });
  res.setHeader('Content-Disposition', 'attachment; filename="my-data.json"');
  res.json({ exportedAt: new Date().toISOString(), profile, birthProfiles, charts, bookings, consents });
});

// Deletion is handled through a tracked request so retention/legal holds can be applied.
r.post('/me/deletion-request', async (req, res) => {
  const { reason } = parse(z.object({ reason: z.string().max(500).optional() }), req.body || {});
  const t = await one(
    `INSERT INTO support_tickets (requester_user_id, category, subject, description, priority, sla_due_at)
     VALUES ($1,'account','Account deletion request',$2,'high', now() + interval '72 hours') RETURNING ticket_id, ticket_number`,
    [req.user.userId, reason || 'Customer requested deletion of account and personal data.'],
  );
  res.status(201).json({ ticketId: t.ticket_id, ticketNumber: t.ticket_number });
});

// ───────────── Birth profiles ─────────────
const birthSchema = z.object({
  label: z.string().trim().min(1).max(40).default('Self'),
  fullName: z.string().trim().min(1).max(100),
  gender: z.enum(['female', 'male', 'non_binary', 'prefer_not_to_say']).nullable().optional(),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  birthTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  timeAccuracy: z.enum(['exact', 'approximate', 'unknown']),
  timeSource: z.string().max(100).nullable().optional(),
  placeName: z.string().trim().min(2).max(200),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  tzName: z.string().min(3).max(64),
  placeConfirmed: z.boolean().default(false),
  isPrimary: z.boolean().optional(),
});

function validateBirth(b) {
  if (!isValidTimeZone(b.tzName)) throw badRequest('Unknown time zone');
  const d = new Date(`${b.birthDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== b.birthDate) throw badRequest('Invalid birth date');
  if (d.getUTCFullYear() < 1800 || d > new Date()) throw badRequest('Birth date must be between 1800 and today');
  if (b.timeAccuracy !== 'unknown' && !b.birthTime) throw badRequest('Birth time is required unless marked unknown');
  const time = b.timeAccuracy === 'unknown' ? null : (b.birthTime.length === 5 ? `${b.birthTime}:00` : b.birthTime);
  // Server resolves the historical UTC offset — never trust a client-calculated value.
  const { offsetMinutes } = zonedToUtc(b.birthDate, time || '12:00:00', b.tzName);
  return { time, offsetMinutes };
}

export const presentBirth = (b) => ({
  birthProfileId: b.birth_profile_id, label: b.label, fullName: b.full_name, gender: b.gender, birthDate: b.birth_date,
  birthTime: b.birth_time, timeAccuracy: b.time_accuracy, timeSource: b.time_source, placeName: b.place_name,
  latitude: Number(b.latitude), longitude: Number(b.longitude), tzName: b.tz_name, tzOffsetMinutes: b.tz_offset_minutes,
  placeConfirmed: b.place_confirmed, isPrimary: b.is_primary, version: b.version, updatedAt: b.updated_at,
});

async function ownBirthProfile(t, clientId, id, lock = false) {
  const bp = await t.one(
    `SELECT * FROM birth_profiles WHERE birth_profile_id = $1 AND client_id = $2 AND archived_at IS NULL ${lock ? 'FOR UPDATE' : ''}`,
    [id, clientId],
  );
  if (!bp) throw notFound('Birth profile');
  return bp;
}

r.get('/me/birth-profiles', async (req, res) => {
  const rows = await many(
    `SELECT b.*, c.chart_id, c.status AS chart_status FROM birth_profiles b
     LEFT JOIN LATERAL (SELECT chart_id, status FROM birth_charts WHERE birth_profile_id = b.birth_profile_id AND status <> 'failed'
                        ORDER BY generated_at DESC LIMIT 1) c ON true
     WHERE b.client_id = $1 AND b.archived_at IS NULL ORDER BY b.is_primary DESC, b.created_at`,
    [req.clientId],
  );
  res.json(rows.map((b) => ({ ...presentBirth(b), latestChart: b.chart_id ? { chartId: b.chart_id, status: b.chart_status } : null })));
});

r.post('/me/birth-profiles', async (req, res) => {
  const b = parse(birthSchema, req.body);
  const { time, offsetMinutes } = validateBirth(b);
  const created = await tx(async (t) => {
    const count = await t.one('SELECT count(*)::int AS n FROM birth_profiles WHERE client_id = $1 AND archived_at IS NULL', [req.clientId]);
    if (count.n >= 10) throw badRequest('Maximum of 10 birth profiles');
    const primary = b.isPrimary ?? count.n === 0;
    if (primary) await t.query('UPDATE birth_profiles SET is_primary = false WHERE client_id = $1', [req.clientId]);
    const bp = await t.one(
      `INSERT INTO birth_profiles (client_id, label, full_name, gender, birth_date, birth_time, time_accuracy, time_source,
         place_name, latitude, longitude, tz_name, tz_offset_minutes, place_confirmed, is_primary)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
      [req.clientId, b.label, b.fullName, b.gender || null, b.birthDate, time, b.timeAccuracy, b.timeSource || null,
       b.placeName, b.latitude, b.longitude, b.tzName, offsetMinutes, b.placeConfirmed, primary],
    );
    await t.query('INSERT INTO birth_profile_versions (birth_profile_id, version, snapshot, changed_by) VALUES ($1,1,$2,$3)',
      [bp.birth_profile_id, presentBirth(bp), req.user.userId]);
    // Generate the chart immediately when inputs are complete (U3: store generated chart).
    const chart = await generateChart(t, bp, req.body.chartConfig);
    return { bp, chart };
  });
  res.status(201).json({ ...presentBirth(created.bp), chart: presentChart(created.chart) });
});

r.get('/me/birth-profiles/:id', async (req, res) => {
  const bp = await ownBirthProfile({ one }, req.clientId, req.params.id);
  const versions = await many(
    'SELECT version, snapshot, created_at FROM birth_profile_versions WHERE birth_profile_id = $1 ORDER BY version DESC',
    [bp.birth_profile_id],
  );
  res.json({ ...presentBirth(bp), versions });
});

r.put('/me/birth-profiles/:id', async (req, res) => {
  const b = parse(birthSchema, req.body);
  const { time, offsetMinutes } = validateBirth(b);
  const out = await tx(async (t) => {
    const old = await ownBirthProfile(t, req.clientId, req.params.id, true);
    const next = { birth_date: b.birthDate, birth_time: time, time_accuracy: b.timeAccuracy, latitude: b.latitude, longitude: b.longitude, tz_name: b.tzName };
    const chartAffected = CHART_AFFECTING_FIELDS.some((f) => {
      const a = old[f]; const n = next[f];
      return typeof n === 'number' ? Math.abs(Number(a) - n) > 1e-6 : String(a ?? '') !== String(n ?? '');
    });
    if (b.isPrimary) await t.query('UPDATE birth_profiles SET is_primary = false WHERE client_id = $1', [req.clientId]);
    const bp = await t.one(
      `UPDATE birth_profiles SET label=$2, full_name=$3, gender=$4, birth_date=$5, birth_time=$6, time_accuracy=$7, time_source=$8,
         place_name=$9, latitude=$10, longitude=$11, tz_name=$12, tz_offset_minutes=$13, place_confirmed=$14,
         is_primary = COALESCE($15, is_primary), version = version + 1, updated_at = now()
       WHERE birth_profile_id = $1 RETURNING *`,
      [old.birth_profile_id, b.label, b.fullName, b.gender || null, b.birthDate, time, b.timeAccuracy, b.timeSource || null,
       b.placeName, b.latitude, b.longitude, b.tzName, offsetMinutes, b.placeConfirmed, b.isPrimary ?? null],
    );
    await t.query('INSERT INTO birth_profile_versions (birth_profile_id, version, snapshot, changed_by) VALUES ($1,$2,$3,$4)',
      [bp.birth_profile_id, bp.version, presentBirth(bp), req.user.userId]);
    let staleCharts = 0;
    if (chartAffected) {
      // Do not silently overwrite: mark existing charts stale and offer regeneration.
      const r2 = await t.query(
        `UPDATE birth_charts SET status = 'stale', stale_at = now() WHERE birth_profile_id = $1 AND status = 'current'`,
        [bp.birth_profile_id],
      );
      staleCharts = r2.rowCount;
    }
    return { bp, chartAffected, staleCharts };
  });
  res.json({ ...presentBirth(out.bp), chartAffected: out.chartAffected, staleCharts: out.staleCharts });
});

r.delete('/me/birth-profiles/:id', async (req, res) => {
  await tx(async (t) => {
    const bp = await ownBirthProfile(t, req.clientId, req.params.id, true);
    await t.query('UPDATE birth_profiles SET archived_at = now(), is_primary = false WHERE birth_profile_id = $1', [bp.birth_profile_id]);
  });
  res.json({ ok: true });
});

// ───────────── Charts ─────────────
r.post('/me/charts/generate', async (req, res) => {
  const b = parse(z.object({
    birthProfileId: z.string().uuid(),
    config: z.object({
      system: z.enum(['vedic', 'western']).optional(), ayanamsa: z.string().optional(),
      houseSystem: z.string().optional(), chartStyle: z.string().optional(),
    }).optional(),
  }), req.body);
  const chart = await tx(async (t) => {
    const bp = await ownBirthProfile(t, req.clientId, b.birthProfileId, true);
    return generateChart(t, bp, b.config);
  });
  res.status(201).json(presentChart(chart));
});

r.get('/me/charts', async (req, res) => {
  const params = [req.clientId];
  let filter = '';
  if (req.query.birthProfileId) { params.push(req.query.birthProfileId); filter = 'AND birth_profile_id = $2'; }
  const rows = await many(`SELECT * FROM birth_charts WHERE client_id = $1 ${filter} ORDER BY generated_at DESC LIMIT 50`, params);
  res.json(rows.map(presentChart));
});

r.get('/me/charts/:id', async (req, res) => {
  const c = await one('SELECT * FROM birth_charts WHERE chart_id = $1 AND client_id = $2', [req.params.id, req.clientId]);
  if (!c) throw notFound('Chart');
  res.json(presentChart(c));
});

export const placesRouter = Router();
placesRouter.get('/', authenticate, (req, res) => {
  res.json(searchPlaces(String(req.query.q || '')));
});

export default r;
