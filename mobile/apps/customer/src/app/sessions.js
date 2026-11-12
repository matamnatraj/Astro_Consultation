import { FlatList, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth, useAsync, useRealtimeEvent, Badge, rupees, fmtDateTime } from '@astro/mobile-core';
import { MaterialCommunityIcons as MCI } from '@expo/vector-icons';
import { astrovedas as c } from '../lib/theme.js';
import { Txt, AstroAvatar } from '../components/brand.js';

export default function Sessions() {
  const { api } = useAuth();
  const list = useAsync(() => api.get('/bookings'), []);
  useRealtimeEvent((ev) => { if (ev.type === 'notification') list.reload(); });
  return (
    <FlatList style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 12 }} data={list.data || []} keyExtractor={(b) => b.bookingId}
      onRefresh={list.refresh} refreshing={list.refreshing}
      ListEmptyComponent={<View style={{ alignItems: 'center', padding: 40, gap: 8 }}><MCI name="chat-outline" size={40} color={c.primary} /><Txt w="s">{list.loading ? 'Loading…' : 'No consultations yet'}</Txt></View>}
      renderItem={({ item: b }) => {
        const status = b.consultation?.status || b.status;
        const charged = b.consultation?.status === 'completed' ? (b.consultation.finalAmountPaise ?? 0) : b.payablePaise;
        return (
          <Pressable onPress={() => router.push(b.consultation ? `/consultation/${b.consultation.consultationId}` : `/booking/${b.bookingId}`)} accessibilityRole="button"
            style={{ backgroundColor: c.surface, borderRadius: 20, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center', ...c.shadow }}>
            <AstroAvatar name={b.astrologerName} size={48} />
            <View style={{ flex: 1, gap: 3 }}>
              <Txt w="s" size={15}>{b.astrologerName}</Txt>
              <Txt size={12.5} color={c.text2}>{b.bookingType === 'scheduled' ? fmtDateTime(b.scheduledAt) : fmtDateTime(b.createdAt)} · {b.mode === 'voice' ? 'Call' : 'Chat'}</Txt>
              <Badge status={status} />
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Txt w="s">{rupees(charged)}</Txt>
              {b.consultation?.status === 'completed' && !b.consultation.reviewed ? <Txt w="m" size={12} color={c.primary} onPress={() => router.push(`/rate/${b.consultation.consultationId}`)}>Rate ★</Txt> : null}
            </View>
          </Pressable>
        );
      }} />
  );
}
