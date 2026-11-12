import { Router } from 'express';
import { ENABLED_MODES } from '../bookings/routes.js';
import { WELCOME_FREE_MINUTES } from '../wallet/service.js';

// Public app configuration for the mobile and web clients.
const r = Router();
r.get('/', (_req, res) => {
  res.json({
    brand: process.env.BRAND_NAME || 'Astrovedas',
    walletName: process.env.WALLET_NAME || 'VEDA Wallet',
    enabledModes: ENABLED_MODES,
    welcomeFreeMinutes: WELCOME_FREE_MINUTES,
    reviewTags: REVIEW_TAGS,
  });
});
export const REVIEW_TAGS = ['Knowledgeable', 'Helpful', 'Polite', 'Accurate', 'Friendly', 'Professional', 'Patient', 'Clear guidance'];
export default r;
