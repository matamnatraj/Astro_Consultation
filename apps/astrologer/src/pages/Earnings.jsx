import { useAuth, useAsync, Card, Spinner, ErrorBox, Badge, Stat, Empty, rupees, fmtDateTime, fmtDate } from '@astro/shared';

export default function Earnings() {
  const { api } = useAuth();
  const { data, loading, error, reload } = useAsync(() => api.get('/astrologer/me/earnings'), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const s = data.summary;
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Earnings</h1><p>Every consultation creates a ledger entry. Earnings become eligible for payout after the hold period.</p></div></div>
      <div className="grid-stats">
        <Stat label="Gross earned" value={rupees(s.gross)} sub={`${s.consultations} consultations`} />
        <Stat label="Platform commission" value={rupees(s.platform_fees)} />
        <Stat label="On hold" value={rupees(s.on_hold)} sub="Within hold period" />
        <Stat label="Eligible" value={rupees(s.eligible)} tone="ok" sub="Next payout batch" />
        <Stat label="Paid out" value={rupees(s.paid)} />
      </div>
      <Card title="Payouts">
        {!data.payouts.length ? <p className="muted small">No payouts yet.</p> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Date</th><th>Amount</th><th>Entries</th><th>Status</th><th>Reference</th></tr></thead>
            <tbody>{data.payouts.map((p) => <tr key={p.payout_id}><td>{fmtDate(p.created_at)}</td><td>{rupees(p.amount_paise)}</td><td>{p.entry_count}</td><td><Badge status={p.status} /></td><td className="mono">{p.reference || p.failure_reason || '—'}</td></tr>)}</tbody>
          </table></div>
        )}
      </Card>
      <Card title="Ledger">
        {!data.ledger.length ? <Empty title="No earnings yet" /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>Date</th><th>Type</th><th className="right">Gross</th><th className="right">Commission</th><th className="right">Payable</th><th>Status</th></tr></thead>
            <tbody>{data.ledger.map((l) => (
              <tr key={l.ledger_id}>
                <td>{fmtDateTime(l.created_at)}<div className="tiny muted">{l.billable_seconds ? `${Math.ceil(l.billable_seconds / 60)} min ${l.mode}` : l.note}</div></td>
                <td>{l.entry_type === 'adjustment' ? <Badge tone="warn">Adjustment</Badge> : 'Consultation'}</td>
                <td className="right">{rupees(l.gross_paise)}</td><td className="right">{rupees(l.platform_fee_paise)} <span className="tiny muted">({l.fee_bps / 100}%)</span></td>
                <td className="right"><strong>{rupees(l.payable_paise)}</strong></td><td><Badge status={l.status} /></td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
    </div>
  );
}
