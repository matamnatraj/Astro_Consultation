import { FlatList } from 'react-native';
import { router } from 'expo-router';
import { useAuth, useAsync, useRealtimeEvent, Card, T, Row, Badge, Avatar, Loading, Empty, Button, rupees, fmtDateTime, useTheme } from '@astro/mobile-core';
import { View } from 'react-native';

export default function Sessions() {
  const { api } = useAuth();
  const c = useTheme();
  const list = useAsync(() => api.get('/bookings'), []);
  useRealtimeEvent((ev) => { if (ev.type === 'notification') list.reload(); });
  return (
    <FlatList
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ padding: 16, gap: 10 }}
      data={list.data || []}
      keyExtractor={(b) => b.bookingId}
      onRefresh={list.refresh}
      refreshing={list.refreshing}
      ListEmptyComponent={list.loading ? <Loading /> : <Empty title="No sessions yet"><Button variant="ghost" title="Find an astrologer" onPress={() => router.push('/astrologers')} /></Empty>}
      renderItem={({ item: b }) => {
        const status = b.consultation?.status || b.status;
        return (
          <Card onPress={() => router.push(`/booking/${b.bookingId}`)}>
            <Row style={{ alignItems: 'flex-start' }}>
              <Avatar name={b.astrologerName} size={42} />
              <View style={{ flex: 1, gap: 3 }}>
                <Row gap={6} wrap><T bold>{b.astrologerName}</T><Badge status={status} /></Row>
                <T small muted>{b.bookingType === 'scheduled' ? fmtDateTime(b.scheduledAt) : `Instant · ${fmtDateTime(b.createdAt)}`}</T>
                <T small muted>{b.durationMinutes} min · for {b.birthProfileName}</T>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <T bold>{rupees(b.consultation?.finalAmountPaise ?? b.quotedAmountPaise)}</T>
                {b.consultation?.status === 'completed' && !b.consultation.reviewed ? <T tiny color={c.accent}>Rate session</T> : null}
              </View>
            </Row>
          </Card>
        );
      }}
    />
  );
}
