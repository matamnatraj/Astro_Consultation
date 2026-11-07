import { test } from 'node:test';
import assert from 'node:assert/strict';
import { billableSeconds, amountForSeconds, splitCommission } from '../src/lib/money.js';
import { TRANSITIONS } from '../src/modules/consultations/service.js';
import { cancellationRefundPct } from '../src/modules/content/service.js';
import { calculate } from '../src/providers/astrology/builtinEngine.js';
import { zonedToUtc } from '../src/lib/timezone.js';
import { toCsv } from '../src/modules/admin/reports.js';

test('billing rounds up per started minute and caps at booked duration', () => {
  assert.equal(billableSeconds(0, 900), 0);
  assert.equal(billableSeconds(1, 900), 60);
  assert.equal(billableSeconds(61, 900), 120);
  assert.equal(billableSeconds(5000, 900), 900);
  assert.equal(amountForSeconds(3000, 120), 6000);
});

test('commission split is exact and sums to gross', () => {
  const s = splitCommission(10001, 3000);
  assert.equal(s.platformFee + s.payable, 10001);
  assert.equal(s.platformFee, 3000);
  assert.deepEqual(splitCommission(0, 3000), { gross: 0, platformFee: 0, payable: 0 });
});

test('consultation state machine forbids illegal transitions', () => {
  assert.ok(TRANSITIONS.requested.includes('accepted'));
  assert.ok(!TRANSITIONS.requested.includes('in_progress'));
  assert.ok(!TRANSITIONS.completed.length);
  assert.ok(TRANSITIONS.in_progress.includes('completed'));
  for (const to of Object.values(TRANSITIONS).flat()) assert.ok(TRANSITIONS[to], `unknown state ${to}`);
});

test('cancellation policy refund percentages', () => {
  const cfg = { fullRefundHoursBefore: 2, lateCancelRefundPct: 50 };
  const now = new Date('2026-01-01T10:00:00Z');
  assert.equal(cancellationRefundPct(cfg, { bookingType: 'scheduled', consultationStatus: 'requested', scheduledAt: '2026-01-01T10:30:00Z', now }), 100);
  assert.equal(cancellationRefundPct(cfg, { bookingType: 'scheduled', consultationStatus: 'accepted', scheduledAt: '2026-01-01T13:00:00Z', now }), 100);
  assert.equal(cancellationRefundPct(cfg, { bookingType: 'scheduled', consultationStatus: 'accepted', scheduledAt: '2026-01-01T11:00:00Z', now }), 50);
  assert.equal(cancellationRefundPct(cfg, { bookingType: 'instant', consultationStatus: 'ready', now }), 50);
  assert.equal(cancellationRefundPct(cfg, { bookingType: 'instant', consultationStatus: 'ready', now, cancelledBy: 'astrologer' }), 100);
});

test('historical time zones: India 1943 war time (+06:30) and DST gaps', () => {
  assert.equal(zonedToUtc('1943-06-01', '10:30', 'Asia/Kolkata').offsetMinutes, 390);
  assert.equal(zonedToUtc('1990-05-15', '10:30', 'Asia/Kolkata').utc.toISOString(), '1990-05-15T05:00:00.000Z');
  assert.equal(zonedToUtc('2021-03-14', '02:30', 'America/New_York').ambiguity, 'nonexistent_local_time');
  assert.equal(zonedToUtc('2021-11-07', '01:30', 'America/New_York').ambiguity, 'ambiguous_local_time');
});

// Reference case (widely published chart): M.K. Gandhi, 2 Oct 1869, 07:12 LMT, Porbandar.
// Domain-expert-approved reference cases should be added here before launch (DPR §5).
test('chart engine reference case: Libra lagna, Moon in Cancer (Ashlesha)', () => {
  const r = calculate({ birthUtc: new Date('1869-10-02T02:33:36Z'), latitude: 21.6417, longitude: 69.6293, timeKnown: true },
    { system: 'vedic', ayanamsa: 'lahiri', houseSystem: 'whole_sign' });
  const sign = (n) => r.planets.find((p) => p.name === n).sign;
  assert.equal(r.ascendant.sign, 'Libra');
  assert.equal(sign('Moon'), 'Cancer');
  assert.equal(r.planets.find((p) => p.name === 'Moon').nakshatra, 'Ashlesha');
  assert.equal(sign('Sun'), 'Virgo');
  assert.equal(sign('Mars'), 'Libra');
  assert.equal(sign('Venus'), 'Libra');
  assert.equal(sign('Mercury'), 'Libra');
  assert.equal(sign('Saturn'), 'Scorpio');
  assert.equal(sign('Jupiter'), 'Aries');
  assert.equal(sign('Rahu'), 'Cancer');
  assert.ok(Math.abs(r.ayanamsa.degrees - 22.03) < 0.05);
  assert.equal(r.houses[0].planets.sort().join(','), 'Mars,Mercury,Venus');
  assert.equal(r.dasha.mahadashas.length, 9);
});

test('chart engine: J2000 tropical positions match ephemeris', () => {
  const r = calculate({ birthUtc: new Date('2000-01-01T12:00:00Z'), latitude: 0, longitude: 0, timeKnown: true },
    { system: 'western', ayanamsa: 'lahiri', houseSystem: 'equal' });
  const lon = (n) => r.planets.find((p) => p.name === n).longitude;
  assert.ok(Math.abs(lon('Sun') - 280.37) < 0.02);
  assert.ok(Math.abs(lon('Moon') - 223.32) < 0.05);
  assert.ok(Math.abs(r.planets.reduce((s, p) => s + (p.house >= 1 && p.house <= 12 ? 1 : 0), 0) - 9) === 0);
});

test('CSV export guards against formula injection', () => {
  const csv = toCsv([{ a: '=HYPERLINK("x")', b: 'x,y', c: null }]);
  assert.equal(csv, 'a,b,c\n"\'=HYPERLINK(""x"")","x,y",');
});
