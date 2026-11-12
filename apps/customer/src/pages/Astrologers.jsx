import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth, useAsync, useT, useToast, useMediaQuery, Spinner, ErrorBox } from '@astro/shared';
import { Icon, AstrologerCard, useFilters, filtersToQuery, activeFilterCount, EMPTY_FILTERS, LANGUAGE_OPTIONS, SPECIALTY_OPTIONS, useAppConfig, useFavoriteToggle } from '../brand.jsx';

const SORTS = ['popular', 'rating', 'price_asc', 'price_desc', 'experience'];
const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function FilterPanel({ f, setF, onClose }) {
  const t = useT();
  const [d, setD] = useState(f);
  useEffect(() => setD(f), [f]);
  const set = (patch) => setD((x) => ({ ...x, ...patch }));
  const count = activeFilterCount(d);
  return (
    <div className="av-card" style={{ gap: 0 }}>
      <div className="row between"><strong className="row gap-s" style={{ fontSize: 17 }}><Icon name="filter" size={18} style={{ color: 'var(--primary)' }} />{t('filters.title')}</strong>
        <button type="button" className="link" onClick={() => setD({ ...EMPTY_FILTERS, q: d.q, mode: d.mode, online: d.online, sort: d.sort })}>{t('filters.reset')}</button></div>
      <div className="av-filter-sec"><h4>{t('filters.language')} <small>{t('filters.selectSpoken')}</small></h4>
        <div className="chips">{LANGUAGE_OPTIONS.map((l) => <button type="button" key={l} className={`chip ${d.languages.includes(l) ? 'active' : ''}`} aria-pressed={d.languages.includes(l)} onClick={() => set({ languages: toggle(d.languages, l) })}>{l}</button>)}</div></div>
      <div className="av-filter-sec"><h4>{t('filters.experience')} <small>{t('filters.years')}</small></h4>
        <div className="chips">{['0-5', '5-10', '10-15', '15+'].map((e) => <button type="button" key={e} className={`chip ${d.experience === e ? 'active' : ''}`} aria-pressed={d.experience === e} onClick={() => set({ experience: d.experience === e ? null : e })}>{t('filters.yrs', { n: e.replace('-', '–') })}</button>)}</div></div>
      <div className="av-filter-sec"><h4>{t('filters.price')} <small style={{ color: 'var(--pill-text)', fontWeight: 600 }}>₹{d.priceMin} – ₹{d.priceMax}{d.priceMax === 50 ? '+' : ''}</small></h4>
        <div className="av-range">
          <label className="small">Min<input type="range" min="10" max="50" step="5" value={d.priceMin} onChange={(e) => set({ priceMin: Math.min(Number(e.target.value), d.priceMax) })} aria-label="Minimum price per minute" /></label>
          <label className="small">Max<input type="range" min="10" max="50" step="5" value={d.priceMax} onChange={(e) => set({ priceMax: Math.max(Number(e.target.value), d.priceMin) })} aria-label="Maximum price per minute" /></label>
        </div></div>
      <div className="av-filter-sec"><h4>{t('filters.speciality')} <small>{t('filters.multiple')}</small></h4>
        <div className="chips">{SPECIALTY_OPTIONS.map(([v, l]) => <button type="button" key={v} className={`chip ${d.specialties.includes(v) ? 'active' : ''}`} aria-pressed={d.specialties.includes(v)} onClick={() => set({ specialties: toggle(d.specialties, v) })}>{l}</button>)}</div></div>
      <div className="stack-s" style={{ marginTop: 12 }}>
        <button type="button" className="btn btn-primary btn-block" onClick={() => { setF(d); onClose?.(); }}>{t('filters.apply')}{count ? ` (${count})` : ''}</button>
        <button type="button" className="btn btn-ghost btn-block" onClick={() => { setF({ ...EMPTY_FILTERS, q: d.q }); onClose?.(); }}>{t('filters.clear')}</button>
      </div>
    </div>
  );
}

export default function Astrologers() {
  const { api } = useAuth();
  const t = useT();
  const cfg = useAppConfig();
  const [params, setParams] = useSearchParams();
  const [f, setF] = useFilters();
  const [q, setQ] = useState(f.q);
  const isMobile = useMediaQuery('(max-width: 900px)');
  const [showFilters, setShowFilters] = useState(!!params.get('filters'));
  const [toast, show] = useToast();
  useEffect(() => { const sp = params.get('specialty'); if (sp) { setF({ ...EMPTY_FILTERS, specialties: sp.split(',') }); setParams({}, { replace: true }); } }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const h = setTimeout(() => { if (q !== f.q) setF({ q }); }, 300); return () => clearTimeout(h); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const query = filtersToQuery(f);
  const list = useAsync(() => api.get(`/astrologers?${query}`), [query]);
  const toggleFavorite = useFavoriteToggle(list.setData, show);
  const callEnabled = cfg.enabledModes.includes('voice');
  const onCall = () => show(t('common.callComingSoon'), 'info');
  const panelOpen = !isMobile || showFilters;

  return (
    <div className="stack" style={{ gap: 16 }}>
      <div className="av-tabs" role="tablist">
        {[['all', t('astro.all'), 'star'], ['chat', t('common.chat'), 'chat'], ['voice', t('common.call'), 'phone']].map(([v, l, i]) => (
          <button key={v} type="button" role="tab" aria-selected={f.mode === v} className={`av-tab ${f.mode === v ? 'active' : ''}`}
            onClick={() => (v === 'voice' && !callEnabled ? show(t('common.callComingSoon'), 'info') : setF({ mode: v }))}><Icon name={i} size={18} />{l}</button>
        ))}
      </div>
      <div className="av-search">
        <label className="box"><Icon name="search" size={20} style={{ color: 'var(--muted)' }} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('astro.search')} aria-label="Search" /></label>
        {isMobile && <button type="button" className="filter" aria-label="Filters" aria-expanded={showFilters} onClick={() => setShowFilters(!showFilters)}><Icon name="filter" />{activeFilterCount(f) ? <span className="av-badge">{activeFilterCount(f)}</span> : null}</button>}
      </div>
      <div className="row between wrap" style={{ gap: 10 }}>
        <label className="av-toggle"><input type="checkbox" checked={f.online} onChange={(e) => setF({ online: e.target.checked })} />{t('astro.onlineOnly')}</label>
        <label className="row gap-s small"><span className="muted">{t('astro.sort')}</span>
          <select value={f.sort} onChange={(e) => setF({ sort: e.target.value })} aria-label={t('astro.sortBy')} style={{ width: 'auto', fontWeight: 600, color: 'var(--pill-text)' }}>{SORTS.map((s) => <option key={s} value={s}>{t(`sort.${s}`)}</option>)}</select>
        </label>
      </div>
      <div className="av-with-side">
        {panelOpen ? <aside className="av-side"><FilterPanel f={f} setF={setF} onClose={() => setShowFilters(false)} /></aside> : <span hidden />}
        <div className="stack" style={{ gap: 14, minWidth: 0 }}>
          <ErrorBox error={list.error} onRetry={list.reload} />
          {list.loading && !list.data ? <Spinner label={t('astro.finding')} /> : !list.data?.length ? (
            <div className="av-card" style={{ alignItems: 'center', textAlign: 'center' }}><Icon name="search" size={36} style={{ color: 'var(--primary)' }} /><strong>{t('astro.noMatch')}</strong><span className="muted small">{t('astro.tryRemove')}</span></div>
          ) : (
            <div className="av-grid">{list.data.map((a) => <AstrologerCard key={a.astrologerId} a={a} onToggleFavorite={toggleFavorite} callEnabled={callEnabled} onCall={onCall} />)}</div>
          )}
          {list.data?.length ? (
            <div className="av-trust" style={{ justifyContent: 'flex-start', textAlign: 'left', gap: 14 }}>
              <span className="ico" style={{ marginBottom: 0, flex: 'none' }}><Icon name="badge" /></span>
              <div style={{ whiteSpace: 'normal' }}><strong style={{ fontSize: 15 }}>{t('astro.certified')}</strong><div className="small" style={{ fontWeight: 400, color: 'var(--text-2)' }}>{t('astro.certifiedBody')}</div></div>
            </div>
          ) : null}
        </div>
      </div>
      {toast}
    </div>
  );
}
