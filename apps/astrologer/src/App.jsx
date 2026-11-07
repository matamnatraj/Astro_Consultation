import { NavLink, Route, Routes, Link, Navigate } from 'react-router-dom';
import { AuthProvider, LoginScreen, ConsentGate, NotificationBell, AssistantWidget, useAuth, Avatar } from '@astro/shared';
import { api } from './api.js';
import Dashboard from './pages/Dashboard.jsx';
import Workspace from './pages/Workspace.jsx';
import ProfilePage from './pages/Profile.jsx';
import Availability from './pages/Availability.jsx';
import Earnings from './pages/Earnings.jsx';
import History from './pages/History.jsx';
import Support from './pages/Support.jsx';

const NAV = [['/', 'Dashboard', '⌂', 'Home'], ['/consultations', 'Consultations', '◷', 'Sessions'], ['/availability', 'Availability', '▦', 'Slots'], ['/earnings', 'Earnings', '₹', 'Earnings'], ['/profile', 'Profile', '☉', 'Profile']];
const routeFor = (n) => (n.data?.consultationId ? `/consultations/${n.data.consultationId}` : n.type.startsWith('payout') ? '/earnings' : n.type.startsWith('astrologer.') ? '/profile' : n.data?.ticketId ? '/support' : null);

function Shell() {
  const { me, logout } = useAuth();
  if (!me) return <LoginScreen api={api} role="astrologer" brand={<span className="row"><span className="brand-mark">✦</span>Astrologer Workspace</span>} tagline="Manage your availability, consultations and earnings." />;
  return (
    <ConsentGate>
      <header className="topbar">
        <Link to="/" className="brand"><span className="brand-mark">✦</span><span className="hide-mobile">Astrologer</span></Link>
        <nav className="topnav">{NAV.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}<NavLink to="/support">Support</NavLink></nav>
        <div className="user-menu" style={{ marginLeft: 'auto' }}>
          <NotificationBell routeFor={routeFor} />
          <Avatar name={me.user.displayName || 'A'} size={32} />
          <button className="btn btn-ghost btn-sm hide-mobile" onClick={logout}>Sign out</button>
        </div>
      </header>
      <Routes>
        <Route path="/consultations/:id" element={<Workspace />} />
        <Route path="*" element={
          <main className="main">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/consultations" element={<History />} />
              <Route path="/availability" element={<Availability />} />
              <Route path="/earnings" element={<Earnings />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/support" element={<Support />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        } />
      </Routes>
      <nav className="bottomnav">{NAV.map(([to, , ico, short]) => <NavLink key={to} to={to} end={to === '/'}><span className="ico">{ico}</span>{short}</NavLink>)}</nav>
      <AssistantWidget />
    </ConsentGate>
  );
}

export default function App() {
  return <AuthProvider api={api} role="astrologer"><Shell /></AuthProvider>;
}
