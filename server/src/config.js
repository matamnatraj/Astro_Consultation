// Central configuration. Secrets come from the environment (or a secrets manager
// that populates it) — never from source code or app bundles (DPR §9).
const env = process.env;
const isProd = env.NODE_ENV === 'production';

function required(name, devDefault) {
  const v = env[name];
  if (v) return v;
  if (isProd) throw new Error(`Missing required environment variable ${name}`);
  return devDefault;
}

export const config = {
  env: env.NODE_ENV || 'development',
  isProd,
  port: Number(env.PORT || 4000),
  databaseUrl: required('DATABASE_URL', 'postgres://astro:astro@localhost:5432/astro'),
  jwtSecret: required('JWT_SECRET', 'dev-only-jwt-secret-change-me'),
  accessTokenTtlSec: Number(env.ACCESS_TOKEN_TTL_SEC || 900),
  refreshTokenTtlDays: Number(env.REFRESH_TOKEN_TTL_DAYS || 30),
  // 32-byte key (hex) used for encrypting documents at rest and signing file URLs
  storageKeyHex: required('STORAGE_KEY_HEX', 'a'.repeat(64)),
  storageDir: env.STORAGE_DIR || new URL('../storage/', import.meta.url).pathname,
  publicApiUrl: env.PUBLIC_API_URL || `http://localhost:${env.PORT || 4000}`,
  corsOrigins: (env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:5174,http://localhost:5175').split(','),
  otp: {
    ttlSec: 300,
    maxAttempts: 5,
    // Development convenience: echo OTP in the API response. Never enable in production.
    devEcho: !isProd && env.OTP_DEV_ECHO !== 'false',
  },
  payments: {
    gateway: env.PAYMENT_GATEWAY || 'mockpay',
    webhookSecret: required('PAYMENT_WEBHOOK_SECRET', 'dev-webhook-secret'),
    paymentWindowMin: 15,
  },
  business: {
    currency: 'INR',
    acceptWindowMin: Number(env.ACCEPT_WINDOW_MIN || 5),
    readyLeadMin: 10, // scheduled consultation becomes "ready" this many minutes before start
    payoutHoldDays: Number(env.PAYOUT_HOLD_DAYS || 7),
    minPayoutPaise: Number(env.MIN_PAYOUT_PAISE || 50000),
    defaultPlatformFeeBps: 3000,
  },
  jobsEnabled: env.JOBS_ENABLED !== 'false',
};
