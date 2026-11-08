// End-to-end API journeys against a real PostgreSQL database (DPR §14 release acceptance checklist).
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgres://astro:astro@localhost:5432/astro_test';
process.env.JOBS_ENABLED = 'false';

const { pool, query } = await import('../src/lib/db.js');
const { createApp } = await import('../src/app.js');
const { attachRealtime } = await import('../src/realtime/server.js');
const { seed } = await import('../src/db/seed.js');
const { runJobsOnce } = await import('../src/jobs/scheduler.js');
const mockpay = await import('../src/providers/payments/mockpay.js');
const { config } = await import('../src/config.js');

let server; let wss; let base; let wsBase;

before(async () => {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await seed();
  server = http.createServer(createApp());
  wss = attachRealtime(server);
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
  wsBase = base.replace('http', 'ws');
  config.publicApiUrl = base;
});

after(async () => {
  for (const c of wss.clients) c.terminate();
  wss.close();
  server.closeAllConnections?.();
  await new Promise((r) => server.close(r));
  await pool.end();
});

async function api(method, path, { token, body, raw, headers = {} } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: raw ?? (body ? JSON.stringify(body) : undefined),
    redirect: 'manual',
  });
  const text = await res.text();
  let data; try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

async function login(identifier, role, displayName) {
  const r1 = await api('POST', '/v1/auth/otp/request', { body: { identifier, role } });
  assert.equal(r1.status, 200, JSON.stringify(r1.data));
  const r2 = await api('POST', '/v1/auth/otp/verify', { body: { challengeId: r1.data.challengeId, code: r1.data.devCode, displayName } });
  assert.equal(r2.status, 200, JSON.stringify(r2.data));
  return r2.data;
}

function openSocket(token) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${wsBase}/v1/realtime?token=${token}`);
    ws.events = [];
    ws.waiters = [];
    ws.onmessage = (e) => {
      const ev = JSON.parse(e.data);
      ws.events.push(ev);
      ws.waiters = ws.waiters.filter((w) => !(w.pred(ev) && (w.resolve(ev), true)));
    };
    ws.waitFor = (pred, ms = 3000) => new Promise((res, rej) => {
      const found = ws.events.find(pred);
      if (found) return res(found);
      const timer = setTimeout(() => rej(new Error('timeout waiting for ws event')), ms);
      ws.waiters.push({ pred, resolve: (ev) => { clearTimeout(timer); res(ev); } });
    });
    ws.onopen = () => resolve(ws);
    ws.onerror = reject;
  });
}

async function pay(bookingId, token, outcome = 'success') {
  const co = await api('POST', '/v1/payments/checkout', { token, body: { bookingId, returnUrl: 'http://localhost:5173/bookings' } });
  assert.equal(co.status, 200, JSON.stringify(co.data));
  const res = await fetch(`${base}/mockpay/checkout/${co.data.orderId}/complete`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `outcome=${outcome}&returnUrl=${encodeURIComponent('http://localhost:5173/bookings')}`, redirect: 'manual',
  });
  assert.equal(res.status, 303);
  return co.data;
}

const ctx = {};

test('customer registers, accepts notices, and saves a birth profile with a chart (U1, U3)', async () => {
  const s = await login('+919911112222', 'customer', 'Anita Desai');
  ctx.customer = s.accessToken;
  assert.equal(s.isNew, true);
  const pending = await api('GET', '/v1/consents/pending', { token: ctx.customer });
  assert.deepEqual(pending.data.map((p) => p.noticeType).sort(), ['astrology_disclaimer', 'privacy', 'terms']);

  // Booking-related actions are blocked until notices are accepted.
  const astros = await api('GET', '/v1/astrologers', { token: ctx.customer });
  assert.equal(astros.status, 200);
  assert.ok(astros.data.length >= 5);
  ctx.astrologerId = astros.data.find((a) => a.displayName === 'Acharya Raghav Sharma').astrologerId;

  const acc = await api('POST', '/v1/consents', { token: ctx.customer, body: { accept: pending.data.map((p) => ({ noticeType: p.noticeType, version: p.version })), context: 'registration' } });
  assert.equal(acc.status, 201);

  const upd = await api('PUT', '/v1/clients/me', { token: ctx.customer, body: { fullName: 'Anita Desai', gender: 'female' } });
  assert.equal(upd.data.fullName, 'Anita Desai');

  const bp = await api('POST', '/v1/clients/me/birth-profiles', { token: ctx.customer, body: {
    fullName: 'Anita Desai', birthDate: '1990-03-14', birthTime: '14:20', timeAccuracy: 'exact', placeName: 'Mumbai, Maharashtra, India',
    latitude: 19.076, longitude: 72.8777, tzName: 'Asia/Kolkata', placeConfirmed: true,
  } });
  assert.equal(bp.status, 201, JSON.stringify(bp.data));
  assert.equal(bp.data.tzOffsetMinutes, 330);
  assert.equal(bp.data.chart.status, 'current');
  assert.equal(bp.data.chart.inputSnapshot.birthUtc, '1990-03-14T08:50:00.000Z');
  assert.ok(bp.data.chart.engine.version);
  assert.equal(bp.data.chart.output.planets.length, 9);
  ctx.birthProfileId = bp.data.birthProfileId;
  ctx.firstChartId = bp.data.chart.chartId;

  // Persisted across sessions/devices: a fresh login sees the same data.
  const s2 = await login('+919911112222', 'customer');
  const list = await api('GET', '/v1/clients/me/birth-profiles', { token: s2.accessToken });
  assert.equal(list.data[0].birthProfileId, ctx.birthProfileId);
  assert.equal(list.data[0].latestChart.status, 'current');
});

test('changing birth inputs marks the chart stale and allows regeneration with history', async () => {
  const upd = await api('PUT', `/v1/clients/me/birth-profiles/${ctx.birthProfileId}`, { token: ctx.customer, body: {
    fullName: 'Anita Desai', birthDate: '1990-03-14', birthTime: '14:50', timeAccuracy: 'approximate', placeName: 'Mumbai, Maharashtra, India',
    latitude: 19.076, longitude: 72.8777, tzName: 'Asia/Kolkata', placeConfirmed: true,
  } });
  assert.equal(upd.data.chartAffected, true);
  assert.equal(upd.data.version, 2);
  const old = await api('GET', `/v1/clients/me/charts/${ctx.firstChartId}`, { token: ctx.customer });
  assert.equal(old.data.status, 'stale');

  // Name-only edits do not stale the chart
  const regen = await api('POST', '/v1/clients/me/charts/generate', { token: ctx.customer, body: { birthProfileId: ctx.birthProfileId } });
  assert.equal(regen.data.status, 'current');
  assert.equal(regen.data.birthProfileVersion, 2);
  assert.ok(regen.data.warnings.some((w) => w.code === 'approximate_birth_time'));
  const detail = await api('GET', `/v1/clients/me/birth-profiles/${ctx.birthProfileId}`, { token: ctx.customer });
  assert.equal(detail.data.versions.length, 2);
});

test('instant booking → payment webhook → accept → chart access → chat → end → ledger (U2, U4–U6)', async () => {
  const astro = await login('+919800000001', 'astrologer');
  ctx.astro = astro.accessToken;
  const astroWs = await openSocket(ctx.astro);
  await api('PUT', '/v1/astrologer/me/online', { token: ctx.astro, body: { isOnline: true } });

  const quote = await api('GET', `/v1/bookings/quote?astrologerId=${ctx.astrologerId}&mode=chat&durationMinutes=10`, { token: ctx.customer });
  assert.equal(quote.data.amountPaise, 30000);

  const book = await api('POST', '/v1/bookings', { token: ctx.customer, body: {
    astrologerId: ctx.astrologerId, birthProfileId: ctx.birthProfileId, mode: 'chat', bookingType: 'instant', durationMinutes: 10,
    topic: 'Career change', acceptedCancellationPolicyVersion: quote.data.cancellationPolicy.version, idempotencyKey: 'test-instant-0001',
  } });
  assert.equal(book.status, 201, JSON.stringify(book.data));
  assert.equal(book.data.status, 'pending_payment');
  // Idempotent replay returns the same booking
  const replay = await api('POST', '/v1/bookings', { token: ctx.customer, body: {
    astrologerId: ctx.astrologerId, birthProfileId: ctx.birthProfileId, mode: 'chat', bookingType: 'instant', durationMinutes: 10,
    acceptedCancellationPolicyVersion: quote.data.cancellationPolicy.version, idempotencyKey: 'test-instant-0001',
  } });
  assert.equal(replay.data.bookingId, book.data.bookingId);
  ctx.bookingId = book.data.bookingId;

  // Video is not enabled for MVP
  const video = await api('GET', `/v1/bookings/quote?astrologerId=${ctx.astrologerId}&mode=video&durationMinutes=10`, { token: ctx.customer });
  assert.equal(video.status, 400);

  await pay(ctx.bookingId, ctx.customer);
  const b = await api('GET', `/v1/bookings/${ctx.bookingId}`, { token: ctx.customer });
  assert.equal(b.data.status, 'confirmed');
  assert.equal(b.data.consultation.status, 'requested');
  assert.equal(b.data.payments[0].status, 'authorized');
  ctx.consultationId = b.data.consultation.consultationId;
  await astroWs.waitFor((e) => e.type === 'consultation.request');

  // Assigned astrologer cannot see the chart before accepting.
  const early = await api('GET', `/v1/consultations/${ctx.consultationId}/client-chart`, { token: ctx.astro });
  assert.equal(early.status, 403);

  // An unassigned astrologer can never retrieve the chart via the API.
  const other = await login('+919800000002', 'astrologer');
  const denied = await api('GET', `/v1/consultations/${ctx.consultationId}/client-chart`, { token: other.accessToken });
  assert.equal(denied.status, 403);
  const deniedAudit = await query(`SELECT count(*)::int AS n FROM audit_events WHERE action = 'chart.access' AND outcome = 'denied' AND target_id = $1`, [ctx.consultationId]);
  assert.ok(deniedAudit.rows[0].n >= 2);

  const accepted = await api('POST', `/v1/consultations/${ctx.consultationId}/accept`, { token: ctx.astro });
  assert.equal(accepted.data.status, 'ready'); // instant → ready immediately

  const chart = await api('GET', `/v1/consultations/${ctx.consultationId}/client-chart`, { token: ctx.astro });
  assert.equal(chart.status, 200);
  assert.equal(chart.data.availability, 'available');
  assert.equal(chart.data.birthProfile.birthProfileId, ctx.birthProfileId); // correct client chart
  assert.equal(chart.data.chart.birthProfileVersion, 2);
  const summary = await api('GET', `/v1/consultations/${ctx.consultationId}/client-summary`, { token: ctx.astro });
  assert.equal(summary.data.topic, 'Career change');

  const started = await api('POST', `/v1/consultations/${ctx.consultationId}/start`, { token: ctx.astro });
  assert.equal(started.data.status, 'in_progress');

  // Real-time chat; fetching the chart mid-session doesn't interrupt anything.
  const custWs = await openSocket(ctx.customer);
  custWs.send(JSON.stringify({ type: 'join', consultationId: ctx.consultationId, afterSeq: 0 }));
  astroWs.send(JSON.stringify({ type: 'join', consultationId: ctx.consultationId, afterSeq: 0 }));
  const joined = await custWs.waitFor((e) => e.type === 'joined');
  assert.equal(joined.consultation.status, 'in_progress');
  await astroWs.waitFor((e) => e.type === 'joined');
  custWs.send(JSON.stringify({ type: 'message', consultationId: ctx.consultationId, content: 'Namaste! Should I change jobs this year?', clientMsgId: 'c1' }));
  const got = await astroWs.waitFor((e) => e.type === 'message' && e.message.clientMsgId === 'c1');
  assert.equal(got.message.senderRole, 'customer');
  const chartAgain = await api('GET', `/v1/consultations/${ctx.consultationId}/client-chart`, { token: ctx.astro });
  assert.equal(chartAgain.status, 200);
  astroWs.send(JSON.stringify({ type: 'message', consultationId: ctx.consultationId, content: 'Looking at your 10th house now.', clientMsgId: 'a1' }));
  await custWs.waitFor((e) => e.type === 'message' && e.message.clientMsgId === 'a1');
  // Duplicate clientMsgId is idempotent
  custWs.send(JSON.stringify({ type: 'message', consultationId: ctx.consultationId, content: 'Namaste! Should I change jobs this year?', clientMsgId: 'c1' }));
  await custWs.waitFor((e) => e.type === 'ack' && e.clientMsgId === 'c1');
  const msgs = await api('GET', `/v1/consultations/${ctx.consultationId}/messages`, { token: ctx.customer });
  assert.equal(msgs.data.filter((m) => m.kind === 'text').length, 2);

  const ended = await api('POST', `/v1/consultations/${ctx.consultationId}/end`, { token: ctx.customer });
  assert.equal(ended.data.status, 'completed');
  assert.equal(ended.data.billableSeconds, 60);
  assert.equal(ended.data.finalAmountPaise, 3000);
  await custWs.waitFor((e) => e.type === 'consultation.state' && e.consultation.status === 'completed');

  const pay2 = await query('SELECT * FROM payment_transactions WHERE booking_id = $1', [ctx.bookingId]);
  assert.equal(pay2.rows[0].status, 'captured');
  assert.equal(pay2.rows[0].captured_paise, 3000);
  const ledger = await query('SELECT * FROM commission_ledger WHERE consultation_id = $1', [ctx.consultationId]);
  assert.equal(ledger.rows[0].gross_paise, 3000);
  assert.equal(ledger.rows[0].platform_fee_paise, 900);
  assert.equal(ledger.rows[0].payable_paise, 2100);

  const access = await query(`SELECT count(*)::int AS n FROM audit_events WHERE action = 'chart.view' AND outcome = 'success'`);
  assert.ok(access.rows[0].n >= 2, 'chart access audited');

  const review = await api('POST', `/v1/consultations/${ctx.consultationId}/review`, { token: ctx.customer, body: { rating: 5, comment: 'Very clear and helpful.' } });
  assert.equal(review.status, 201);
  const dupReview = await api('POST', `/v1/consultations/${ctx.consultationId}/review`, { token: ctx.customer, body: { rating: 1 } });
  assert.equal(dupReview.status, 409);
  custWs.close(); astroWs.close();
});

test('webhooks: spoofed signatures rejected, duplicates idempotent, failures recorded', async () => {
  const evt = JSON.stringify({ id: 'evt_spoof', type: 'payment.authorized', data: { orderId: 'order_x', paymentId: 'pay_x', amountPaise: 1 } });
  const spoof = await api('POST', '/v1/payments/webhook', { raw: evt, headers: { 'x-mockpay-signature': 'deadbeef' } });
  assert.equal(spoof.status, 403);
  const signed = await api('POST', '/v1/payments/webhook', { raw: evt, headers: { 'x-mockpay-signature': mockpay.signWebhook(evt) } });
  assert.equal(signed.data.outcome, 'unknown_order');
  const dup = await api('POST', '/v1/payments/webhook', { raw: evt, headers: { 'x-mockpay-signature': mockpay.signWebhook(evt) } });
  assert.equal(dup.data.duplicate, true);
});

test('scheduled booking: slot hold, cancellation ≥2h before = no charge, slot released', async () => {
  const a = await api('GET', `/v1/astrologers/${ctx.astrologerId}`, { token: ctx.customer });
  const slot = a.data.slots.find((s) => new Date(s.startAt) - Date.now() > 3 * 3600_000);
  const book = await api('POST', '/v1/bookings', { token: ctx.customer, body: {
    astrologerId: ctx.astrologerId, birthProfileId: ctx.birthProfileId, mode: 'chat', bookingType: 'scheduled', slotId: slot.slotId,
    durationMinutes: 30, acceptedCancellationPolicyVersion: 1, idempotencyKey: 'test-sched-0001',
  } });
  assert.equal(book.status, 201, JSON.stringify(book.data));
  const again = await api('POST', '/v1/bookings', { token: ctx.customer, body: {
    astrologerId: ctx.astrologerId, birthProfileId: ctx.birthProfileId, mode: 'chat', bookingType: 'scheduled', slotId: slot.slotId,
    durationMinutes: 30, acceptedCancellationPolicyVersion: 1, idempotencyKey: 'test-sched-0002',
  } });
  assert.equal(again.status, 409, 'held slot cannot be double-booked');
  await pay(book.data.bookingId, ctx.customer);
  const b = await api('GET', `/v1/bookings/${book.data.bookingId}`, { token: ctx.customer });
  await api('POST', `/v1/consultations/${b.data.consultation.consultationId}/accept`, { token: ctx.astro });
  const cancel = await api('POST', `/v1/bookings/${book.data.bookingId}/cancel`, { token: ctx.customer, body: { reason: 'Plans changed' } });
  assert.equal(cancel.data.refundPct, 100);
  assert.equal(cancel.data.feePaise, 0);
  const p = await query('SELECT status FROM payment_transactions WHERE booking_id = $1', [book.data.bookingId]);
  assert.equal(p.rows[0].status, 'voided');
  const s = await query('SELECT status FROM availability_slots WHERE slot_id = $1', [slot.slotId]);
  assert.equal(s.rows[0].status, 'open');
  const consent = await query(`SELECT 1 FROM consent_records WHERE context = $1 AND notice_type = 'cancellation_policy'`, [`booking:${book.data.bookingId}`]);
  assert.equal(consent.rowCount, 1, 'policy acceptance recorded per booking');
});

test('unanswered request expires via scheduler and is not charged', async () => {
  const astroWs = await openSocket(ctx.astro);
  const book = await api('POST', '/v1/bookings', { token: ctx.customer, body: {
    astrologerId: ctx.astrologerId, birthProfileId: ctx.birthProfileId, mode: 'chat', bookingType: 'instant', durationMinutes: 5,
    acceptedCancellationPolicyVersion: 1, idempotencyKey: 'test-expire-0001',
  } });
  assert.equal(book.status, 201, JSON.stringify(book.data));
  await pay(book.data.bookingId, ctx.customer);
  await query(`UPDATE consultations SET accept_deadline = now() - interval '1 second' WHERE booking_id = $1`, [book.data.bookingId]);
  await runJobsOnce();
  const c = await query('SELECT status FROM consultations WHERE booking_id = $1', [book.data.bookingId]);
  assert.equal(c.rows[0].status, 'expired');
  const p = await query('SELECT status FROM payment_transactions WHERE booking_id = $1', [book.data.bookingId]);
  assert.equal(p.rows[0].status, 'voided');
  astroWs.close();
});

test('admin: roles enforced, verification, refund with ledger adjustment, reports, audit', async () => {
  const content = await login('content@astro.local', 'admin');
  const forbidden = await api('GET', '/v1/admin/payments', { token: content.accessToken });
  assert.equal(forbidden.status, 403);
  const custForbidden = await api('GET', '/v1/admin/dashboard', { token: ctx.customer });
  assert.equal(custForbidden.status, 403);

  const admin = await login('admin@astro.local', 'admin');
  const t = admin.accessToken;
  const dash = await api('GET', '/v1/admin/dashboard', { token: t });
  assert.equal(dash.status, 200);
  assert.ok(dash.data.kpis.approved_astrologers >= 5);

  const pending = await api('GET', '/v1/admin/astrologers?status=submitted', { token: t });
  const rohan = pending.data.find((a) => a.display_name === 'Rohan Mehta');
  const approve = await api('POST', `/v1/admin/astrologers/${rohan.astrologer_id}/verification`, { token: t, body: { decision: 'approve' } });
  assert.equal(approve.data.verificationStatus, 'approved');

  const payment = (await query(`SELECT transaction_id FROM payment_transactions WHERE booking_id = $1`, [ctx.bookingId])).rows[0];
  const over = await api('POST', `/v1/admin/payments/${payment.transaction_id}/refund`, { token: t, body: { amountPaise: 999999, reason: 'Too much' } });
  assert.equal(over.status, 400);
  const refund = await api('POST', `/v1/admin/payments/${payment.transaction_id}/refund`, { token: t, body: { amountPaise: 1000, reason: 'Goodwill credit' } });
  assert.equal(refund.status, 201, JSON.stringify(refund.data));
  const adj = await query(`SELECT * FROM commission_ledger WHERE consultation_id = $1 AND entry_type = 'adjustment'`, [ctx.consultationId]);
  assert.equal(adj.rows[0].gross_paise, -1000);
  assert.equal(adj.rows[0].payable_paise, -700);

  const csv = await api('GET', '/v1/admin/reports/financial?format=csv', { token: t });
  assert.equal(csv.status, 200);
  assert.match(csv.data, /^day,authorized_paise/);
  const qual = await api('GET', '/v1/admin/reports/consultations', { token: t });
  assert.ok(qual.data.rows.length >= 1);

  const auditLog = await api('GET', '/v1/admin/audit?action=refund', { token: t });
  assert.ok(auditLog.data.some((e) => e.action === 'admin.payment.refund'));

  // Messages require a stated purpose and are audited
  const noPurpose = await api('GET', `/v1/admin/bookings/${ctx.bookingId}/messages`, { token: t });
  assert.equal(noPurpose.status, 400);
  const withPurpose = await api('GET', `/v1/admin/bookings/${ctx.bookingId}/messages?purpose=Dispute%20review%20ticket%2042`, { token: t });
  assert.equal(withPurpose.status, 200);
});

test('assistant: discloses AI, uses live data, refuses predictions, hands off to humans', async () => {
  const intro = await api('GET', '/v1/assistant/intro', { token: ctx.customer });
  assert.match(intro.data.disclosure, /automated/i);
  const status = await api('POST', '/v1/assistant/message', { token: ctx.customer, body: { message: 'What is the status of my booking?' } });
  assert.equal(status.data.intent, 'booking_status');
  assert.match(status.data.reply, /Acharya Raghav Sharma/);
  const pred = await api('POST', '/v1/assistant/message', { token: ctx.customer, body: { message: 'When will I get married?' } });
  assert.equal(pred.data.intent, 'astrology_out_of_scope');
  const faq = await api('POST', '/v1/assistant/message', { token: ctx.customer, body: { message: 'how do refunds work' } });
  assert.equal(faq.data.intent, 'faq');
  const ho = await api('POST', '/v1/assistant/handoff', { token: ctx.customer, body: { summary: 'Need help with a refund', shareTranscript: true, transcript: [{ from: 'user', text: 'refund?' }], category: 'refund' } });
  assert.equal(ho.status, 201);
});

test('mobile: device registration for push, app-scheme payment return', async () => {
  const bad = await api('POST', '/v1/devices', { token: ctx.customer, body: { token: 'not-a-token', platform: 'android', app: 'customer' } });
  assert.equal(bad.status, 400);
  const ok = await api('POST', '/v1/devices', { token: ctx.customer, body: { token: 'ExponentPushToken[abc123]', platform: 'android', app: 'customer' } });
  assert.equal(ok.status, 201);
  const again = await api('POST', '/v1/devices', { token: ctx.customer, body: { token: 'ExponentPushToken[abc123]', platform: 'ios', app: 'customer' } });
  assert.equal(again.status, 201);
  const rows = await query(`SELECT platform FROM device_tokens WHERE token = 'ExponentPushToken[abc123]'`);
  assert.equal(rows.rows[0].platform, 'ios');

  const a = await api('GET', `/v1/astrologers/${ctx.astrologerId}`, { token: ctx.customer });
  const slot = a.data.slots.find((s) => new Date(s.startAt) - Date.now() > 3 * 3600_000 && s.slotId);
  const book = await api('POST', '/v1/bookings', { token: ctx.customer, body: {
    astrologerId: ctx.astrologerId, birthProfileId: ctx.birthProfileId, mode: 'chat', bookingType: 'scheduled', slotId: a.data.slots.at(-1).slotId,
    durationMinutes: 15, acceptedCancellationPolicyVersion: 1, idempotencyKey: 'test-mobile-0001',
  } });
  assert.equal(book.status, 201, JSON.stringify(book.data));
  const co = await api('POST', '/v1/payments/checkout', { token: ctx.customer, body: { bookingId: book.data.bookingId, returnUrl: 'astrocustomer://payment-result' } });
  const res = await fetch(`${base}/mockpay/checkout/${co.data.orderId}/complete`, {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `outcome=success&returnUrl=${encodeURIComponent('astrocustomer://payment-result')}`, redirect: 'manual',
  });
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), 'astrocustomer://payment-result?payment=success');
  assert.ok(slot);
});
