import { pool, tx, many } from '../lib/db.js';
import { config } from '../config.js';
import { loadConsultation, cancelBeforeStart, markReady, complete, systemMessage } from '../modules/consultations/service.js';
import { notify } from '../modules/notifications/service.js';

const LOCK_ID = 727274; // advisory lock so only one instance runs jobs

async function each(sql, params, fn) {
  const rows = await many(sql, params);
  for (const row of rows) {
    try { await fn(row); } catch (e) { if (e.status !== 409) console.error('job item failed', e.message); }
  }
  return rows.length;
}

export async function runJobsOnce() {
  const client = await pool.connect();
  try {
    const { rows } = await client.query('SELECT pg_try_advisory_lock($1) AS ok', [LOCK_ID]);
    if (!rows[0].ok) return;
    try {
      // 1. Unpaid bookings past the payment window → expired; release held slots.
      await each(`SELECT booking_id FROM bookings WHERE status = 'pending_payment' AND payment_expires_at < now()`, [], (b) => tx(async (t) => {
        const row = await t.one(`UPDATE bookings SET status = 'expired', updated_at = now() WHERE booking_id = $1 AND status = 'pending_payment' RETURNING slot_id`, [b.booking_id]);
        if (row?.slot_id) await t.query(`UPDATE availability_slots SET status = 'open', held_until = NULL WHERE slot_id = $1 AND status = 'held'`, [row.slot_id]);
      }));

      // 2. Requests not accepted in time → expired, full release.
      await each(`SELECT consultation_id FROM consultations WHERE status = 'requested' AND accept_deadline < now()`, [], (c) => tx(async (t) => {
        const full = await loadConsultation(t, c.consultation_id, true);
        if (full.status !== 'requested') return;
        await cancelBeforeStart(t, full, { to: 'expired', by: 'system', reason: 'The astrologer did not respond in time' });
      }));

      // 3. Accepted scheduled consultations → ready shortly before start.
      await each(`SELECT c.consultation_id FROM consultations c JOIN bookings b USING (booking_id)
                  WHERE c.status = 'accepted' AND b.scheduled_at - make_interval(mins => $1) <= now()`, [config.business.readyLeadMin],
      (c) => tx(async (t) => {
        const full = await loadConsultation(t, c.consultation_id, true);
        if (full.status === 'accepted') await markReady(t, full);
      }));

      // 4. Ready but never started (astrologer no-show) → expired with full release.
      await each(`SELECT c.consultation_id FROM consultations c JOIN bookings b USING (booking_id)
                  WHERE c.status = 'ready' AND COALESCE(b.scheduled_at, c.ready_at) + interval '20 minutes' < now()`, [],
      (c) => tx(async (t) => {
        const full = await loadConsultation(t, c.consultation_id, true);
        if (full.status === 'ready') await cancelBeforeStart(t, full, { to: 'expired', by: 'system', reason: 'The session was not started in time' });
      }));

      // 5. In-progress sessions: low-balance warning, then auto-end at the booked limit (server-side timer).
      await each(`SELECT consultation_id, started_at, max_billable_seconds FROM consultations WHERE status = 'in_progress'`, [], async (c) => {
        const elapsed = (Date.now() - new Date(c.started_at)) / 1000;
        if (elapsed >= c.max_billable_seconds) {
          await tx(async (t) => {
            const full = await loadConsultation(t, c.consultation_id, true);
            if (full.status === 'in_progress') await complete(t, full, { endedBy: 'system', reason: 'booked time reached' });
          });
        } else if (c.max_billable_seconds - elapsed <= 120) {
          await tx(async (t) => {
            const warned = await t.one(`SELECT 1 FROM messages WHERE consultation_id = $1 AND kind = 'system' AND content LIKE '2 minutes remaining%'`, [c.consultation_id]);
            if (!warned) await systemMessage(t, c.consultation_id, '2 minutes remaining in this session.');
          });
        }
      });

      // 6. Ledger entries past the hold period become eligible for payout.
      await pool.query(`UPDATE commission_ledger SET status = 'eligible' WHERE status = 'pending' AND eligible_at <= now()`);

      // 7. Reminders 30 minutes before scheduled sessions.
      await each(`SELECT c.consultation_id FROM consultations c JOIN bookings b USING (booking_id)
                  WHERE c.status IN ('accepted','ready') AND b.scheduled_at BETWEEN now() AND now() + interval '30 minutes'
                    AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.type = 'consultation.reminder' AND n.data->>'consultationId' = c.consultation_id::text)`,
      [], (c) => tx(async (t) => {
        const full = await loadConsultation(t, c.consultation_id);
        for (const uid of [full.client_user_id, full.astrologer_user_id]) {
          await notify(t, uid, { type: 'consultation.reminder', title: 'Consultation starting soon', body: 'Your consultation starts within 30 minutes.', data: { consultationId: c.consultation_id }, channels: ['in_app', 'push', 'sms'] });
        }
      }));
    } finally {
      await client.query('SELECT pg_advisory_unlock($1)', [LOCK_ID]);
    }
  } finally {
    client.release();
  }
}

export function startScheduler(intervalMs = 10_000) {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try { await runJobsOnce(); } catch (e) { console.error('scheduler error', e.message); } finally { running = false; }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
