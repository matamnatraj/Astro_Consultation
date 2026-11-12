import { createApi } from '@astro/mobile-core';

export const api = createApi('astro.customer.session');

/** Map a notification (in-app or push) to the screen it should open. */
export function routeFor(n) {
  const d = n.data || n;
  const type = n.type || d.type || '';
  if (d.consultationId) return `/consultation/${d.consultationId}`;
  if (d.bookingId) return `/booking/${d.bookingId}`;
  if (d.wallet || type.startsWith('wallet')) return '/wallet';
  if (d.ticketId) return '/support';
  return null;
}
