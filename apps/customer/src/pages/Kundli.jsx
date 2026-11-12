import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useAsync, useT, useToast, Spinner, fmtDate } from '@astro/shared';
import { Icon } from '../brand.jsx';
import { BirthProfileModal } from './Profile.jsx';

const TONES = ['#4B5BC4', '#F59E0B', '#16A34A', '#DB2777', '#0EA5E9', '#E8711A'];

export default function Kundli() {
  const { api } = useAuth();
  const t = useT();
  const list = useAsync(() => api.get('/clients/me/birth-profiles'), []);
  const [editing, setEditing] = useState(null);
  const [toast, show] = useToast();
  return (
    <div className="stack" style={{ gap: 14, maxWidth: 860, margin: '0 auto', width: '100%' }}>
      <div className="row between wrap" style={{ gap: 10 }}>
        <div><h1 className="av-h1">{t('kundli.title')}</h1><p className="small" style={{ color: 'var(--text-2)', margin: '4px 0 0' }}>{t('kundli.sub')}</p></div>
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>{t('kundli.create')} +</button>
      </div>
      <div className="grid-2">
        <Link to="/matching" className="av-card" style={{ flexDirection: 'row', alignItems: 'center', background: 'var(--primary-soft)', border: '1px solid #F6C9A3', boxShadow: 'none', color: 'inherit' }}>
          <span style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><Icon name="matching" /></span>
          <div className="grow"><strong>{t('kundli.matching')}</strong><div className="small" style={{ color: 'var(--text-2)' }}>{t('kundli.matchingSub')}</div></div><Icon name="right" style={{ color: 'var(--primary)' }} />
        </Link>
        <Link to="/predictions" className="av-dark row" style={{ gap: 12, color: '#fff' }}>
          <span className="gold" style={{ fontSize: 28 }}>♌</span>
          <div className="grow"><strong>{t('kundli.transits')}</strong><div className="sub small">{t('kundli.transitsSub')}</div></div><Icon name="right" style={{ color: 'var(--gold)' }} />
        </Link>
      </div>
      {list.loading ? <Spinner /> : !list.data?.length ? (
        <div className="av-card" style={{ alignItems: 'center', textAlign: 'center', padding: 30 }}>
          <Icon name="kundli" size={46} style={{ color: 'var(--primary)' }} /><strong>{t('kundli.none')}</strong><span className="small muted">{t('kundli.noneSub')}</span>
        </div>
      ) : list.data.map((b, i) => (
        <div key={b.birthProfileId} className="av-card" style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Link to={`/charts/${b.birthProfileId}`} className="row grow" style={{ gap: 14, color: 'inherit', minWidth: 0 }} aria-label={`${b.fullName} kundli`}>
            <span style={{ width: 54, height: 54, borderRadius: '50%', background: TONES[i % TONES.length], color: '#fff', fontWeight: 600, fontSize: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>{b.fullName[0]}</span>
            <div className="grow" style={{ minWidth: 0 }}>
              <strong>{b.fullName}</strong> <span className="small muted">· {b.label}</span>
              <div className="small" style={{ color: 'var(--text-2)' }}>{fmtDate(b.birthDate)}, {b.birthTime ? b.birthTime.slice(0, 5) : t('kundli.timeUnknown')}</div>
              <div className="small ellipsis" style={{ color: 'var(--text-2)' }}>{b.placeName}</div>
              {b.latestChart?.status === 'stale' && <div className="tiny" style={{ color: 'var(--warn)', fontWeight: 500 }}>{t('kundli.stale')}</div>}
            </div>
          </Link>
          <button type="button" className="av-icon-btn" aria-label={`Edit ${b.fullName}`} onClick={() => setEditing(b)}><Icon name="edit" size={19} /></button>
        </div>
      ))}
      {editing && <BirthProfileModal initial={editing === 'new' ? null : editing} onClose={() => setEditing(null)} onSaved={(r) => { setEditing(null); list.reload(); show(r.chartAffected ? t('x.chartOutdatedSaved') : t('profile.saved')); }} />}
      {toast}
    </div>
  );
}
