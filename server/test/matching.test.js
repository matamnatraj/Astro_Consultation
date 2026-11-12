import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchKootas, manglik, YONI_POINTS, YONI_ANIMALS } from '../src/modules/matching/engine.js';

const P = (nakshatraIndex, signIndex, degreeInSign = 10) => ({ nakshatraIndex, signIndex, degreeInSign, marsHouseFromLagna: 3, marsHouseFromMoon: 3, lagnaReliable: true });
const pts = (r, key) => r.kootas.find((k) => k.key === key).points;

test('yoni table is symmetric and has the seven traditional enemy pairs at 0', () => {
  for (let i = 0; i < 14; i++) for (let j = 0; j < 14; j++) assert.equal(YONI_POINTS[i][j], YONI_POINTS[j][i], `${YONI_ANIMALS[i]}/${YONI_ANIMALS[j]}`);
  const enemies = [['Horse', 'Buffalo'], ['Elephant', 'Lion'], ['Sheep', 'Monkey'], ['Serpent', 'Mongoose'], ['Dog', 'Deer'], ['Cat', 'Rat'], ['Cow', 'Tiger']];
  for (const [a, b] of enemies) assert.equal(YONI_POINTS[YONI_ANIMALS.indexOf(a)][YONI_ANIMALS.indexOf(b)], 0);
  for (let i = 0; i < 14; i++) assert.equal(YONI_POINTS[i][i], 4);
});

test('same nakshatra and sign scores 28/36 with Nadi dosha', () => {
  const r = matchKootas(P(3, 1), P(3, 1)); // Rohini, Taurus
  assert.equal(r.total, 28);
  assert.equal(pts(r, 'nadi'), 0);
  assert.ok(r.doshas.some((d) => d.key === 'nadi'));
});

test('Ashwini boy / Bharani girl (both Aries): every koota computed as expected', () => {
  const r = matchKootas(P(0, 0, 5), P(1, 0, 20));
  assert.deepEqual(r.kootas.map((k) => [k.key, k.points]), [['varna', 1], ['vashya', 2], ['tara', 3], ['yoni', 2], ['maitri', 5], ['gana', 6], ['bhakoot', 7], ['nadi', 8]]);
  assert.equal(r.total, 34);
  assert.equal(r.verdict, 'Excellent match');
});

test('bhakoot dosha for 6/8, 2/12 and 5/9 Moon-sign relationships', () => {
  assert.equal(pts(matchKootas(P(0, 0), P(19, 7)), 'bhakoot'), 0); // Aries / Scorpio (6/8)
  assert.equal(pts(matchKootas(P(0, 0), P(3, 1)), 'bhakoot'), 0); // Aries / Taurus (2/12)
  assert.equal(pts(matchKootas(P(0, 0), P(9, 4)), 'bhakoot'), 0); // Aries / Leo (5/9)
  assert.equal(pts(matchKootas(P(0, 0), P(14, 6)), 'bhakoot'), 7); // Aries / Libra (7/7)
});

test('graha maitri: same lord 5, Mars–Mercury (enemy/neutral) 0.5', () => {
  assert.equal(pts(matchKootas(P(0, 0), P(19, 7)), 'maitri'), 5); // Aries & Scorpio — both Mars
  assert.equal(pts(matchKootas(P(0, 0), P(5, 2)), 'maitri'), 0.5); // Mars vs Mercury
});

test('totals always within 0–36 across all nakshatra pairs', () => {
  for (let a = 0; a < 27; a++) for (let b = 0; b < 27; b++) {
    const signOf = (n) => Math.floor((n * 13.333 + 6) / 30) % 12;
    const r = matchKootas(P(a, signOf(a)), P(b, signOf(b)));
    assert.ok(r.total >= 0 && r.total <= 36);
  }
});

test('manglik: Mars in 7th from lagna is manglik; lagna ignored when time is uncertain', () => {
  assert.equal(manglik({ marsHouseFromLagna: 7, marsHouseFromMoon: 3, lagnaReliable: true }).isManglik, true);
  assert.equal(manglik({ marsHouseFromLagna: 7, marsHouseFromMoon: 3, lagnaReliable: false }).isManglik, false);
  assert.equal(manglik({ marsHouseFromLagna: 3, marsHouseFromMoon: 12, lagnaReliable: false }).isManglik, true);
});
