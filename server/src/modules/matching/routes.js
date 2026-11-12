import { Router } from 'express';
import { one, many, query } from '../../lib/db.js';
import { parse, z } from '../../lib/validate.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { authenticate, requireRole, clientIdFor } from '../../lib/auth.js';
import { isValidTimeZone, zonedToUtc } from '../../lib/timezone.js';
import { calculate } from '../../providers/astrology/builtinEngine.js';
import { matchKootas, manglik, manglikVerdict } from './engine.js';

const r = Router();
r.use(authenticate, requireRole('customer'));
r.use(async (req, _res, next) => { req.clientId = await clientIdFor(req.user.userId); next(); });

const personSchema = z.union([
  z.object({ birthProfileId: z.string().uuid() }),
  z.object({
    name: z.string().trim().min(1).max(100),
    birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    birthTime: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
    timeAccuracy: z.enum(['exact', 'approximate', 'unknown']).default('exact'),
    placeName: z.string().trim().min(2).max(200),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
    tzName: z.string().min(3).max(64),
  }),
]);

async function resolvePerson(clientId, p) {
  if (p.birthProfileId) {
    const bp = await one('SELECT * FROM birth_profiles WHERE birth_profile_id = $1 AND client_id = $2 AND archived_at IS NULL', [p.birthProfileId, clientId]);
    if (!bp) throw badRequest('Choose one of your saved kundlis');
    return { name: bp.full_name, birthDate: bp.birth_date, birthTime: bp.birth_time, timeAccuracy: bp.time_accuracy, placeName: bp.place_name,
      latitude: Number(bp.latitude), longitude: Number(bp.longitude), tzName: bp.tz_name, birthProfileId: bp.birth_profile_id };
  }
  if (!isValidTimeZone(p.tzName)) throw badRequest('Unknown time zone');
  const d = new Date(`${p.birthDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== p.birthDate || d > new Date() || d.getUTCFullYear() < 1800) throw badRequest(`Invalid birth date for ${p.name}`);
  if (p.timeAccuracy !== 'unknown' && !p.birthTime) throw badRequest(`Birth time is required for ${p.name} unless marked unknown`);
  return { ...p, birthTime: p.timeAccuracy === 'unknown' ? null : p.birthTime };
}

function chartFacts(person) {
  const time = person.birthTime ? (person.birthTime.length === 5 ? `${person.birthTime}:00` : person.birthTime) : '12:00:00';
  const { utc } = zonedToUtc(person.birthDate, time, person.tzName);
  const out = calculate({ birthUtc: utc, latitude: person.latitude, longitude: person.longitude, timeKnown: person.timeAccuracy !== 'unknown' },
    { system: 'vedic', ayanamsa: 'lahiri', houseSystem: 'whole_sign' });
  const moon = out.planets.find((x) => x.name === 'Moon');
  const mars = out.planets.find((x) => x.name === 'Mars');
  return {
    nakshatraIndex: moon.nakshatraIndex, signIndex: moon.signIndex, degreeInSign: moon.degreeInSign,
    marsHouseFromLagna: mars.house, marsHouseFromMoon: ((mars.signIndex - moon.signIndex + 12) % 12) + 1,
    lagnaReliable: person.timeAccuracy === 'exact',
    summary: { moonSign: moon.sign, nakshatra: `${moon.nakshatra} (pada ${moon.pada})`, lagna: out.ascendant.sign },
  };
}

const present = (m) => ({ matchId: m.match_id, boy: m.boy, girl: m.girl, total: Number(m.total), ...m.result, createdAt: m.created_at });

r.post('/', async (req, res) => {
  const b = parse(z.object({ boy: personSchema, girl: personSchema }), req.body);
  const [boy, girl] = [await resolvePerson(req.clientId, b.boy), await resolvePerson(req.clientId, b.girl)];
  const fb = chartFacts(boy); const fg = chartFacts(girl);
  const result = matchKootas(fb, fg);
  const mb = manglik(fb); const mg = manglik(fg);
  const warnings = [boy, girl].filter((p) => p.timeAccuracy !== 'exact').map((p) => `${p.name}'s birth time is ${p.timeAccuracy}; Manglik from Lagna is not assessed and the Moon may be uncertain near nakshatra boundaries.`);
  const full = {
    ...result,
    manglik: { boy: mb, girl: mg, verdict: manglikVerdict(mb, mg) },
    warnings,
    note: 'Ashtakoota is one traditional indicator. Discuss the full charts with an astrologer before making decisions.',
  };
  const side = (p, f) => ({ name: p.name, birthDate: p.birthDate, birthTime: p.birthTime, placeName: p.placeName, birthProfileId: p.birthProfileId || null, ...f.summary });
  const row = await one(
    'INSERT INTO kundli_matches (client_id, boy, girl, total, result) VALUES ($1,$2,$3,$4,$5) RETURNING *',
    [req.clientId, side(boy, fb), side(girl, fg), result.total, full],
  );
  res.status(201).json(present(row));
});

r.get('/', async (req, res) => {
  const rows = await many('SELECT * FROM kundli_matches WHERE client_id = $1 ORDER BY created_at DESC LIMIT 30', [req.clientId]);
  res.json(rows.map((m) => ({ matchId: m.match_id, boy: m.boy, girl: m.girl, total: Number(m.total), verdict: m.result.verdict, createdAt: m.created_at })));
});

r.get('/:id', async (req, res) => {
  const m = await one('SELECT * FROM kundli_matches WHERE match_id = $1 AND client_id = $2', [req.params.id, req.clientId]);
  if (!m) throw notFound('Match');
  res.json(present(m));
});

r.delete('/:id', async (req, res) => {
  await query('DELETE FROM kundli_matches WHERE match_id = $1 AND client_id = $2', [req.params.id, req.clientId]);
  res.json({ ok: true });
});

export default r;
