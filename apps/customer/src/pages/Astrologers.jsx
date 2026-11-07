import { useState } from 'react';
import { useAuth, useAsync, Spinner, Empty, ErrorBox } from '@astro/shared';
import { AstrologerCard } from './Home.jsx';

export default function Astrologers() {
  const { api } = useAuth();
  const [f, setF] = useState({ q: '', language: '', specialty: '', online: false, sort: 'rating', maxRate: '' });
  const filters = useAsync(() => api.get('/astrologers/filters'), []);
  const qs = new URLSearchParams(Object.entries({ ...f, online: f.online ? 'true' : '', maxRate: f.maxRate ? String(Number(f.maxRate) * 100) : '' }).filter(([, v]) => v)).toString();
  const list = useAsync(() => api.get(`/astrologers?${qs}`), [qs]);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  return (
    <div className="stack">
      <div className="page-head"><div><h1>Find an astrologer</h1><p>All astrologers are verified by our team before they can take bookings.</p></div></div>
      <div className="card card-body">
        <div className="form-grid">
          <input placeholder="Search by name or expertise" value={f.q} onChange={set('q')} aria-label="Search" />
          <select value={f.language} onChange={set('language')} aria-label="Language">
            <option value="">Any language</option>{filters.data?.languages.map((l) => <option key={l}>{l}</option>)}
          </select>
          <select value={f.specialty} onChange={set('specialty')} aria-label="Specialty">
            <option value="">Any specialty</option>{filters.data?.specialties.map((l) => <option key={l}>{l}</option>)}
          </select>
          <input type="number" min="0" placeholder="Max ₹/min" value={f.maxRate} onChange={set('maxRate')} aria-label="Maximum rate per minute" />
          <select value={f.sort} onChange={set('sort')} aria-label="Sort">
            <option value="rating">Top rated</option><option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option><option value="experience">Most experienced</option>
          </select>
          <label className="check" style={{ alignSelf: 'center' }}><input type="checkbox" checked={f.online} onChange={set('online')} /> Online now</label>
        </div>
      </div>
      <ErrorBox error={list.error} onRetry={list.reload} />
      {list.loading ? <Spinner /> : !list.data?.length ? <Empty title="No astrologers match these filters">Try removing a filter.</Empty> : (
        <div className="grid-3">{list.data.map((a) => <AstrologerCard key={a.astrologerId} a={a} />)}</div>
      )}
    </div>
  );
}
