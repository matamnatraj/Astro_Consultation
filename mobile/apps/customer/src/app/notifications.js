import { NotificationsScreen } from '@astro/mobile-core';
import { routeFor } from '../lib/api.js';

export default function Notifications() {
  return <NotificationsScreen routeFor={routeFor} />;
}
