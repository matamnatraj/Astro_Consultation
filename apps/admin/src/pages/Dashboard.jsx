import { Link } from 'react-router-dom';
import { useT, useAuth, useAsync, Card, Stat, Spinner, ErrorBox, rupees } from '@astro/shared';
import BarChart from '../BarChart.jsx';

export default function Dashboard() {
  const t = useT();
  const { api } = useAuth();
  const { data, loading, error, reload } = useAsync(() => api.get('/admin/dashboard'), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const k = data.kpis;
  return (
    <div className="stack">
      <div className="page-head"><div><h1>{t('page.dashboard.title')}</h1><p>{t('page.dashboard.sub')}</p></div><button className="btn btn-secondary btn-sm" onClick={reload}>{t('common.refresh')}</button></div>
      {data.alerts.length > 0 && (
        <div className="stack-s">{data.alerts.map((a, i) => (
          <div key={i} className={`alert alert-${a.level === 'critical' ? 'bad' : a.level === 'warning' ? 'warn' : 'info'}`}>
            <span>{a.level === 'critical' ? '⛔' : a.level === 'warning' ? '⚠' : 'ℹ'} <strong>{t(`dash.${a.level}`)}:</strong> {a.text}</span>
          </div>
        ))}</div>
      )}
      <div className="grid-stats">
        <Stat label={t('dash.live')} value={k.live_consultations} />
        <Stat label={t('dash.awaiting')} value={k.awaiting_acceptance} tone={k.awaiting_acceptance ? 'warn' : undefined} />
        <Stat label={t('dash.bookings24')} value={k.bookings_24h} />
        <Stat label={t('dash.netRevenue')} value={rupees(k.net_revenue_30d)} sub={t('dash.netSub')} />
        <Stat label={t('dash.fees')} value={rupees(k.platform_fees_30d)} />
        <Stat label={t('dash.activeCustomers')} value={k.active_customers} sub={t('dash.newWeek', { n: k.new_customers_7d })} />
        <Stat label={t('dash.astrologers')} value={k.approved_astrologers} sub={t('dash.online', { n: k.online_astrologers })} />
        <Stat label={t('dash.pendingVer')} value={<Link to="/astrologers">{k.pending_verifications}</Link>} tone={k.pending_verifications ? 'warn' : undefined} />
        <Stat label={t('dash.openTickets')} value={<Link to="/support">{k.open_tickets}</Link>} />
      </div>
      <div className="grid-2">
        <Card title={t('dash.bookingsChart')}><BarChart data={data.trend} x="day" y="bookings" label="Bookings per day" /></Card>
        <Card title={t('dash.grossChart')}><BarChart data={data.trend} x="day" y="gross" format={rupees} label="Gross consultation value per day" /></Card>
      </div>
    </div>
  );
}
