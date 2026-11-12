import { NavLink, Route, Routes, Link, Navigate, useParams } from 'react-router-dom';
import { AuthProvider, LoginScreen, ConsentGate, NotificationBell, AssistantWidget, useAuth, useT, LanguageButton, LanguageSync } from '@astro/shared';
import { api } from './api.js';
import { I18nProvider } from './i18n.js';
import { Icon, Logo, WalletPill, AstroAvatar, useWallet } from './brand.jsx';
import Home from './pages/Home.jsx';
import Astrologers from './pages/Astrologers.jsx';
import AstrologerDetail from './pages/AstrologerDetail.jsx';
import Consult from './pages/Consult.jsx';
import Bookings from './pages/Bookings.jsx';
import BookingDetail from './pages/BookingDetail.jsx';
import ConsultationRoom from './pages/ConsultationRoom.jsx';
import Rate from './pages/Rate.jsx';
import Wallet from './pages/Wallet.jsx';
import Kundli from './pages/Kundli.jsx';
import Predictions from './pages/Predictions.jsx';
import ProfileMenu from './pages/ProfileMenu.jsx';
import Account from './pages/Profile.jsx';
import Favorites from './pages/Favorites.jsx';
import ChartPage from './pages/ChartPage.jsx';
import Support from './pages/Support.jsx';
import Matching, { MatchResult } from './pages/Matching.jsx';

const NAV = [['/', 'tab.home', 'home'], ['/astrologers', 'tab.astrologers', 'astro'], ['/kundli', 'tab.kundli', 'kundli'], ['/wallet', 'tab.wallet', 'wallet'], ['/profile', 'tab.profile', 'user']];

const routeFor = (n) => {
  if (n.data?.consultationId) return `/consultations/${n.data.consultationId}`;
  if (n.type?.startsWith('wallet')) return '/wallet';
  if (n.data?.bookingId) return `/bookings/${n.data.bookingId}`;
  if (n.data?.ticketId) return '/support';
  return null;
};

const Brand = () => <span className="av-logo"><Logo />ASTROVEDAS</span>;
const HeaderWallet = () => { const [balance] = useWallet(); return <WalletPill balancePaise={balance} compact />; };
const BookRedirect = () => { const { astrologerId } = useParams(); return <Navigate to={`/consult/${astrologerId}`} replace />; };

function Shell() {
  const { me } = useAuth();
  const t = useT();
  if (!me) return <LoginScreen api={api} role="customer" brand={<Brand />} tagline={t('login.tagline')} />;
  return (
    <ConsentGate>
      <LanguageSync load={() => api.get('/clients/me').then((p) => p.preferredLanguage)} save={(code) => api.patch('/clients/me/language', { language: code })} />
      <header className="topbar av-topbar">
        <Link to="/" aria-label="Astrovedas home"><Brand /></Link>
        <nav className="topnav av-topnav">{NAV.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{t(label)}</NavLink>)}</nav>
        <div className="user-menu" style={{ marginLeft: 'auto', gap: 10 }}>
          <HeaderWallet />
          <LanguageButton />
          <NotificationBell routeFor={routeFor} />
          <Link to="/profile" aria-label={t('tab.profile')}><AstroAvatar name={me.user.displayName || 'You'} size={36} /></Link>
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
              <Route path="/consult/:astrologerId" element={<Consult />} />
              <Route path="/book/:astrologerId" element={<BookRedirect />} />
              <Route path="/bookings" element={<Bookings />} />
              <Route path="/bookings/:id" element={<BookingDetail />} />
              <Route path="/history" element={<Navigate to="/bookings" replace />} />
              <Route path="/rate/:id" element={<Rate />} />
              <Route path="/wallet" element={<Wallet />} />
              <Route path="/kundli" element={<Kundli />} />
              <Route path="/predictions" element={<Predictions />} />
              <Route path="/matching" element={<Matching />} />
              <Route path="/matching/:id" element={<MatchResult />} />
              <Route path="/profile" element={<ProfileMenu />} />
              <Route path="/account" element={<Account />} />
              <Route path="/favorites" element={<Favorites />} />
              <Route path="/charts/:birthProfileId" element={<ChartPage />} />
              <Route path="/support" element={<Support />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        } />
      </Routes>
      <nav className="bottomnav">{NAV.map(([to, label, ico]) => <NavLink key={to} to={to} end={to === '/'}><span className="ico"><Icon name={ico} size={21} /></span>{t(label)}</NavLink>)}</nav>
      <AssistantWidget />
    </ConsentGate>
  );
}

export default function App() {
  return <I18nProvider><AuthProvider api={api} role="customer"><Shell /></AuthProvider></I18nProvider>;
}
