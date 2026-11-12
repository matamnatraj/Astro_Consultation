import { useState } from 'react';
import { useT, useAuth, useAsync, Card, Button, Spinner, ErrorBox, Field, Empty, rupees, titleCase } from '@astro/shared';

const fmtCell = (k, v) => (v === null || v === undefined ? '—' : k.endsWith('_paise') ? rupees(v) : /_at$|^day$/.test(k) ? String(v).slice(0, 16).replace('T', ' ') : String(v));

export default function Reports() {
  const t = useT();
  const { api, can } = useAuth();
  const types = useAsync(() => api.get('/admin/reports'), []);
  const [type, setType] = useState('financial');
  const [from, setFrom] = useState(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const report = useAsync(() => api.get(`/admin/reports/${type}?from=${from}&to=${to}`), [type, from, to]);
  const rows = report.data?.rows || [];
  const cols = rows[0] ? Object.keys(rows[0]) : [];
  return (
    <div className="stack">
      <div className="page-head"><div><h1>{t('page.reports.title')}</h1><p>{t('page.reports.sub')}</p></div></div>
      <Card>
        <div className="form-grid">
          <Field label="Report"><select value={type} onChange={(e) => setType(e.target.value)}>{types.data?.map((t) => <option key={t.key} value={t.key}>{t.title}</option>)}</select></Field>
          <Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
          <Field label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
          <div style={{ alignSelf: 'end' }}>{can('reports.export') ? <Button variant="secondary" onClick={() => api.download(`/admin/reports/${type}?from=${from}&to=${to}&format=csv`, `${type}_${from}_${to}.csv`)}>Export CSV</Button> : <span className="tiny muted">No export permission</span>}</div>
        </div>
        <p className="small muted mt">{types.data?.find((t) => t.key === type)?.description}</p>
      </Card>
      <ErrorBox error={report.error} />
      {report.loading ? <Spinner /> : !rows.length ? <Empty title="No data for this range" /> : (
        <Card pad={false}><div className="table-wrap"><table className="table compact">
          <thead><tr>{cols.map((c) => <th key={c}>{titleCase(c.replace(/_paise$/, ''))}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c} className={typeof r[c] === 'number' ? 'right nowrap' : 'small'}>{fmtCell(c, r[c])}</td>)}</tr>)}</tbody>
        </table></div></Card>
      )}
    </div>
  );
}
