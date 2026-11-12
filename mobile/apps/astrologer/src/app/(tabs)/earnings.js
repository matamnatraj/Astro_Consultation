import { View } from 'react-native';
import { useAuth, useAsync, Screen, Card, T, Row, Badge, Stat, Loading, ErrorBox, Empty, rupees, fmtDate, fmtDateTime, useT } from '@astro/mobile-core';

export default function Earnings() {
  const { api } = useAuth();
  const t = useT();
  const e = useAsync(() => api.get('/astrologer/me/earnings'), []);
  if (e.loading) return <Loading />;
  if (e.error) return <Screen><ErrorBox error={e.error} onRetry={e.reload} /></Screen>;
  const s = e.data.summary;
  return (
    <Screen onRefresh={e.refresh} refreshing={e.refreshing}>
      <T small muted>{t('earn.intro')}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Stat label={t('earn.gross')} value={rupees(s.gross)} sub={t('earn.count', { n: s.consultations })} />
        <Stat label={t('earn.commission')} value={rupees(s.platform_fees)} />
        <Stat label={t('earn.onHold')} value={rupees(s.on_hold)} />
        <Stat label={t('earn.eligible')} value={rupees(s.eligible)} tone="ok" />
        <Stat label={t('earn.paid')} value={rupees(s.paid)} />
      </View>
      <Card title={t('earn.payouts')}>
        {!e.data.payouts.length ? <T small muted>{t('earn.noPayouts')}</T> : e.data.payouts.map((p) => (
          <Row key={p.payout_id} style={{ justifyContent: 'space-between' }}>
            <View><T bold>{rupees(p.amount_paise)}</T><T tiny muted>{fmtDate(p.created_at)} · {t('earn.entries', { n: p.entry_count })}{p.reference ? ` · ${p.reference}` : ''}</T></View>
            <Badge status={p.status} />
          </Row>
        ))}
      </Card>
      <Card title={t('earn.ledger')}>
        {!e.data.ledger.length ? <Empty title={t('earn.none')} /> : e.data.ledger.map((l) => (
          <View key={l.ledger_id} style={{ gap: 2, paddingVertical: 6 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <T small bold>{l.entry_type === 'adjustment' ? t('earn.adjustment') : `${t('common.min', { n: Math.ceil((l.billable_seconds || 0) / 60) })} · ${t(`mode.${l.mode}`)}`}</T>
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
