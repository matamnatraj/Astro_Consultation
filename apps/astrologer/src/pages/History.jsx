import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth, useAsync, useT, Card, Spinner, ErrorBox, Badge, Tabs, Empty, rupees, fmtDateTime } from '@astro/shared';

const GROUPS = { active: 'requested,accepted,ready,in_progress', completed: 'completed', closed: 'rejected,cancelled,expired,failed' };

export default function History() {
  const { api } = useAuth();
  const t = useT();
  const [tab, setTab] = useState('active');
  const { data, loading, error, reload } = useAsync(() => api.get(`/consultations?status=${GROUPS[tab]}`), [tab]);
  return (
    <div className="stack">
      <div className="page-head"><div><h1>{t('tab.consultations')}</h1></div></div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'active', label: t('cons.active') }, { value: 'completed', label: t('cons.completed') }, { value: 'closed', label: t('w.declined') }]} />
      <ErrorBox error={error} onRetry={reload} />
      {loading ? <Spinner /> : !data.length ? <Empty title={t('cons.empty')} /> : (
        <Card pad={false}><div className="table-wrap"><table className="table">
          <thead><tr><th>{t('common.client')}</th><th>{t('w.when')}</th><th>{t('w.status')}</th><th className="right">{t('w.billed')}</th><th /></tr></thead>
          <tbody>{data.map((c) => (
            <tr key={c.consultationId}>
              <td><strong>{c.client.name}</strong><div className="tiny muted">{c.topic || '—'}</div></td>
              <td>{fmtDateTime(c.startedAt || c.scheduledAt || c.acceptDeadline)}<div className="tiny muted">{t(`type.${c.bookingType}`)}</div></td>
              <td><Badge status={c.status} />{c.unreadCount > 0 && <Badge tone="live">{t('common.new', { n: c.unreadCount })}</Badge>}</td>
              <td className="right">{c.finalAmountPaise != null ? rupees(c.finalAmountPaise) : '—'}<div className="tiny muted">{c.billableSeconds ? t('common.min', { n: Math.ceil(c.billableSeconds / 60) }) : ''}</div></td>
              <td className="right"><Link to={`/consultations/${c.consultationId}`} className="btn btn-secondary btn-sm">{t('w.open')}</Link></td>
            </tr>
          ))}</tbody>
        </table></div></Card>
      )}
    </div>
  );
}
