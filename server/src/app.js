import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config.js';
import { AppError } from './lib/errors.js';
import { pool } from './lib/db.js';
import authRoutes, { meRouter } from './modules/auth/routes.js';
import contentRoutes, { consentRouter } from './modules/content/routes.js';
import clientRoutes, { placesRouter } from './modules/clients/routes.js';
import { discoveryRouter, selfRouter } from './modules/astrologers/routes.js';
import bookingRoutes from './modules/bookings/routes.js';
import consultationRoutes from './modules/consultations/routes.js';
import paymentRoutes, { webhookRouter, mockpayRouter } from './modules/payments/routes.js';
import notificationRoutes from './modules/notifications/routes.js';
import deviceRoutes from './modules/notifications/devices.js';
import supportRoutes from './modules/support/routes.js';
import assistantRoutes from './modules/assistant/routes.js';
import adminRoutes from './modules/admin/routes.js';
import { filesRouter } from './modules/files/storage.js';
import walletRoutes from './modules/wallet/routes.js';
import appConfigRoutes from './modules/content/appConfig.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({ origin: config.isProd ? config.corsOrigins : true, credentials: false }));

  // Webhook needs the raw body for signature verification — mount before JSON parsing.
  app.use('/v1/payments/webhook', webhookRouter);
  app.use('/mockpay', mockpayRouter);
  app.use('/v1/astrologer/me/documents', express.json({ limit: '8mb' }));
  app.use(/^\/v1\/consultations\/[^/]+\/attachments$/, express.json({ limit: '8mb' }));
  app.use(express.json({ limit: '200kb' }));

  app.get('/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  const v1 = express.Router();
  v1.use('/auth', authRoutes);
  v1.use('/me', meRouter);
  v1.use('/content', contentRoutes);
  v1.use('/consents', consentRouter);
  v1.use('/clients', clientRoutes);
  v1.use('/places', placesRouter);
  v1.use('/astrologers', discoveryRouter);
  v1.use('/astrologer', selfRouter);
  v1.use('/bookings', bookingRoutes);
  v1.use('/consultations', consultationRoutes);
  v1.use('/payments', paymentRoutes);
  v1.use('/notifications', notificationRoutes);
  v1.use('/devices', deviceRoutes);
  v1.use('/support', supportRoutes);
  v1.use('/assistant', assistantRoutes);
  v1.use('/admin', adminRoutes);
  v1.use('/files', filesRouter);
  v1.use('/wallet', walletRoutes);
  v1.use('/config', appConfigRoutes);
  app.use('/v1', v1);

  app.use((_req, _res, next) => next(new AppError(404, 'not_found', 'Route not found')));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, _next) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
    }
    if (err.type === 'entity.too.large') return res.status(413).json({ error: { code: 'too_large', message: 'Request too large' } });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: { code: 'bad_json', message: 'Malformed JSON' } });
    if (err.code === '22P02') return res.status(400).json({ error: { code: 'bad_request', message: 'Invalid identifier' } });
    if (err.code === '23505') return res.status(409).json({ error: { code: 'conflict', message: 'Duplicate record' } });
    console.error(`[error] ${req.method} ${req.path}`, err); // sanitized: no request bodies logged
    res.status(500).json({ error: { code: 'internal', message: 'Something went wrong' } });
  });
  return app;
}
