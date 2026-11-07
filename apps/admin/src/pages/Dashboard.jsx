import { Link } from 'react-router-dom';
import { useAuth, useAsync, Card, Stat, Spinner, ErrorBox, rupees } from '@astro/shared';
import BarChart from '../BarChart.jsx';

export default function Dashboard() {
  const { api } = useAuth();
  const { data, loading, error, reload } = useAsync(() => api.get('/admin/dashboard'), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const k = data.kpis;
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Dashboard</h1><p>Live operations overview.</p></div><button className="btn btn-secondary btn-sm" onClick={reload}>Refresh</button></div>
      {data.alerts.length > 0 && (
        <div className="stack-s">{data.alerts.map((a, i) => (
          <div key={i} className={`alert alert-${a.level === 'critical' ? 'bad' : a.level === 'warning' ? 'warn' : 'info'}`}>
            <span>{a.level === 'critical' ? '⛔' : a.level === 'warning' ? '⚠' : 'ℹ'} <strong>{a.level[0].toUpperCase() + a.level.slice(1)}:</strong> {a.text}</span>
          </div>
        ))}</div>
      )}
      <div className="grid-stats">
        <Stat label="Live consultations" value={k.live_consultations} />
        <Stat label="Awaiting acceptance" value={k.awaiting_acceptance} tone={k.awaiting_acceptance ? 'warn' : undefined} />
        <Stat label="Bookings (24h)" value={k.bookings_24h} />
        <Stat label="Net revenue (30d)" value={rupees(k.net_revenue_30d)} sub="captured − refunded" />
        <Stat label="Platform fees (30d)" value={rupees(k.platform_fees_30d)} />
        <Stat label="Active customers" value={k.active_customers} sub={`+${k.new_customers_7d} this week`} />
        <Stat label="Astrologers" value={k.approved_astrologers} sub={`${k.online_astrologers} online`} />
        <Stat label="Pending verifications" value={<Link to="/astrologers">{k.pending_verifications}</Link>} tone={k.pending_verifications ? 'warn' : undefined} />
        <Stat label="Open tickets" value={<Link to="/support">{k.open_tickets}</Link>} />
      </div>
      <div className="grid-2">
        <Card title="Bookings per day (14 days)"><BarChart data={data.trend} x="day" y="bookings" label="Bookings per day" /></Card>
        <Card title="Consultation gross per day (14 days)"><BarChart data={data.trend} x="day" y="gross" format={rupees} label="Gross consultation value per day" /></Card>
      </div>
    </div>
  );
}
