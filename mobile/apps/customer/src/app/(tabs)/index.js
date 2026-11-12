import { useState } from 'react';
import { FlatList, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth, useAsync, useRealtimeEvent, useUnreadNotifications, useToast, fmtDate } from '@astro/mobile-core';
import { astrovedas as c, CATEGORIES } from '../../lib/theme.js';
import { setFilters, EMPTY_FILTERS, useWallet, useAppConfig } from '../../lib/stores.js';
import { Txt, Logo, IconButton, WalletPill, SearchRow, PromoCarousel, QuickAction, CategoryTile, SectionHeader, AstrologerMiniCard, AstroAvatar } from '../../components/brand.js';
import { useFavoriteToggle, startChat, startCall } from '../../lib/actions.js';

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good Morning' : h < 17 ? 'Good Afternoon' : 'Good Evening'; };

export default function Home() {
  const { api, me } = useAuth();
  const cfg = useAppConfig();
  const [balance, refreshWallet] = useWallet();
  const [unread] = useUnreadNotifications();
  const astros = useAsync(() => api.get('/astrologers?sort=popular'), []);
  const profile = useAsync(() => api.get('/clients/me'), []);
  const sessions = useAsync(() => api.get('/bookings'), []);
  const [toast, show] = useToast();
  const toggleFavorite = useFavoriteToggle(astros.setData, show);
  useRealtimeEvent((ev) => { if (ev.type === 'notification') sessions.reload(); });
  const first = (me.user.displayName || '').split(' ')[0];
  const online = (astros.data || []).filter((a) => a.isOnline);
  const recommended = (astros.data || []).slice(0, 6);
  const recent = (sessions.data || []).filter((b) => b.consultation?.status === 'completed').slice(0, 1)[0];
  const callEnabled = cfg.enabledModes.includes('voice');

  const slides = [
    { key: 'kundli', eyebrow: 'PERSONALIZED ASTROLOGICAL CHART', title: 'Get Your', highlight: 'Free Kundli', body: 'Know your personality, life path & future predictions', cta: 'Generate Now',
      onPress: () => router.push(profile.data?.birthProfileCount ? '/kundli' : '/birth-profile/new') },
    { key: 'predictions', eyebrow: 'PERSONALIZED ASTROLOGY', title: 'GENERAL', highlight: 'PREDICTION', body: 'See today\'s planetary transits for your Moon sign', cta: 'View Predictions', onPress: () => router.push('/predictions') },
    { key: 'gift', eyebrow: 'WELCOME GIFT', title: 'First', highlight: `${cfg.welcomeFreeMinutes} min free`, body: 'On your first consultation paid from your wallet', cta: 'Chat Now', onPress: () => router.push('/astrologers') },
  ];

  const openCategory = (cat) => { setFilters({ ...EMPTY_FILTERS, specialties: cat.specialty.split(',') }); router.push('/astrologers'); };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 110, gap: 18 }}
        refreshControl={<RefreshControl refreshing={astros.refreshing} onRefresh={() => { astros.refresh(); profile.refresh(); sessions.refresh(); refreshWallet(); }} tintColor={c.primary} />}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Logo size={40} />
          <Txt w="b" size={17} style={{ flex: 1, letterSpacing: 1.2 }}>ASTROVEDAS</Txt>
          <IconButton name="notifications-outline" label={`Notifications, ${unread} unread`} badge={unread} onPress={() => router.push('/notifications')} />
          <IconButton name="person-outline" label="Profile" color={c.primary} onPress={() => router.push('/profile')} style={{ borderColor: c.primary, borderWidth: 2 }} />
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Txt size={14} color={c.text2}>{greeting()},</Txt>
            <Txt w="b" size={24} numberOfLines={1}>{first || 'Friend'} 👋</Txt>
          </View>
          <WalletPill balancePaise={balance} onAdd={() => router.push('/wallet')} onPress={() => router.push('/wallet')} />
        </View>

        <SearchRow value="" onChangeText={() => {}} onFocus={() => router.push('/astrologers?focus=1')} onFilter={() => router.push('/filters')} />

        <PromoCarousel slides={slides} />

        <View style={{ flexDirection: 'row', gap: 12 }}>
          <QuickAction icon="message-text-outline" label="Chat" onPress={() => { setFilters({ ...EMPTY_FILTERS, mode: 'chat' }); router.push('/astrologers'); }} />
          <QuickAction icon="phone-outline" label="Call" onPress={() => (callEnabled ? (setFilters({ ...EMPTY_FILTERS, mode: 'voice' }), router.push('/astrologers')) : show('Audio calls are coming soon. Chat is available now.', 'info'))} />
          <QuickAction icon="view-grid-outline" label="Kundli" onPress={() => router.push('/kundli')} />
        </View>

        <SectionHeader title="Astrology Categories" onViewAll={() => { setFilters({ ...EMPTY_FILTERS }); router.push('/astrologers'); }} />
        <FlatList horizontal data={CATEGORIES} keyExtractor={(x) => x.key} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingVertical: 4, paddingRight: 8 }}
          renderItem={({ item }) => <CategoryTile compact icon={item.icon} label={item.label} onPress={() => openCategory(item)} />} />

        {recent ? (
          <>
            <SectionHeader title="My Sessions" onViewAll={() => router.push('/sessions')} />
            <View style={{ backgroundColor: c.surface, borderRadius: 22, padding: 14, flexDirection: 'row', gap: 14, alignItems: 'center', ...c.shadow }}>
              <AstroAvatar name={recent.astrologerName} size={52} />
              <View style={{ flex: 1, gap: 8 }}>
                <View><Txt w="s" size={15}>{recent.astrologerName}</Txt><Txt size={12} color={c.muted}>{fmtDate(recent.consultation.endedAt || recent.createdAt)}</Txt></View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Txt w="m" size={13} color={c.primary} onPress={() => router.push(`/consultation/${recent.consultation.consultationId}`)} style={{ borderWidth: 1, borderColor: c.primary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 5 }}>View Chat</Txt>
                  <Txt w="m" size={13} color="#fff" onPress={() => router.push(`/astrologer/${recent.astrologerId}`)} style={{ backgroundColor: c.primary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6, overflow: 'hidden' }}>Chat Again</Txt>
                </View>
              </View>
            </View>
          </>
        ) : null}

        <SectionHeader title={online.length ? 'Online Astrologers' : 'Recommended For You'} onViewAll={() => { setFilters({ ...EMPTY_FILTERS, online: online.length > 0 }); router.push('/astrologers'); }} />
        <FlatList horizontal data={online.length ? online : recommended} keyExtractor={(a) => a.astrologerId} showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingVertical: 6, paddingRight: 8 }}
          ListEmptyComponent={<Txt color={c.muted}>{astros.loading ? 'Loading…' : 'No astrologers yet.'}</Txt>}
          renderItem={({ item }) => <AstrologerMiniCard a={item} onToggleFavorite={toggleFavorite} onChat={(a) => startChat(a, show)} />} />

        <View style={{ backgroundColor: c.accentSoft, borderRadius: 22, padding: 16, flexDirection: 'row', justifyContent: 'space-around' }}>
          {[['shield-lock-outline', 'Private &\nConfidential'], ['check-decagram-outline', 'Verified\nAstrologers'], ['credit-card-check-outline', 'Secure\nPayments']].map(([i, l]) => (
            <View key={i} style={{ alignItems: 'center', gap: 6 }}><QuickBadge icon={i} /><Txt w="m" size={12} style={{ textAlign: 'center' }}>{l}</Txt></View>
          ))}
        </View>
      </ScrollView>
      {toast}
    </SafeAreaView>
  );
}

import { MaterialCommunityIcons as MCI } from '@expo/vector-icons';
const QuickBadge = ({ icon }) => <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}><MCI name={icon} size={24} color={c.primary} /></View>;
void startCall;
