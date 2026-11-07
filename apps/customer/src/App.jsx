import { NavLink, Route, Routes, Link, Navigate } from 'react-router-dom';
import { AuthProvider, LoginScreen, ConsentGate, NotificationBell, AssistantWidget, useAuth, Avatar } from '@astro/shared';
import { api } from './api.js';
import Home from './pages/Home.jsx';
import Astrologers from './pages/Astrologers.jsx';
import AstrologerDetail from './pages/AstrologerDetail.jsx';
import Book from './pages/Book.jsx';
import Bookings from './pages/Bookings.jsx';
import BookingDetail from './pages/BookingDetail.jsx';
import ConsultationRoom from './pages/ConsultationRoom.jsx';
import Profile from './pages/Profile.jsx';
import ChartPage from './pages/ChartPage.jsx';
import Support from './pages/Support.jsx';

const NAV = [
  ['/', 'Home', '⌂', 'Home'], ['/astrologers', 'Astrologers', '✦', 'Explore'], ['/bookings', 'My sessions', '◷', 'Sessions'],
  ['/profile', 'Profile & charts', '☉', 'Profile'], ['/support', 'Support', '?', 'Support'],
];

const routeFor = (n) => {
  if (n.data?.consultationId && ['consultation.started', 'consultation.ready', 'consultation.reminder'].includes(n.type)) return `/consultations/${n.data.consultationId}`;
  if (n.data?.bookingId) return `/bookings/${n.data.bookingId}`;
  if (n.data?.consultationId) return '/bookings';
  if (n.data?.ticketId) return '/support';
  return null;
};

function Shell() {
  const { me, logout } = useAuth();
  if (!me) return <LoginScreen api={api} role="customer" brand={<span className="row"><span className="brand-mark">✦</span>Jyotish Connect</span>} tagline="Consult verified astrologers with your saved birth chart." />;
  return (
    <ConsentGate>
      <header className="topbar">
        <Link to="/" className="brand"><span className="brand-mark">✦</span><span className="hide-mobile">Jyotish Connect</span></Link>
        <nav className="topnav">{NAV.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}</nav>
        <div className="user-menu" style={{ marginLeft: 'auto' }}>
          <NotificationBell routeFor={routeFor} />
          <Link to="/profile" aria-label="Profile"><Avatar name={me.user.displayName || 'You'} size={32} /></Link>
          <button className="btn btn-ghost btn-sm hide-mobile" onClick={logout}>Sign out</button>
        </div>
      </header>
      <Routes>
        <Route path="/consultations/:id" element={<ConsultationRoom />} />
        <Route path="*" element={
          <main className="main">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/astrologers" element={<Astrologers />} />
              <Route path="/astrologers/:id" element={<AstrologerDetail />} />
              <Route path="/book/:astrologerId" element={<Book />} />
              <Route path="/bookings" element={<Bookings />} />
              <Route path="/bookings/:id" element={<BookingDetail />} />
              <Route path="/history" element={<Navigate to="/bookings" replace />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/charts/:birthProfileId" element={<ChartPage />} />
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
  return <AuthProvider api={api} role="customer"><Shell /></AuthProvider>;
}
