import { createApi } from '@astro/mobile-core';

export const api = createApi('astro.astrologer.session');

export function routeFor(n) {
  const d = n.data || n;
  const type = n.type || d.type || '';
  if (d.consultationId) return `/consultation/${d.consultationId}`;
  if (type.startsWith('payout')) return '/earnings';
  if (type.startsWith('astrologer.')) return '/profile';
  if (d.ticketId) return '/support';
  return null;
}
