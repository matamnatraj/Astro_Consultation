import { db } from '../../lib/db.js';
import { zonedToUtc } from '../../lib/timezone.js';
import { badRequest } from '../../lib/errors.js';
import * as builtin from '../../providers/astrology/builtinEngine.js';

// Provider registry — add procured engines here behind the same calculate() contract.
const ENGINES = { builtin };
const ACTIVE_ENGINE = process.env.ASTRO_ENGINE || 'builtin';

export const DEFAULT_CHART_CONFIG = { system: 'vedic', ayanamsa: 'lahiri', houseSystem: 'whole_sign', chartStyle: 'north_indian' };

export function normalizeConfig(cfg = {}) {
  const c = { ...DEFAULT_CHART_CONFIG, ...cfg };
  if (c.system === 'western' && !cfg.houseSystem) c.houseSystem = 'equal';
  if (c.system === 'western' && !cfg.chartStyle) c.chartStyle = 'wheel';
  const S = builtin.SUPPORTED;
  if (!S.systems.includes(c.system)) throw badRequest(`Unsupported astrology system: ${c.system}`);
  if (!S.ayanamsas.includes(c.ayanamsa)) throw badRequest(`Unsupported ayanamsa: ${c.ayanamsa}`);
  if (!S.houseSystems.includes(c.houseSystem)) throw badRequest(`Unsupported house system: ${c.houseSystem}`);
  if (!S.chartStyles.includes(c.chartStyle)) throw badRequest(`Unsupported chart style: ${c.chartStyle}`);
  return c;
}

/** Fields whose change invalidates previously generated charts. */
export const CHART_AFFECTING_FIELDS = ['birth_date', 'birth_time', 'time_accuracy', 'latitude', 'longitude', 'tz_name'];

export function inputSnapshot(bp) {
  return {
    birthProfileId: bp.birth_profile_id,
    version: bp.version,
    birthDate: bp.birth_date,
    birthTime: bp.birth_time,
    timeAccuracy: bp.time_accuracy,
    placeName: bp.place_name,
    latitude: Number(bp.latitude),
    longitude: Number(bp.longitude),
    tzName: bp.tz_name,
  };
}

/**
 * Generate and persist a new chart version for a birth profile. Earlier
 * current charts for that profile become stale; history is never overwritten.
 */
export async function generateChart(t, bp, rawConfig) {
  const cfg = normalizeConfig(rawConfig);
  const snap = inputSnapshot(bp);
  const engine = ENGINES[ACTIVE_ENGINE];
  const warnings = [];
  const timeKnown = bp.time_accuracy !== 'unknown';
  if (bp.time_accuracy === 'approximate') {
    warnings.push({ code: 'approximate_birth_time', message: 'Birth time is approximate. Ascendant, houses and dasha dates may be inaccurate.' });
  }
  if (!timeKnown) {
    warnings.push({ code: 'unknown_birth_time', message: 'Birth time is unknown; 12:00 local time was used. Ascendant and houses are not reliable, and the Moon may be off by up to ~7°.' });
  }
  if (!bp.place_confirmed) {
    warnings.push({ code: 'place_unconfirmed', message: 'Birthplace coordinates have not been confirmed by the user.' });
  }

  let output = null;
  let status = 'current';
  let error = null;
  try {
    const { utc, offsetMinutes, ambiguity } = zonedToUtc(bp.birth_date, bp.birth_time || '12:00:00', bp.tz_name);
    if (ambiguity) warnings.push({ code: ambiguity, message: 'The local birth time falls in a daylight-saving transition; please verify it.' });
    snap.birthUtc = utc.toISOString();
    snap.utcOffsetMinutes = offsetMinutes;
    output = engine.calculate({ birthUtc: utc, latitude: snap.latitude, longitude: snap.longitude, timeKnown }, cfg);
  } catch (e) {
    status = 'failed';
    error = 'Chart calculation failed';
    warnings.push({ code: 'calculation_failed', message: 'The chart could not be calculated. Please verify the birth details or try again later.' });
    console.error('chart calculation failed', e.message); // never log birth details
  }

  if (status === 'current') {
    await db(t).query(
      `UPDATE birth_charts SET status = 'stale', stale_at = now() WHERE birth_profile_id = $1 AND status = 'current'`,
      [bp.birth_profile_id],
    );
  }
  return db(t).one(
    `INSERT INTO birth_charts (client_id, birth_profile_id, birth_profile_version, input_snapshot, config,
       engine_name, engine_version, output, warnings, status, error)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [bp.client_id, bp.birth_profile_id, bp.version, snap, cfg, engine.ENGINE_NAME, engine.ENGINE_VERSION,
     output, JSON.stringify(warnings), status, error],
  );
}

export async function latestChart(t, birthProfileId) {
  return db(t).one(
    `SELECT * FROM birth_charts WHERE birth_profile_id = $1 AND status <> 'failed' ORDER BY generated_at DESC LIMIT 1`,
    [birthProfileId],
  );
}

export function presentChart(c) {
  if (!c) return null;
  return {
    chartId: c.chart_id,
    birthProfileId: c.birth_profile_id,
    birthProfileVersion: c.birth_profile_version,
    status: c.status,
    config: c.config,
    engine: { name: c.engine_name, version: c.engine_version },
    inputSnapshot: c.input_snapshot,
    output: c.output,
    warnings: c.warnings,
    error: c.error,
    generatedAt: c.generated_at,
    staleAt: c.stale_at,
  };
}
