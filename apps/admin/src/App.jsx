import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, LoginScreen, NotificationBell, useAuth, Badge, Avatar, titleCase } from '@astro/shared';
import { api } from './api.js';
import Dashboard from './pages/Dashboard.jsx';
import Astrologers from './pages/Astrologers.jsx';
import Customers from './pages/Customers.jsx';
import Bookings from './pages/Bookings.jsx';
import { Payments, Finance } from './pages/Finance.jsx';
import Content from './pages/Content.jsx';
import Support from './pages/Support.jsx';
import Reviews from './pages/Reviews.jsx';
import Reports from './pages/Reports.jsx';
import { Admins, Audit, Consents } from './pages/Governance.jsx';

const NAV = [
  ['Operations', [['/', 'Dashboard', 'dashboard.view'], ['/astrologers', 'Astrologers', 'astrologers.view'], ['/customers', 'Customers', 'customers.view'], ['/bookings', 'Bookings', 'bookings.view'], ['/support', 'Support', 'support.manage'], ['/reviews', 'Reviews', 'reviews.moderate']]],
  ['Finance', [['/payments', 'Payments & refunds', 'payments.view'], ['/finance', 'Commission & payouts', 'payouts.manage']]],
  ['Content', [['/content', 'Announcements & policies', 'content.view'], ['/consents', 'Consent records', 'customers.view']]],
  ['Insights', [['/reports', 'Reports', 'reports.view']]],
  ['Governance', [['/admins', 'Admin users', 'admins.manage'], ['/audit', 'Audit log', 'audit.view']]],
];

function Shell() {
  const { me, can, logout } = useAuth();
  if (!me) return <LoginScreen api={api} role="admin" brand={<span className="row"><span className="brand-mark">✦</span>Admin Console</span>} tagline="Sign in with your admin email." identifierLabel="Admin email" placeholder="admin@astro.local" />;
  const sections = NAV.map(([title, items]) => [title, items.filter(([, , p]) => can(p))]).filter(([, items]) => items.length);
  const R = (path, perm, el) => (can(perm) ? <Route path={path} element={el} /> : null);
  return (
    <div className="admin">
      <nav className="sidebar">
        <div className="brand"><span className="brand-mark">✦</span>Admin</div>
        {sections.map(([title, items]) => [<div key={title} className="section">{title}</div>, ...items.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)])}
      </nav>
      <div className="admin-main">
        <header className="topbar">
          <NotificationBell />
          <Avatar name={me.user.displayName || 'Admin'} size={30} />
          <div className="small"><strong>{me.user.displayName}</strong><Badge tone="info">{titleCase(me.user.adminRole)}</Badge></div>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
        </header>
        <main className="main" style={{ maxWidth: 1320 }}>
          <Routes>
            {R('/', 'dashboard.view', <Dashboard />)}
            {R('/astrologers', 'astrologers.view', <Astrologers />)}
            {R('/customers', 'customers.view', <Customers />)}
            {R('/bookings', 'bookings.view', <Bookings />)}
            {R('/payments', 'payments.view', <Payments />)}
            {R('/finance', 'payouts.manage', <Finance />)}
            {R('/content', 'content.view', <Content />)}
            {R('/consents', 'customers.view', <Consents />)}
            {R('/support', 'support.manage', <Support />)}
            {R('/reviews', 'reviews.moderate', <Reviews />)}
            {R('/reports', 'reports.view', <Reports />)}
            {R('/admins', 'admins.manage', <Admins />)}
            {R('/audit', 'audit.view', <Audit />)}
            <Route path="*" element={<Navigate to={sections[0]?.[1][0]?.[0] || '/'} replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return <AuthProvider api={api} role="admin"><Shell /></AuthProvider>;
}
