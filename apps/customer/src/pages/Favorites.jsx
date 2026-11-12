import { Link } from 'react-router-dom';
import { useAuth, useAsync, useT, useToast, Spinner } from '@astro/shared';
import { Icon, AstrologerCard, useAppConfig, useFavoriteToggle } from '../brand.jsx';

export default function Favorites() {
  const { api } = useAuth();
  const t = useT();
  const cfg = useAppConfig();
  const list = useAsync(() => api.get('/astrologers?favorites=true&sort=popular'), []);
  const [toast, show] = useToast();
  const toggle = useFavoriteToggle(list.setData, show);
  const items = (list.data || []).filter((a) => a.isFavorite !== false);
  return (
    <div className="stack" style={{ gap: 16 }}>
      <h1 className="av-h1">{t('profile.favorites')}</h1>
      {list.loading ? <Spinner /> : !items.length ? (
        <div className="av-card" style={{ alignItems: 'center', textAlign: 'center', padding: 28 }}>
          <Icon name="heart" size={40} style={{ color: 'var(--primary)' }} /><strong>{t('x.noFavs')}</strong><span className="small muted">{t('x.noFavsBody')}</span>
          <Link to="/astrologers" className="btn btn-primary">{t('astro.title')}</Link>
        </div>
      ) : <div className="av-grid">{items.map((a) => <AstrologerCard key={a.astrologerId} a={a} onToggleFavorite={toggle} callEnabled={cfg.enabledModes.includes('voice')} onCall={() => show(t('common.callComingSoon'), 'info')} />)}</div>}
      {toast}
    </div>
  );
}
