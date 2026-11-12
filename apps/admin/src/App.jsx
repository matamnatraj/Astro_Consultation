import { NavLink, Route, Routes, Navigate } from 'react-router-dom';
import { AuthProvider, LoginScreen, NotificationBell, useAuth, Badge, Avatar, titleCase, useT, LanguageButton } from '@astro/shared';
import { api } from './api.js';
import { I18nProvider } from './i18n.js';
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
  ['sec.operations', [['/', 'nav.dashboard', 'dashboard.view'], ['/astrologers', 'nav.astrologers', 'astrologers.view'], ['/customers', 'nav.customers', 'customers.view'], ['/bookings', 'nav.bookings', 'bookings.view'], ['/support', 'nav.support', 'support.manage'], ['/reviews', 'nav.reviews', 'reviews.moderate']]],
  ['sec.finance', [['/payments', 'nav.payments', 'payments.view'], ['/finance', 'nav.finance', 'payouts.manage']]],
  ['sec.content', [['/content', 'nav.content', 'content.view'], ['/consents', 'nav.consents', 'customers.view']]],
  ['sec.insights', [['/reports', 'nav.reports', 'reports.view']]],
  ['sec.governance', [['/admins', 'nav.admins', 'admins.manage'], ['/audit', 'nav.audit', 'audit.view']]],
];

function Shell() {
  const { me, can, logout } = useAuth();
  const t = useT();
  if (!me) return <LoginScreen api={api} role="admin" brand={<span className="row"><span className="brand-mark">✦</span>{t('login.brand')}</span>} tagline={t('login.tagline')} identifierLabel={t('login.identifier')} placeholder="admin@astro.local" />;
  const sections = NAV.map(([title, items]) => [title, items.filter(([, , p]) => can(p))]).filter(([, items]) => items.length);
  const R = (path, perm, el) => (can(perm) ? <Route path={path} element={el} /> : null);
  return (
    <div className="admin">
      <nav className="sidebar">
        <div className="brand"><span className="brand-mark">✦</span>Admin</div>
        {sections.map(([title, items]) => [<div key={title} className="section">{t(title)}</div>, ...items.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{t(label)}</NavLink>)])}
      </nav>
      <div className="admin-main">
        <header className="topbar">
          <LanguageButton />
          <NotificationBell />
          <Avatar name={me.user.displayName || 'Admin'} size={30} />
          <div className="small"><strong>{me.user.displayName}</strong><Badge tone="info">{titleCase(me.user.adminRole)}</Badge></div>
          <button className="btn btn-ghost btn-sm" onClick={logout}>{t('core.signOut')}</button>
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
  return <I18nProvider><AuthProvider api={api} role="admin"><Shell /></AuthProvider></I18nProvider>;
}
