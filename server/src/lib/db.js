import pg from 'pg';
import { config } from '../config.js';

// Return BIGINT/NUMERIC as JS numbers where safe for this domain (counts, coordinates).
pg.types.setTypeParser(20, (v) => Number(v));
pg.types.setTypeParser(1700, (v) => Number(v));
// Keep DATE as 'YYYY-MM-DD' string — birth dates must not be shifted by server time zone.
pg.types.setTypeParser(1082, (v) => v);

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 20 });

export function query(text, params) {
  return pool.query(text, params);
}

export async function one(text, params) {
  const { rows } = await pool.query(text, params);
  return rows[0] || null;
}

export async function many(text, params) {
  const { rows } = await pool.query(text, params);
  return rows;
}

/** Run fn inside a transaction. fn receives a client exposing query/one/many. */
export async function tx(fn) {
  const client = await pool.connect();
  const afterCommit = [];
  const q = {
    // Side effects (realtime pushes, outbound notifications) run only after COMMIT,
    // so they can never roll back or misreport a booking/payment state.
    afterCommit: (cb) => afterCommit.push(cb),
    query: (t, p) => client.query(t, p),
    one: async (t, p) => (await client.query(t, p)).rows[0] || null,
    many: async (t, p) => (await client.query(t, p)).rows,
  };
  try {
    await client.query('BEGIN');
    const result = await fn(q);
    await client.query('COMMIT');
    for (const cb of afterCommit) {
      try { await cb(); } catch (e) { console.error('afterCommit hook failed', e); }
    }
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Use the given transaction handle if provided, else the pool. */
export function db(t) {
  return t || { query, one, many, afterCommit: (cb) => Promise.resolve().then(cb).catch((e) => console.error(e)) };
}
