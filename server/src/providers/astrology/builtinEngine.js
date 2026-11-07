// Built-in astrology calculation engine (provider: "builtin").
//
// Positions come from astronomy-engine (VSOP87 / NOVAS-derived, arc-second
// level accuracy for the visible planets). Sidereal conversion uses a Lahiri
// (Chitrapaksha) ayanamsa approximation; houses use whole-sign (Vedic) or equal
// (tropical) systems.
//
// DPR §5: this is a reference engine behind a provider interface. Before launch,
// validate it (or a procured provider) against domain-expert-approved reference
// birth cases. Calculation output is kept separate from chart rendering.
import * as A from 'astronomy-engine';

export const ENGINE_NAME = 'builtin-astronomy-engine';
export const ENGINE_VERSION = '1.0.0';

export const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio',
  'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
export const SIGN_LORDS = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars',
  'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];
export const NAKSHATRAS = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu',
  'Pushya', 'Ashlesha', 'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati',
  'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula', 'Purva Ashadha', 'Uttara Ashadha', 'Shravana',
  'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'];
// Vimshottari dasha: nakshatra lords cycle and years
const DASHA_ORDER = ['Ketu', 'Venus', 'Sun', 'Moon', 'Mars', 'Rahu', 'Jupiter', 'Saturn', 'Mercury'];
const DASHA_YEARS = { Ketu: 7, Venus: 20, Sun: 6, Moon: 10, Mars: 7, Rahu: 18, Jupiter: 16, Saturn: 19, Mercury: 17 };

const BODIES = [
  ['Sun', A.Body.Sun], ['Moon', A.Body.Moon], ['Mars', A.Body.Mars], ['Mercury', A.Body.Mercury],
  ['Jupiter', A.Body.Jupiter], ['Venus', A.Body.Venus], ['Saturn', A.Body.Saturn],
];

export const SUPPORTED = {
  systems: ['vedic', 'western'],
  ayanamsas: ['lahiri'],
  houseSystems: ['whole_sign', 'equal'],
  chartStyles: ['north_indian', 'south_indian', 'wheel'],
};

const norm = (x) => ((x % 360) + 360) % 360;
const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;

/** Lahiri ayanamsa (degrees). 23°51'11" at J2000, precessing ~50.29"/year. */
export function lahiriAyanamsa(time) {
  const years = time.tt / 365.25;
  return 23.85306 + (years * 50.2879) / 3600 + (0.000222 * years * years) / 3600;
}

function tropicalLongitude(name, body, time) {
  if (name === 'Sun') return A.SunPosition(time).elon;
  if (name === 'Moon') return A.EclipticGeoMoon(time).lon;
  return A.Ecliptic(A.GeoVector(body, time, true)).elon;
}

/** Mean lunar node (Rahu), Meeus ch. 47. */
function meanNode(time) {
  const T = time.tt / 36525;
  return norm(125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + (T * T * T) / 467441);
}

function meanObliquity(time) {
  const T = time.tt / 36525;
  return 23.439291111 - (46.815 * T + 0.00059 * T * T - 0.001813 * T * T * T) / 3600;
}

function ascendantAndMc(time, lat, lon) {
  const ramc = norm(A.SiderealTime(time) * 15 + lon); // local apparent sidereal time in degrees
  const eps = rad(meanObliquity(time));
  const r = rad(ramc);
  const asc = norm(deg(Math.atan2(Math.cos(r), -(Math.sin(r) * Math.cos(eps) + Math.tan(rad(lat)) * Math.sin(eps)))));
  const mc = norm(deg(Math.atan2(Math.sin(r), Math.cos(r) * Math.cos(eps))));
  return { asc, mc };
}

function describe(lon) {
  const signIndex = Math.floor(lon / 30);
  const nakIndex = Math.floor(lon / (360 / 27));
  const pada = Math.floor((lon % (360 / 27)) / (360 / 108)) + 1;
  const inSign = lon - signIndex * 30;
  const d = Math.floor(inSign);
  const m = Math.floor((inSign - d) * 60);
  const s = Math.round(((inSign - d) * 60 - m) * 60);
  return {
    longitude: Number(lon.toFixed(4)),
    sign: SIGNS[signIndex],
    signIndex,
    signLord: SIGN_LORDS[signIndex],
    degreeInSign: Number(inSign.toFixed(4)),
    dms: `${d}°${String(m).padStart(2, '0')}'${String(s === 60 ? 59 : s).padStart(2, '0')}"`,
    nakshatra: NAKSHATRAS[nakIndex],
    nakshatraIndex: nakIndex,
    pada,
  };
}

function vimshottari(moonSidereal, birthUtc) {
  const span = 360 / 27;
  const nakIndex = Math.floor(moonSidereal / span);
  const fractionElapsed = (moonSidereal % span) / span;
  const startLordIdx = nakIndex % 9;
  const yearMs = 365.2425 * 86400_000;
  const periods = [];
  // The first dasha started before birth: back-date by the elapsed fraction.
  let start = birthUtc.getTime() - fractionElapsed * DASHA_YEARS[DASHA_ORDER[startLordIdx]] * yearMs;
  for (let i = 0; i < 9; i++) {
    const lord = DASHA_ORDER[(startLordIdx + i) % 9];
    const end = start + DASHA_YEARS[lord] * yearMs;
    periods.push({ lord, years: DASHA_YEARS[lord], start: new Date(start).toISOString(), end: new Date(end).toISOString() });
    start = end;
  }
  return { system: 'vimshottari', balanceAtBirthYears: Number(((1 - fractionElapsed) * DASHA_YEARS[DASHA_ORDER[startLordIdx]]).toFixed(2)), mahadashas: periods };
}

/**
 * Calculate a chart.
 * @param {object} input  { birthUtc: Date, latitude, longitude, timeKnown: boolean }
 * @param {object} cfg    { system, ayanamsa, houseSystem }
 */
export function calculate(input, cfg) {
  const time = A.MakeTime(input.birthUtc);
  const ayanamsa = cfg.system === 'vedic' ? lahiriAyanamsa(time) : 0;
  const toZodiac = (tropical) => norm(tropical - ayanamsa);
  const prevTime = time.AddDays(-0.5);
  const nextTime = time.AddDays(0.5);

  const planets = BODIES.map(([name, body]) => {
    const lon = toZodiac(tropicalLongitude(name, body, time));
    const before = tropicalLongitude(name, body, prevTime);
    const after = tropicalLongitude(name, body, nextTime);
    let speed = after - before;
    if (speed > 180) speed -= 360;
    if (speed < -180) speed += 360;
    return { name, ...describe(lon), speedDegPerDay: Number(speed.toFixed(4)), retrograde: speed < 0 };
  });
  const rahu = toZodiac(meanNode(time));
  planets.push({ name: 'Rahu', ...describe(rahu), speedDegPerDay: -0.053, retrograde: true });
  planets.push({ name: 'Ketu', ...describe(norm(rahu + 180)), speedDegPerDay: -0.053, retrograde: true });

  const { asc, mc } = ascendantAndMc(time, input.latitude, input.longitude);
  const ascendant = describe(toZodiac(asc));
  const midheaven = describe(toZodiac(mc));

  // Houses: whole-sign (house 1 = ascendant sign) or equal (30° from ascendant degree)
  const houses = Array.from({ length: 12 }, (_, i) => {
    const cusp = cfg.houseSystem === 'equal' ? norm(ascendant.longitude + i * 30) : ((ascendant.signIndex + i) % 12) * 30;
    return { house: i + 1, cusp: Number(cusp.toFixed(4)), sign: SIGNS[Math.floor(cusp / 30)], signIndex: Math.floor(cusp / 30), planets: [] };
  });
  for (const p of planets) {
    const h = cfg.houseSystem === 'equal'
      ? Math.floor(norm(p.longitude - ascendant.longitude) / 30)
      : (p.signIndex - ascendant.signIndex + 12) % 12;
    p.house = h + 1;
    houses[h].planets.push(p.name);
  }

  const moon = planets.find((p) => p.name === 'Moon');
  const sun = planets.find((p) => p.name === 'Sun');
  return {
    system: cfg.system,
    ayanamsa: cfg.system === 'vedic' ? { name: cfg.ayanamsa, degrees: Number(ayanamsa.toFixed(4)) } : null,
    houseSystem: cfg.houseSystem,
    ascendant: { ...ascendant, reliable: input.timeKnown },
    midheaven,
    planets,
    houses,
    summary: {
      lagna: ascendant.sign,
      moonSign: moon.sign,
      sunSign: sun.sign,
      janmaNakshatra: `${moon.nakshatra} (pada ${moon.pada})`,
    },
    dasha: cfg.system === 'vedic' ? vimshottari(moon.longitude, input.birthUtc) : null,
  };
}
