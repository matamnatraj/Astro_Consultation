// Astrovedas building blocks for the customer website (mirrors the customer mobile app).
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useRealtimeEvent, useT, rupees } from '@astro/shared';

// ── Icons (stroke icons, 24×24) ──
const P = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  astro: 'M12 3l2.2 5.4L20 9l-4.5 3.9L17 19l-5-3-5 3 1.5-6.1L4 9l5.8-.6z',
  kundli: 'M3 3h18v18H3zM3 3l18 18M21 3L3 21M12 3l9 9-9 9-9-9z',
  wallet: 'M3 7h16a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2zM3 7l12-4v4M17 13.5h.01',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21a8 8 0 0116 0',
  bell: 'M6 8a6 6 0 1112 0c0 7 3 8 3 8H3s3-1 3-8M10 21h4',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5',
  filter: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  chat: 'M4 5h16v11H8l-4 4z',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a2 2 0 01-2 2A16 16 0 013 6a2 2 0 012-2',
  heart: 'M12 20s-7-4.4-9-9a5 5 0 019-3 5 5 0 019 3c-2 4.6-9 9-9 9z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  gift: 'M4 11h16v10H4zM2 7h20v4H2zM12 7v14M12 7S10 3 7.5 3 5 6 7 7M12 7s2-4 4.5-4S19 6 17 7',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z',
  badge: 'M12 2l2.4 2.2 3.2-.3.9 3.1 2.9 1.5-1.2 3 1.2 3-2.9 1.5-.9 3.1-3.2-.3L12 22l-2.4-2.2-3.2.3-.9-3.1L2.6 15.5l1.2-3-1.2-3 2.9-1.5.9-3.1 3.2.3zM8.5 12l2.5 2.5 4.5-5',
  card: 'M3 6h18v12H3zM3 10h18M7 15h4',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  calendar: 'M4 5h16v16H4zM4 9h16M8 3v4M16 3v4',
  plus: 'M12 5v14M5 12h14',
  right: 'M9 6l6 6-6 6',
  left: 'M15 6l-6 6 6 6',
  more: 'M12 6h.01M12 12h.01M12 18h.01',
  clip: 'M21 11l-8.5 8.5a5 5 0 01-7-7L14 4a3.5 3.5 0 015 5l-8.5 8.5a2 2 0 01-3-3L15 7',
  globe: 'M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11',
  history: 'M3 12a9 9 0 103-6.7L3 8M3 3v5h5M12 7v5l3 2',
  help: 'M12 21a9 9 0 100-18 9 9 0 000 18zM9.5 9a2.5 2.5 0 015 .5c0 1.5-2.5 2-2.5 3.5M12 17h.01',
  bot: 'M5 9h14v10H5zM12 5v4M9 13h.01M15 13h.01M9 16h6M12 3h.01',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 018 0v4',
  rupee: 'M7 4h10M7 8h10M8 4c6 0 6 8 0 8H7l8 8',
  sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4',
  moon: 'M20 14A8 8 0 0110 4a8 8 0 1010 10z',
  matching: 'M8.5 18S3 14.5 3 10.5A3.5 3.5 0 019.5 8a3.5 3.5 0 016.5 2.5M15.5 21S10 17.5 10 13.5a3.5 3.5 0 016.5-2.5 3.5 3.5 0 016.5 2.5C23 17.5 17.5 21 15.5 21z',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M5 12l5 5L20 7',
  timer: 'M12 21a8 8 0 100-16 8 8 0 000 16zM12 9v4l2 2M9 2h6M12 2v3',
  receipt: 'M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6',
  lifebuoy: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 16a4 4 0 100-8 4 4 0 000 8zM5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6',
  hangup: 'M3 15c5-5 13-5 18 0l-2.5 2.5-3.5-1.5v-3a10 10 0 00-6 0v3l-3.5 1.5z',
  briefcase: 'M3 8h18v12H3zM8 8V5h8v3M3 13h18',
  ring: 'M12 21a6 6 0 100-12 6 6 0 000 12zM9 4h6l-3 5z',
  coins: 'M9 13a6 3 0 100-.01M3 13v4c0 1.7 2.7 3 6 3s6-1.3 6-3v-4M15 7a6 3 0 1012 0',
  school: 'M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5',
  pulse: 'M3 12h4l2-5 4 10 2-5h6',
  building: 'M4 21V6l8-3v18M12 9h8v12M7 9h2M7 13h2M7 17h2M15 13h2M15 17h2',
};
export function Icon({ name, size = 22, stroke = 1.8, className, style, fill = 'none' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className} style={style} aria-hidden="true">
      <path d={P[name] || P.star} />
    </svg>
  );
}

export function Logo({ size = 38 }) {
  return (
    <span className="av-logo-mark" style={{ width: size, height: size }}>
      <svg width={size * 0.66} height={size * 0.66} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="4.5" fill="#F9B233" />
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => <rect key={a} x="11.2" y="1.5" width="1.6" height="4" rx=".8" fill="#E8711A" transform={`rotate(${a} 12 12)`} />)}
      </svg>
    </span>
  );
}

// ── Categories (specialty CSV per tile, same as the mobile app) ──
export const CATEGORIES = [
  { key: 'love', icon: 'heart', specialty: 'Love,Relationships' }, { key: 'career', icon: 'briefcase', specialty: 'Career,Business' },
  { key: 'marriage', icon: 'ring', specialty: 'Marriage,Kundli Matching' }, { key: 'finance', icon: 'coins', specialty: 'Finance,Business' },
  { key: 'education', icon: 'school', specialty: 'Education' }, { key: 'health', icon: 'pulse', specialty: 'Health' }, { key: 'property', icon: 'building', specialty: 'Property,Vastu' },
];
export const LANGUAGE_OPTIONS = ['English', 'Hindi', 'Telugu', 'Tamil', 'Bengali', 'Kannada', 'Malayalam', 'Marathi', 'Gujarati', 'Punjabi'];
export const SPECIALTY_OPTIONS = [['Vedic', 'Vedic Astrology'], ['Numerology', 'Numerology'], ['Tarot', 'Tarot'], ['Vastu', 'Vastu'], ['KP System', 'KP Astrology'], ['Nadi', 'Nadi'], ['Palmistry', 'Palmistry'], ['Face Reading', 'Face Reading'], ['Prashna', 'Prashna Kundli'], ['Western', 'Western']];

// ── Astrologer search filters, shared between pages ──
export const EMPTY_FILTERS = { languages: [], experience: null, priceMin: 10, priceMax: 50, specialties: [], mode: 'all', online: false, sort: 'popular', q: '' };
export const EXPERIENCE = { '0-5': [0, 5], '5-10': [5, 10], '10-15': [10, 15], '15+': [15, null] };
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
export const activeFilterCount = (f) => f.languages.length + f.specialties.length + (f.experience ? 1 : 0) + (f.priceMin !== 10 || f.priceMax !== 50 ? 1 : 0);
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

// ── Wallet balance, kept fresh across pages ──
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
export const resetWalletCache = () => { balance = null; };

// ── App config (brand, enabled modes, welcome gift, review tags) ──
let appConfig = null;
export function useAppConfig() {
  const { api } = useAuth();
  const [cfg, setCfg] = useState(appConfig);
  useEffect(() => { if (!appConfig) api.get('/config').then((x) => { appConfig = x; setCfg(x); }).catch(() => {}); }, [api]);
  return cfg || { walletName: 'VEDA Wallet', enabledModes: ['chat'], welcomeFreeMinutes: 2, reviewTags: [] };
}

/** Wallet recharge through the gateway's hosted checkout; comes back to `returnPath`. */
export async function startRecharge(api, amountPaise, returnPath = '/wallet') {
  const r = await api.post('/wallet/recharge', { amountPaise, returnUrl: `${window.location.origin}${returnPath}` });
  window.location.assign(r.checkoutUrl);
}

/** Optimistic favourite toggle for a list (or a single astrologer). */
export function useFavoriteToggle(setData, show) {
  const { api } = useAuth();
  const t = useT();
  return useCallback(async (a) => {
    const next = !a.isFavorite;
    const patch = (value) => (d) => (Array.isArray(d) ? d.map((x) => (x.astrologerId === a.astrologerId ? { ...x, isFavorite: value } : x))
      : d && d.astrologerId === a.astrologerId ? { ...d, isFavorite: value } : d);
    setData?.(patch(next));
    try {
      if (next) await api.put(`/astrologers/${a.astrologerId}/favorite`); else await api.del(`/astrologers/${a.astrologerId}/favorite`);
      show?.(t(next ? 'x.favAdded' : 'x.favRemoved'));
    } catch (e) { setData?.(patch(!next)); show?.(e.message, 'bad'); }
  }, [api, setData, show, t]);
}

// ── Visual components ──
const initials = (name = '?') => name.replace(/^(Acharya|Pandit|Dr\.|Jyotishi)\s+/i, '').split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
const TONES = [['#F7A35C', '#E8711A'], ['#F2B66D', '#C9792F'], ['#E9965D', '#B4530F'], ['#F5C27B', '#E38B2C']];
export function AstroAvatar({ name = '?', size = 64, online, label }) {
  const t = useT();
  const [a, b] = TONES[[...name].reduce((h, ch) => h + ch.charCodeAt(0), 0) % TONES.length];
  return (
    <span className="av-avatar" style={{ width: size, height: size, fontSize: size * 0.34, background: `linear-gradient(135deg, ${a}, ${b})` }} aria-hidden="true">
      {initials(name)}
      {online && !label && <span className="online" />}
      {online && label && <span className="online-label">{t('common.online')}</span>}
    </span>
  );
}
export const PricePill = ({ paise }) => <span className="av-price">{rupees(paise)}<small>/min</small></span>;
export function RatingPill({ rating, count }) {
  const t = useT();
  return <span className="av-rating"><span className="star">★</span>{count ? Number(rating).toFixed(1) : t('common.new')}{count ? <span className="muted" style={{ fontWeight: 400 }}>({count})</span> : null}</span>;
}
export function HeartButton({ active, onClick, label }) {
  return <button type="button" className={`av-heart ${active ? 'on' : ''}`} aria-pressed={!!active} aria-label={label} onClick={onClick}>{active ? '♥' : '♡'}</button>;
}

export function WalletPill({ balancePaise, compact }) {
  const t = useT();
  const navigate = useNavigate();
  return (
    <span className={`av-wallet ${compact ? 'compact' : ''}`}>
      <Link to="/wallet" aria-label={`${t('home.walletBalance')}: ${rupees(balancePaise ?? 0)}`}>
        <span className="lbl">{t('home.walletBalance')}</span><span className="amt">{rupees(balancePaise ?? 0)}</span>
      </Link>
      <button type="button" className="add" onClick={() => navigate('/wallet')}>{t('home.add')}</button>
    </span>
  );
}

export function SectionHeader({ title, to, onViewAll }) {
  const t = useT();
  return (
    <div className="av-section">
      <h2>{title}</h2>
      {to ? <Link to={to} onClick={onViewAll} className="small" style={{ fontWeight: 500 }}>{t('common.viewAll')}</Link> : null}
    </div>
  );
}

export function PromoBanner({ eyebrow, title, highlight, body, cta, onClick }) {
  return (
    <div className="av-promo">
      <svg className="art" width="130" height="130" viewBox="0 0 130 130" aria-hidden="true">
        <g stroke="#F9B233" strokeWidth="1.4" fill="none" transform="rotate(-8 65 65)"><path d="M15 15H115V115H15Z" /><path d="M65 15V115M15 65H115" /><path d="M22 22H108V108H22Z" opacity=".6" /></g>
        <circle cx="65" cy="65" r="60" stroke="#F9B233" strokeWidth=".8" fill="none" opacity=".35" />
      </svg>
      <span className="eyebrow">{eyebrow}</span>
      <span className="title">{title} <b>{highlight}</b></span>
      <span className="body">{body}</span>
      <button type="button" className="btn btn-primary btn-sm" onClick={onClick} style={{ marginTop: 14 }}>{cta} →</button>
    </div>
  );
}

/** Full-width astrologer card. The card body links to the profile; heart, Chat and Call are separate buttons. */
export function AstrologerCard({ a, onToggleFavorite, callEnabled, onCall }) {
  const t = useT();
  const navigate = useNavigate();
  return (
    <div className="av-card">
      <div className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
        <Link to={`/astrologers/${a.astrologerId}`} className="top grow" aria-label={`${a.displayName} profile`} style={{ minWidth: 0 }}>
          <AstroAvatar name={a.displayName} size={68} online={a.isOnline} label />
          <div className="grow" style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span className="name ellipsis">{a.displayName}</span>
            <span className="small" style={{ color: 'var(--text-2)' }}>{a.specialties.slice(0, 3).join(', ')}</span>
            <span className="row gap-s small" style={{ marginTop: 4, flexWrap: 'wrap' }}><RatingPill rating={a.ratingAvg} count={a.ratingCount} /><span style={{ color: 'var(--text-2)' }}>• {t('common.yrsExp', { n: a.experienceYears })}</span></span>
          </div>
        </Link>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          {onToggleFavorite && <HeartButton active={a.isFavorite} onClick={() => onToggleFavorite(a)} label={`Favourite ${a.displayName}`} />}
          <PricePill paise={a.rates.chat} />
        </div>
      </div>
      <div className="actions">
        <button type="button" className="av-soft" disabled={a.isBusy} onClick={() => navigate(`/consult/${a.astrologerId}?mode=chat`)} aria-label={`${t('common.chat')} · ${a.displayName}`}><Icon name="chat" size={18} />{a.isBusy ? t('common.busy') : t('common.chat')}</button>
        <button type="button" className="av-soft" disabled={!callEnabled || !a.modes.includes('voice')} onClick={() => onCall?.(a)}><Icon name="phone" size={18} />{t('common.call')}</button>
      </div>
    </div>
  );
}

/** Compact card for horizontal carousels. */
export function AstrologerMiniCard({ a, onToggleFavorite }) {
  const t = useT();
  const navigate = useNavigate();
  return (
    <div className="av-mini">
      <Link to={`/astrologers/${a.astrologerId}`} className="body" aria-label={`${a.displayName} profile`}>
        <AstroAvatar name={a.displayName} size={62} online={a.isOnline} />
        <strong className="ellipsis" style={{ maxWidth: '100%', marginTop: 4, fontWeight: 600 }}>{a.displayName}</strong>
        <span className="small ellipsis" style={{ color: 'var(--text-2)', maxWidth: '100%' }}>{a.specialties.slice(0, 2).join(', ')}</span>
        <RatingPill rating={a.ratingAvg} count={a.ratingCount} />
      </Link>
      {onToggleFavorite && <span className="heart"><HeartButton active={a.isFavorite} onClick={() => onToggleFavorite(a)} label={`Favourite ${a.displayName}`} /></span>}
      <div className="foot">
        <strong style={{ color: 'var(--pill-text)' }}>{rupees(a.rates.chat)}<small style={{ fontWeight: 400 }}>/min</small></strong>
        <button type="button" className="chat" disabled={a.isBusy} onClick={() => navigate(`/consult/${a.astrologerId}?mode=chat`)} aria-label={`Chat with ${a.displayName}`}>{a.isBusy ? t('common.busy') : t('common.chat')}</button>
      </div>
    </div>
  );
}
