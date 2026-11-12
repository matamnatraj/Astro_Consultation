import { useEffect, useState, useCallback } from 'react';
import { useAuth, useRealtimeEvent } from '@astro/mobile-core';

// ── Astrologer search filters (shared by the list and the Filters screen) ──
export const EMPTY_FILTERS = { languages: [], experience: null, priceMin: 10, priceMax: 50, specialties: [], mode: 'all', online: false, sort: 'popular', q: '' };
let filters = { ...EMPTY_FILTERS };
const filterListeners = new Set();
export function setFilters(next) {
  filters = typeof next === 'function' ? next(filters) : { ...filters, ...next };
  filterListeners.forEach((l) => l(filters));
}
export function useFilters() {
  const [f, setF] = useState(filters);
  useEffect(() => { filterListeners.add(setF); return () => filterListeners.delete(setF); }, []);
  return [f, setFilters];
}
export const EXPERIENCE = { '0-5': [0, 5], '5-10': [5, 10], '10-15': [10, 15], '15+': [15, null] };
export function activeFilterCount(f) {
  return f.languages.length + f.specialties.length + (f.experience ? 1 : 0) + (f.priceMin !== 10 || f.priceMax !== 50 ? 1 : 0) + (f.mode !== 'all' ? 1 : 0);
}
export function filtersToQuery(f) {
  const q = new URLSearchParams();
  if (f.q) q.set('q', f.q);
  if (f.languages.length) q.set('language', f.languages.join(','));
  if (f.specialties.length) q.set('specialty', f.specialties.join(','));
  if (f.experience) { const [lo, hi] = EXPERIENCE[f.experience]; q.set('minExp', lo); if (hi != null) q.set('maxExp', hi); }
  if (f.priceMin !== 10) q.set('minRate', f.priceMin * 100);
  if (f.priceMax !== 50) q.set('maxRate', f.priceMax * 100);
  if (f.mode !== 'all') q.set('mode', f.mode);
  if (f.online) q.set('online', 'true');
  q.set('sort', f.sort);
  return q.toString();
}

// ── Wallet balance, kept fresh across screens ──
let balance = null;
const walletListeners = new Set();
export function useWallet() {
  const { api } = useAuth();
  const [b, setB] = useState(balance);
  const refresh = useCallback(async () => {
    try { const w = await api.get('/wallet'); balance = w.balancePaise; walletListeners.forEach((l) => l(balance)); return w; } catch { return null; }
  }, [api]);
  useEffect(() => { walletListeners.add(setB); if (balance === null) refresh(); return () => walletListeners.delete(setB); }, [refresh]);
  useRealtimeEvent((ev) => { if (ev.type === 'notification' && /^(wallet|payment|consultation\.completed|booking\.)/.test(ev.notification.type)) refresh(); });
  return [b, refresh];
}

// ── App config (brand, enabled modes, welcome gift, review tags) ──
let appConfig = null;
export function useAppConfig() {
  const { api } = useAuth();
  const [cfg, setCfg] = useState(appConfig);
  useEffect(() => { if (!appConfig) api.get('/config').then((x) => { appConfig = x; setCfg(x); }).catch(() => {}); }, [api]);
  return cfg || { walletName: 'VEDA Wallet', enabledModes: ['chat'], welcomeFreeMinutes: 2, reviewTags: [] };
}
