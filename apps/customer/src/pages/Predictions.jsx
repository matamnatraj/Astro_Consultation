import { Link, useNavigate } from 'react-router-dom';
import { useAuth, useAsync, useT, Spinner, ErrorBox, fmtDate } from '@astro/shared';
import { Icon, EMPTY_FILTERS, setFilters } from '../brand.jsx';

const GLYPH = { Sun: '☉', Moon: '☽', Mars: '♂', Mercury: '☿', Jupiter: '♃', Venus: '♀', Saturn: '♄', Rahu: '☊', Ketu: '☋' };

export default function Predictions() {
  const { api } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const d = useAsync(() => api.get('/clients/me/today'), []);
  if (d.loading) return <Spinner />;
  if (d.error) return <ErrorBox error={d.error} onRetry={d.reload} />;
  if (!d.data.available) {
    return (
      <div className="av-card" style={{ alignItems: 'center', textAlign: 'center', maxWidth: 520, margin: '40px auto', padding: 28 }}>
        <Icon name="kundli" size={52} style={{ color: 'var(--primary)' }} />
        <strong style={{ fontSize: 18 }}>{t('x.predAddFirst')}</strong>
        <span style={{ color: 'var(--text-2)' }}>{t('x.predAddBody')}</span>
        <Link to="/account?add=1" className="btn btn-primary">{t('home.banner.kundli.cta')}</Link>
      </div>
    );
  }
  const x = d.data;
  return (
    <div className="stack" style={{ gap: 16, maxWidth: 860, margin: '0 auto', width: '100%' }}>
      <div className="av-dark stack-s">
        <span className="gold small" style={{ letterSpacing: .8, fontWeight: 500 }}>{fmtDate(x.date).toUpperCase()}</span>
        <strong style={{ fontSize: 22 }}>{t('x.todaySky', { name: x.forName.split(' ')[0] })}</strong>
        <div className="row" style={{ gap: 20, marginTop: 6, flexWrap: 'wrap' }}>
          {[[t('x.moonSign'), x.moonSign], [t('match.lagna'), x.lagna], [t('x.nakshatra'), x.nakshatra.split(' (')[0]]].map(([k, v]) => <div key={k}><div className="sub tiny">{k}</div><strong>{v}</strong></div>)}
        </div>
      </div>
      {x.currentMahadasha && (
        <div className="av-card" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <span style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--accent-soft)', color: 'var(--primary)', fontSize: 22, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{GLYPH[x.currentMahadasha.lord]}</span>
          <div><div className="small" style={{ color: 'var(--text-2)' }}>{t('x.mahadasha')}</div><strong>{x.currentMahadasha.lord}</strong><div className="small" style={{ color: 'var(--text-2)' }}>{fmtDate(x.currentMahadasha.start)} – {fmtDate(x.currentMahadasha.end)}</div></div>
        </div>
      )}
      <h2 style={{ fontSize: 18, margin: 0 }}>{t('x.transits')}</h2>
      <div className="av-menu-card">
        {x.transits.map((tr) => (
          <div key={tr.planet} className="av-item" style={{ cursor: 'default' }}>
            <span style={{ width: 32, textAlign: 'center', fontSize: 22, color: 'var(--primary)', fontWeight: 700 }}>{GLYPH[tr.planet]}</span>
            <div className="grow"><div>{tr.planet} · {tr.sign}{tr.retrograde && !['Rahu', 'Ketu'].includes(tr.planet) ? ' (R)' : ''}</div>
              <div className="small" style={{ color: 'var(--text-2)', fontWeight: 400 }}>{t('x.houseFromMoon', { n: tr.houseFromMoon })} · {tr.theme}</div></div>
            <span className="tiny muted">{tr.degree}</span>
          </div>
        ))}
      </div>
      <p className="small muted" style={{ margin: 0 }}>{x.note}</p>
      <button type="button" className="btn btn-primary btn-lg" onClick={() => { setFilters({ ...EMPTY_FILTERS }); navigate('/astrologers'); }}>{t('x.askAbout')}</button>
    </div>
  );
}
