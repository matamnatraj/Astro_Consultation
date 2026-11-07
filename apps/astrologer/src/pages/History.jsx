import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useAsync, Card, Spinner, ErrorBox, Badge, Tabs, Empty, rupees, fmtDateTime } from '@astro/shared';

const GROUPS = { active: 'requested,accepted,ready,in_progress', completed: 'completed', closed: 'rejected,cancelled,expired,failed' };

export default function History() {
  const { api } = useAuth();
  const [tab, setTab] = useState('active');
  const { data, loading, error, reload } = useAsync(() => api.get(`/consultations?status=${GROUPS[tab]}`), [tab]);
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Consultations</h1></div></div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }, { value: 'closed', label: 'Declined / cancelled' }]} />
      <ErrorBox error={error} onRetry={reload} />
      {loading ? <Spinner /> : !data.length ? <Empty title="Nothing here" /> : (
        <Card pad={false}><div className="table-wrap"><table className="table">
          <thead><tr><th>Client</th><th>When</th><th>Status</th><th className="right">Billed</th><th /></tr></thead>
          <tbody>{data.map((c) => (
            <tr key={c.consultationId}>
              <td><strong>{c.client.name}</strong><div className="tiny muted">{c.topic || '—'}</div></td>
              <td>{fmtDateTime(c.startedAt || c.scheduledAt || c.acceptDeadline)}<div className="tiny muted">{c.bookingType}</div></td>
              <td><Badge status={c.status} />{c.unreadCount > 0 && <Badge tone="live">{c.unreadCount} new</Badge>}</td>
              <td className="right">{c.finalAmountPaise != null ? rupees(c.finalAmountPaise) : '—'}<div className="tiny muted">{c.billableSeconds ? `${Math.ceil(c.billableSeconds / 60)} min` : ''}</div></td>
              <td className="right"><Link to={`/consultations/${c.consultationId}`} className="btn btn-secondary btn-sm">Open</Link></td>
            </tr>
          ))}</tbody>
        </table></div></Card>
      )}
    </div>
  );
}
