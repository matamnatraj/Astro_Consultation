import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useAsync, useT, useToast, useRealtimeEvent, fmtDate } from '@astro/shared';
import { Icon, WalletPill, PromoBanner, SectionHeader, AstrologerMiniCard, AstroAvatar, CATEGORIES, EMPTY_FILTERS, setFilters, useWallet, useAppConfig, useFavoriteToggle } from '../brand.jsx';

const greetingKey = () => { const h = new Date().getHours(); return h < 12 ? 'greet.morning' : h < 17 ? 'greet.afternoon' : 'greet.evening'; };
const banner = (t, k, vars) => ({ eyebrow: t(`home.banner.${k}.eyebrow`), title: t(`home.banner.${k}.title`), highlight: t(`home.banner.${k}.highlight`, vars), body: t(`home.banner.${k}.body`), cta: t(`home.banner.${k}.cta`) });

export default function Home() {
  const { api, me } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const cfg = useAppConfig();
  const [balance] = useWallet();
  const astros = useAsync(() => api.get('/astrologers?sort=popular'), []);
  const profile = useAsync(() => api.get('/clients/me'), []);
  const sessions = useAsync(() => api.get('/bookings'), []);
  const active = useAsync(() => api.get('/consultations?status=requested,accepted,ready,in_progress'), []);
  const [toast, show] = useToast();
  const toggleFavorite = useFavoriteToggle(astros.setData, show);
  useRealtimeEvent((ev) => { if (ev.type === 'notification') { sessions.reload(); active.reload(); } });
  const first = (me.user.displayName || '').split(' ')[0];
  const online = (astros.data || []).filter((a) => a.isOnline);
  const list = online.length ? online : (astros.data || []).slice(0, 8);
  const recent = (sessions.data || []).find((b) => b.consultation?.status === 'completed');
  const callEnabled = cfg.enabledModes.includes('voice');
  const go = (patch, to = '/astrologers') => { setFilters({ ...EMPTY_FILTERS, ...patch }); navigate(to); };

  const slides = [
    { key: 'kundli', ...banner(t, 'kundli'), onClick: () => navigate(profile.data?.birthProfileCount ? '/kundli' : '/account?add=1') },
    { key: 'match', ...banner(t, 'match'), onClick: () => navigate('/matching') },
    { key: 'pred', ...banner(t, 'pred'), onClick: () => navigate('/predictions') },
    { key: 'gift', ...banner(t, 'gift', { n: cfg.welcomeFreeMinutes }), onClick: () => go({}) },
  ];

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="row between wrap" style={{ gap: 12 }}>
        <div><div className="av-greet">{t(greetingKey())},</div><h1 className="av-h1">{first || 'Friend'} 👋</h1></div>
        <span className="av-wallet-home"><WalletPill balancePaise={balance} /></span>
      </div>

      <form className="av-search" onSubmit={(e) => { e.preventDefault(); go({ q: new FormData(e.currentTarget).get('q') || '' }); }}>
        <label className="box"><Icon name="search" size={20} style={{ color: 'var(--muted)' }} /><input name="q" placeholder={t('home.search')} aria-label="Search" /></label>
        <button type="button" className="filter" aria-label="Filters" onClick={() => go({}, '/astrologers?filters=1')}><Icon name="filter" /></button>
      </form>

      {active.data?.length > 0 && (
        <div className="av-dark row between wrap" style={{ gap: 12 }}>
          <div className="row" style={{ gap: 12 }}><AstroAvatar name={active.data[0].astrologer.name} size={46} /><div><strong>{active.data[0].astrologer.name}</strong><div className="sub small">{t('x.activeSession')}</div></div></div>
          <Link to={`/consultations/${active.data[0].consultationId}`} className="btn btn-primary btn-sm">{t('home.viewChat')} →</Link>
        </div>
      )}

      <div className="av-promos">{slides.map(({ key, ...s }) => <PromoBanner key={key} {...s} />)}</div>

      <div className="av-quick">
        <button type="button" onClick={() => go({ mode: 'chat' })}><span className="ico"><Icon name="chat" /></span>{t('common.chat')}</button>
        <button type="button" onClick={() => (callEnabled ? go({ mode: 'voice' }) : show(t('common.callComingSoon'), 'info'))}><span className="ico"><Icon name="phone" /></span>{t('common.call')}</button>
        <Link to="/kundli"><span className="ico"><Icon name="kundli" /></span>{t('tab.kundli')}</Link>
        <Link to="/matching"><span className="ico"><Icon name="matching" /></span>{t('quick.match')}</Link>
      </div>

      <SectionHeader title={t('home.categories')} to="/astrologers" onViewAll={() => setFilters({ ...EMPTY_FILTERS })} />
      <div className="av-cats">{CATEGORIES.map((c) => (
        <button type="button" key={c.key} className="av-cat" onClick={() => go({ specialties: c.specialty.split(',') })} aria-label={`${t(`cat.${c.key}`)} astrologers`}>
          <span className="ico"><Icon name={c.icon} size={28} /></span>{t(`cat.${c.key}`)}
        </button>
      ))}</div>

      {recent && (
        <>
          <SectionHeader title={t('home.mySessions')} to="/bookings" />
          <div className="av-card" style={{ flexDirection: 'row', alignItems: 'center' }}>
            <AstroAvatar name={recent.astrologerName} size={52} />
            <div className="grow"><strong>{recent.astrologerName}</strong><div className="small muted">{fmtDate(recent.consultation.endedAt || recent.createdAt)}</div></div>
            <Link className="btn btn-secondary btn-sm" to={`/consultations/${recent.consultation.consultationId}`}>{t('home.viewChat')}</Link>
            <Link className="btn btn-primary btn-sm" to={`/astrologers/${recent.astrologerId}`}>{t('home.chatAgain')}</Link>
          </div>
        </>
      )}

      <SectionHeader title={online.length ? t('home.online') : t('home.recommended')} to="/astrologers" onViewAll={() => setFilters({ ...EMPTY_FILTERS, online: online.length > 0 })} />
      <div className="av-mini-row">
        {astros.loading ? <span className="muted">{t('common.loading')}</span> : !list.length ? <span className="muted">{t('home.none')}</span>
          : list.map((a) => <AstrologerMiniCard key={a.astrologerId} a={a} onToggleFavorite={toggleFavorite} />)}
      </div>

      <div className="av-trust">
        {[['lock', 'home.trust.private'], ['badge', 'home.trust.verified'], ['card', 'home.trust.secure']].map(([i, k]) => <div key={k}><span className="ico"><Icon name={i} /></span><div>{t(k)}</div></div>)}
      </div>
      {toast}
    </div>
  );
}
