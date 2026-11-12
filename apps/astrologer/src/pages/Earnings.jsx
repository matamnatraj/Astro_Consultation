import { useAuth, useAsync, useT, Card, Spinner, ErrorBox, Badge, Stat, Empty, rupees, fmtDateTime, fmtDate } from '@astro/shared';

export default function Earnings() {
  const { api } = useAuth();
  const t = useT();
  const { data, loading, error, reload } = useAsync(() => api.get('/astrologer/me/earnings'), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const s = data.summary;
  return (
    <div className="stack">
      <div className="page-head"><div><h1>{t('tab.earnings')}</h1><p>{t('earn.intro')}</p></div></div>
      <div className="grid-stats">
        <Stat label={t('earn.gross')} value={rupees(s.gross)} sub={t('earn.count', { n: s.consultations })} />
        <Stat label={t('w.platform')} value={rupees(s.platform_fees)} />
        <Stat label={t('earn.onHold')} value={rupees(s.on_hold)} sub={t('w.withinHold')} />
        <Stat label={t('earn.eligible')} value={rupees(s.eligible)} tone="ok" sub={t('w.nextBatch')} />
        <Stat label={t('earn.paid')} value={rupees(s.paid)} />
      </div>
      <Card title={t('earn.payouts')}>
        {!data.payouts.length ? <p className="muted small">{t('earn.noPayouts')}</p> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>{t('w.date')}</th><th>{t('w.amount')}</th><th>{t('w.entries')}</th><th>{t('w.status')}</th><th>{t('w.reference')}</th></tr></thead>
            <tbody>{data.payouts.map((p) => <tr key={p.payout_id}><td>{fmtDate(p.created_at)}</td><td>{rupees(p.amount_paise)}</td><td>{p.entry_count}</td><td><Badge status={p.status} /></td><td className="mono">{p.reference || p.failure_reason || '—'}</td></tr>)}</tbody>
          </table></div>
        )}
      </Card>
      <Card title={t('earn.ledger')}>
        {!data.ledger.length ? <Empty title={t('earn.none')} /> : (
          <div className="table-wrap"><table className="table">
            <thead><tr><th>{t('w.date')}</th><th>{t('w.type')}</th><th className="right">{t('w.gross')}</th><th className="right">{t('earn.commission')}</th><th className="right">{t('w.payable')}</th><th>{t('w.status')}</th></tr></thead>
            <tbody>{data.ledger.map((l) => (
              <tr key={l.ledger_id}>
                <td>{fmtDateTime(l.created_at)}<div className="tiny muted">{l.billable_seconds ? `${t('common.min', { n: Math.ceil(l.billable_seconds / 60) })} · ${t(`mode.${l.mode}`)}` : l.note}</div></td>
                <td>{l.entry_type === 'adjustment' ? <Badge tone="warn">{t('earn.adjustment')}</Badge> : t('w.consultation')}</td>
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
