import { View } from 'react-native';
import { useAuth, useAsync, Screen, Card, T, Row, Badge, Stat, Loading, ErrorBox, Empty, rupees, fmtDate, fmtDateTime } from '@astro/mobile-core';

export default function Earnings() {
  const { api } = useAuth();
  const e = useAsync(() => api.get('/astrologer/me/earnings'), []);
  if (e.loading) return <Loading />;
  if (e.error) return <Screen><ErrorBox error={e.error} onRetry={e.reload} /></Screen>;
  const s = e.data.summary;
  return (
    <Screen onRefresh={e.refresh} refreshing={e.refreshing}>
      <T small muted>Every consultation creates a ledger entry. Earnings become eligible for payout after the hold period.</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Stat label="Gross earned" value={rupees(s.gross)} sub={`${s.consultations} consultations`} />
        <Stat label="Commission" value={rupees(s.platform_fees)} />
        <Stat label="On hold" value={rupees(s.on_hold)} />
        <Stat label="Eligible" value={rupees(s.eligible)} tone="ok" />
        <Stat label="Paid out" value={rupees(s.paid)} />
      </View>
      <Card title="Payouts">
        {!e.data.payouts.length ? <T small muted>No payouts yet.</T> : e.data.payouts.map((p) => (
          <Row key={p.payout_id} style={{ justifyContent: 'space-between' }}>
            <View><T bold>{rupees(p.amount_paise)}</T><T tiny muted>{fmtDate(p.created_at)} · {p.entry_count} entries{p.reference ? ` · ${p.reference}` : ''}</T></View>
            <Badge status={p.status} />
          </Row>
        ))}
      </Card>
      <Card title="Ledger">
        {!e.data.ledger.length ? <Empty title="No earnings yet" /> : e.data.ledger.map((l) => (
          <View key={l.ledger_id} style={{ gap: 2, paddingVertical: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T small bold>{l.entry_type === 'adjustment' ? 'Adjustment' : `${Math.ceil((l.billable_seconds || 0) / 60)} min ${l.mode}`}</T>
              <T bold>{rupees(l.payable_paise)}</T>
            </Row>
            <Row style={{ justifyContent: 'space-between' }}>
              <T tiny muted>{fmtDateTime(l.created_at)} · gross {rupees(l.gross_paise)} · fee {rupees(l.platform_fee_paise)} ({l.fee_bps / 100}%)</T>
              <Badge status={l.status} />
            </Row>
            {l.note ? <T tiny muted>{l.note}</T> : null}
          </View>
        ))}
      </Card>
    </Screen>
  );
}
