// Ashtakoota (Guna Milan) kundli matching — 8 kootas, 36 points — plus a Manglik check.
// Inputs are each partner's Moon (nakshatra index 0–26, sign index 0–11, degree in sign) and
// Mars house from Lagna and from the Moon. Tables follow the standard published Ashtakoota tables;
// as with the chart engine, have them reviewed against reference cases by a domain expert before launch.

export const NAKSHATRAS = ['Ashwini', 'Bharani', 'Krittika', 'Rohini', 'Mrigashira', 'Ardra', 'Punarvasu', 'Pushya', 'Ashlesha',
  'Magha', 'Purva Phalguni', 'Uttara Phalguni', 'Hasta', 'Chitra', 'Swati', 'Vishakha', 'Anuradha', 'Jyeshtha', 'Mula',
  'Purva Ashadha', 'Uttara Ashadha', 'Shravana', 'Dhanishta', 'Shatabhisha', 'Purva Bhadrapada', 'Uttara Bhadrapada', 'Revati'];
export const SIGNS = ['Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo', 'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'];
const SIGN_LORD = ['Mars', 'Venus', 'Mercury', 'Moon', 'Sun', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Saturn', 'Jupiter'];

// 1. Varna (1 pt) — by Moon sign. Brahmin 4 > Kshatriya 3 > Vaishya 2 > Shudra 1
const VARNA_NAMES = { 4: 'Brahmin', 3: 'Kshatriya', 2: 'Vaishya', 1: 'Shudra' };
const VARNA = [3, 2, 1, 4, 3, 2, 1, 4, 3, 2, 1, 4];

// 2. Vashya (2 pts) — by Moon sign (Sagittarius and Capricorn split at 15°)
const VASHYA_TYPES = ['Chatushpada', 'Manava', 'Jalachara', 'Vanachara', 'Keeta'];
function vashyaOf(sign, degree) {
  if (sign === 8) return degree < 15 ? 'Manava' : 'Chatushpada';
  if (sign === 9) return degree < 15 ? 'Chatushpada' : 'Jalachara';
  return ['Chatushpada', 'Chatushpada', 'Manava', 'Jalachara', 'Vanachara', 'Manava', 'Manava', 'Keeta', null, null, 'Manava', 'Jalachara'][sign];
}
const VASHYA_POINTS = [
  [2, 1, 1, 0.5, 1],
  [1, 2, 0.5, 0, 1],
  [1, 0.5, 2, 1, 1],
  [0.5, 0, 1, 2, 0],
  [1, 1, 1, 0, 2],
];

// 4. Yoni (4 pts) — animal of each nakshatra
export const YONI_ANIMALS = ['Horse', 'Elephant', 'Sheep', 'Serpent', 'Dog', 'Cat', 'Rat', 'Cow', 'Buffalo', 'Tiger', 'Deer', 'Monkey', 'Mongoose', 'Lion'];
const NAK_YONI = [0, 1, 2, 3, 3, 4, 5, 2, 5, 6, 6, 7, 8, 9, 8, 9, 10, 10, 4, 11, 12, 11, 13, 0, 13, 7, 1];
export const YONI_POINTS = [
  [4, 2, 2, 3, 2, 2, 2, 1, 0, 1, 3, 3, 2, 1],
  [2, 4, 3, 3, 2, 2, 2, 2, 3, 1, 2, 3, 2, 0],
  [2, 3, 4, 2, 1, 2, 1, 3, 3, 1, 2, 0, 3, 1],
  [3, 3, 2, 4, 2, 1, 1, 1, 1, 2, 2, 2, 0, 2],
  [2, 2, 1, 2, 4, 2, 1, 2, 2, 1, 0, 2, 1, 1],
  [2, 2, 2, 1, 2, 4, 0, 2, 2, 1, 3, 3, 2, 1],
  [2, 2, 1, 1, 1, 0, 4, 2, 2, 2, 2, 2, 1, 2],
  [1, 2, 3, 1, 2, 2, 2, 4, 3, 0, 3, 2, 2, 1],
  [0, 3, 3, 1, 2, 2, 2, 3, 4, 1, 2, 2, 2, 1],
  [1, 1, 1, 2, 1, 1, 2, 0, 1, 4, 1, 1, 2, 1],
  [3, 2, 2, 2, 0, 3, 2, 3, 2, 1, 4, 2, 2, 1],
  [3, 3, 0, 2, 2, 3, 2, 2, 2, 1, 2, 4, 3, 2],
  [2, 2, 3, 0, 1, 2, 1, 2, 2, 2, 2, 3, 4, 2],
  [1, 0, 1, 2, 1, 1, 2, 1, 1, 1, 1, 2, 2, 4],
];

// 5. Graha Maitri (5 pts) — natural friendship between Moon-sign lords
const FRIENDS = {
  Sun: { f: ['Moon', 'Mars', 'Jupiter'], e: ['Venus', 'Saturn'] },
  Moon: { f: ['Sun', 'Mercury'], e: [] },
  Mars: { f: ['Sun', 'Moon', 'Jupiter'], e: ['Mercury'] },
  Mercury: { f: ['Sun', 'Venus'], e: ['Moon'] },
  Jupiter: { f: ['Sun', 'Moon', 'Mars'], e: ['Mercury', 'Venus'] },
  Venus: { f: ['Mercury', 'Saturn'], e: ['Sun', 'Moon'] },
  Saturn: { f: ['Mercury', 'Venus'], e: ['Sun', 'Moon', 'Mars'] },
};
const relation = (a, b) => (FRIENDS[a].f.includes(b) ? 'friend' : FRIENDS[a].e.includes(b) ? 'enemy' : 'neutral');
function maitriPoints(lordA, lordB) {
  if (lordA === lordB) return 5;
  const pair = [relation(lordA, lordB), relation(lordB, lordA)].sort().join('+');
  return { 'friend+friend': 5, 'friend+neutral': 4, 'neutral+neutral': 3, 'enemy+friend': 1, 'enemy+neutral': 0.5, 'enemy+enemy': 0 }[pair];
}

// 6. Gana (6 pts)
const GANA_NAMES = ['Deva', 'Manushya', 'Rakshasa'];
const NAK_GANA = [0, 1, 2, 1, 0, 1, 0, 0, 2, 2, 1, 1, 0, 2, 0, 2, 0, 2, 2, 1, 1, 0, 2, 2, 1, 1, 0];
// rows = boy's gana, cols = girl's gana
const GANA_POINTS = [[6, 6, 1], [5, 6, 0], [1, 0, 6]];

// 8. Nadi (8 pts)
const NADI_NAMES = ['Adi', 'Madhya', 'Antya'];
const NAK_NADI = [0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2, 2, 1, 0, 0, 1, 2];

const DESCRIPTIONS = {
  varna: 'Spiritual and ego compatibility (work and temperament).',
  vashya: 'Mutual attraction and influence over each other.',
  tara: 'Birth-star compatibility — health and well-being of the couple.',
  yoni: 'Physical and intimate compatibility.',
  maitri: 'Mental compatibility and friendship (Moon-sign lords).',
  gana: 'Temperament: Deva (gentle), Manushya (balanced), Rakshasa (intense).',
  bhakoot: 'Emotional compatibility, family welfare and prosperity.',
  nadi: 'Health and genes — the most heavily weighted koota.',
};

/** person: { nakshatraIndex, signIndex, degreeInSign, marsHouseFromLagna, marsHouseFromMoon, lagnaReliable } */
export function matchKootas(boy, girl) {
  const k = [];
  // Varna
  const vb = VARNA[boy.signIndex]; const vg = VARNA[girl.signIndex];
  k.push({ key: 'varna', name: 'Varna', max: 1, points: vb >= vg ? 1 : 0, boy: VARNA_NAMES[vb], girl: VARNA_NAMES[vg] });
  // Vashya
  const sb = vashyaOf(boy.signIndex, boy.degreeInSign); const sg = vashyaOf(girl.signIndex, girl.degreeInSign);
  k.push({ key: 'vashya', name: 'Vashya', max: 2, points: VASHYA_POINTS[VASHYA_TYPES.indexOf(sb)][VASHYA_TYPES.indexOf(sg)], boy: sb, girl: sg });
  // Tara: count both ways (inclusive); remainders 3, 5, 7 (Vipat, Pratyari, Vadha) are inauspicious
  const taraOk = (from, to) => ![3, 5, 7].includes((((to - from + 27) % 27) + 1) % 9);
  const taraPts = (taraOk(girl.nakshatraIndex, boy.nakshatraIndex) ? 1.5 : 0) + (taraOk(boy.nakshatraIndex, girl.nakshatraIndex) ? 1.5 : 0);
  const taraName = (from, to) => ['Parama Mitra', 'Janma', 'Sampat', 'Vipat', 'Kshema', 'Pratyari', 'Sadhaka', 'Vadha', 'Mitra'][(((to - from + 27) % 27) + 1) % 9];
  k.push({ key: 'tara', name: 'Tara', max: 3, points: taraPts, boy: taraName(girl.nakshatraIndex, boy.nakshatraIndex), girl: taraName(boy.nakshatraIndex, girl.nakshatraIndex) });
  // Yoni
  const yb = NAK_YONI[boy.nakshatraIndex]; const yg = NAK_YONI[girl.nakshatraIndex];
  k.push({ key: 'yoni', name: 'Yoni', max: 4, points: YONI_POINTS[yb][yg], boy: YONI_ANIMALS[yb], girl: YONI_ANIMALS[yg] });
  // Graha Maitri
  const lb = SIGN_LORD[boy.signIndex]; const lg = SIGN_LORD[girl.signIndex];
  k.push({ key: 'maitri', name: 'Graha Maitri', max: 5, points: maitriPoints(lb, lg), boy: lb, girl: lg });
  // Gana
  const gb = NAK_GANA[boy.nakshatraIndex]; const gg = NAK_GANA[girl.nakshatraIndex];
  k.push({ key: 'gana', name: 'Gana', max: 6, points: GANA_POINTS[gb][gg], boy: GANA_NAMES[gb], girl: GANA_NAMES[gg] });
  // Bhakoot: 2/12, 5/9, 6/8 relationships are doshas
  const dist = ((boy.signIndex - girl.signIndex + 12) % 12) + 1;
  const bhakootDosha = [2, 12, 5, 9, 6, 8].includes(dist);
  k.push({ key: 'bhakoot', name: 'Bhakoot', max: 7, points: bhakootDosha ? 0 : 7, boy: SIGNS[boy.signIndex], girl: SIGNS[girl.signIndex] });
  // Nadi
  const nb = NAK_NADI[boy.nakshatraIndex]; const ng = NAK_NADI[girl.nakshatraIndex];
  k.push({ key: 'nadi', name: 'Nadi', max: 8, points: nb === ng ? 0 : 8, boy: NADI_NAMES[nb], girl: NADI_NAMES[ng] });

  for (const x of k) x.description = DESCRIPTIONS[x.key];
  const total = k.reduce((s, x) => s + x.points, 0);
  const verdict = total >= 33 ? 'Excellent match' : total >= 25 ? 'Very good match' : total >= 18 ? 'Average match' : 'Not recommended';
  const doshas = [];
  if (nb === ng) doshas.push({ key: 'nadi', name: 'Nadi Dosha', detail: `Both have ${NADI_NAMES[nb]} Nadi.` });
  if (bhakootDosha) doshas.push({ key: 'bhakoot', name: 'Bhakoot Dosha', detail: `Moon signs are in a ${Math.min(dist, 14 - dist)}/${Math.max(dist, 14 - dist)} relationship.` });
  if (GANA_POINTS[gb][gg] <= 1 && gb !== gg) doshas.push({ key: 'gana', name: 'Gana Dosha', detail: `${GANA_NAMES[gb]} and ${GANA_NAMES[gg]} temperaments.` });
  return { kootas: k, total, max: 36, verdict, doshas };
}

/** Mars in houses 1, 2, 4, 7, 8 or 12 (from Lagna or from the Moon) — the common Manglik definition. */
const MANGLIK_HOUSES = [1, 2, 4, 7, 8, 12];
export function manglik(person) {
  const fromLagna = person.lagnaReliable && MANGLIK_HOUSES.includes(person.marsHouseFromLagna);
  const fromMoon = MANGLIK_HOUSES.includes(person.marsHouseFromMoon);
  return { isManglik: fromLagna || fromMoon, fromLagna, fromMoon, marsHouseFromLagna: person.marsHouseFromLagna, marsHouseFromMoon: person.marsHouseFromMoon, lagnaReliable: person.lagnaReliable };
}

export function manglikVerdict(b, g) {
  if (b.isManglik && g.isManglik) return 'Both are Manglik — the dosha is traditionally considered cancelled.';
  if (b.isManglik || g.isManglik) return `${b.isManglik ? 'The boy' : 'The girl'} is Manglik and the other is not — consult an astrologer about remedies.`;
  return 'Neither is Manglik.';
}
