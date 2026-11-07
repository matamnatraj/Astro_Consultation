import { tooMany } from './errors.js';

// In-memory fixed-window limiter. For multi-instance deployments swap for Redis
// (DPR §7: Redis for rate limits and short-lived locks).
const buckets = new Map();

export function hit(key, limit, windowSec) {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.reset < now) {
    b = { count: 0, reset: now + windowSec * 1000 };
    buckets.set(key, b);
  }
  b.count += 1;
  if (b.count > limit) throw tooMany();
}

export const rateLimit = (name, limit, windowSec, keyFn = (req) => req.ip) => (req, _res, next) => {
  hit(`${name}:${keyFn(req)}`, limit, windowSec);
  next();
};

setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
}, 60_000).unref();
