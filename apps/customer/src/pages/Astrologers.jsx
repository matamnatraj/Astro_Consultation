import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth, useAsync, useT, Spinner, Empty, ErrorBox } from '@astro/shared';
import { AstrologerCard } from './Home.jsx';

export default function Astrologers() {
  const { api } = useAuth();
  const t = useT();
  const [params] = useSearchParams();
  const [f, setF] = useState({ q: '', language: '', specialty: params.get('specialty') || '', online: false, sort: 'rating', maxRate: '' });
  const filters = useAsync(() => api.get('/astrologers/filters'), []);
  const qs = new URLSearchParams(Object.entries({ ...f, online: f.online ? 'true' : '', maxRate: f.maxRate ? String(Number(f.maxRate) * 100) : '' }).filter(([, v]) => v)).toString();
  const list = useAsync(() => api.get(`/astrologers?${qs}`), [qs]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <div className="stack">
      <div className="page-head"><div><h1>{t('astro.title')}</h1><p>{t('astro.sub')}</p></div></div>
      <div className="card card-body">
        <div className="form-grid">
          <input placeholder={t('astro.search')} value={f.q} onChange={set('q')} aria-label="Search" />
          <select value={f.language} onChange={set('language')} aria-label="Language">
            <option value="">{t('astro.anyLang')}</option>{filters.data?.languages.map((l) => <option key={l}>{l}</option>)}
          </select>
          <select value={f.specialty} onChange={set('specialty')} aria-label="Specialty">
            <option value="">{t('astro.anySpec')}</option>{filters.data?.specialties.map((l) => <option key={l}>{l}</option>)}
          </select>
          <input type="number" min="0" placeholder={t('astro.maxRate')} value={f.maxRate} onChange={set('maxRate')} aria-label="Maximum rate per minute" />
          <select value={f.sort} onChange={set('sort')} aria-label="Sort">
            <option value="rating">{t('sort.rating')}</option><option value="price_asc">{t('sort.price_asc')}</option>
            <option value="price_desc">{t('sort.price_desc')}</option><option value="experience">{t('sort.experience')}</option>
          </select>
          <label className="check" style={{ alignSelf: 'center' }}><input type="checkbox" checked={f.online} onChange={set('online')} /> {t('astro.onlineNow')}</label>
        </div>
      </div>
      <ErrorBox error={list.error} onRetry={list.reload} />
      {list.loading ? <Spinner /> : !list.data?.length ? <Empty title={t('astro.noMatch')}>{t('astro.tryRemove')}</Empty> : (
        <div className="grid-3">{list.data.map((a) => <AstrologerCard key={a.astrologerId} a={a} />)}</div>
      )}
    </div>
  );
}
