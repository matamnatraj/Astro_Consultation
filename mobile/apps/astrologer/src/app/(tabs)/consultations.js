import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth, useAsync, Segmented, Card, T, Row, Badge, Loading, Empty, rupees, fmtDateTime, useTheme, useT } from '@astro/mobile-core';

const GROUPS = { active: 'requested,accepted,ready,in_progress', completed: 'completed', closed: 'rejected,cancelled,expired,failed' };

export default function Consultations() {
  const { api } = useAuth();
  const c = useTheme();
  const t = useT();
  const [tab, setTab] = useState('active');
  const list = useAsync(() => api.get(`/consultations?status=${GROUPS[tab]}`), [tab]);
  return (
    <FlatList
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      data={list.data || []}
      keyExtractor={(k) => k.consultationId}
      onRefresh={list.refresh}
      refreshing={list.refreshing}
      ListHeaderComponent={<Segmented value={tab} onChange={setTab} options={[{ value: 'active', label: t('cons.active') }, { value: 'completed', label: t('cons.completed') }, { value: 'closed', label: t('cons.closed') }]} />}
      ListEmptyComponent={list.loading ? <Loading /> : <Empty title={t('cons.empty')} />}
      renderItem={({ item: k }) => (
        <Card onPress={() => router.push(`/consultation/${k.consultationId}`)}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: 3 }}>
              <Row gap={6} wrap><T bold>{k.client.name}</T><Badge status={k.status} />{k.unreadCount ? <Badge tone="live" label={t('common.new', { n: k.unreadCount })} /> : null}</Row>
              <T small muted>{fmtDateTime(k.startedAt || k.scheduledAt || k.acceptDeadline)} · {t(`type.${k.bookingType}`)}</T>
              {k.topic ? <T small>“{k.topic}”</T> : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <T bold>{k.finalAmountPaise != null ? rupees(k.finalAmountPaise) : '—'}</T>
              {k.billableSeconds ? <T tiny muted>{t('common.min', { n: Math.ceil(k.billableSeconds / 60) })}</T> : null}
            </View>
          </Row>
        </Card>
      )}
    />
  );
}
