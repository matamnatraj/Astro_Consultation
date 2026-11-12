import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons as MCI } from '@expo/vector-icons';
import { useAuth, useAsync, fmtDate } from '@astro/mobile-core';
import { astrovedas as c } from '../../lib/theme.js';
import { Txt, GradientButton } from '../../components/brand.js';

const TONES = ['#4B5BC4', '#F59E0B', '#16A34A', '#DB2777', '#0EA5E9', '#E8711A'];

export default function Kundli() {
  const { api } = useAuth();
  const list = useAsync(() => api.get('/clients/me/birth-profiles'), []);
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 180 }} refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={c.primary} />}>
        <Txt w="s" size={22}>Kundli</Txt>
        <Txt size={13.5} color={c.text2}>Your saved birth charts. Astrologers see the one you choose during a consultation.</Txt>
        <Pressable onPress={() => router.push('/predictions')} style={{ backgroundColor: '#2A170C', borderRadius: 20, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }} accessibilityRole="button">
          <MCI name="zodiac-leo" size={28} color={c.gold} />
          <View style={{ flex: 1 }}><Txt w="s" size={15} color="#fff">Today's transits for you</Txt><Txt size={12.5} color="rgba(255,255,255,0.8)">Planets over your chart right now</Txt></View>
          <Ionicons name="chevron-forward" size={20} color={c.gold} />
        </Pressable>
        {(list.data || []).map((b, i) => (
          <View key={b.birthProfileId} style={{ backgroundColor: c.surface, borderRadius: 20, padding: 16, flexDirection: 'row', gap: 14, alignItems: 'center', ...c.shadow }}>
            <Pressable onPress={() => router.push(`/chart/${b.birthProfileId}`)} accessibilityRole="button" accessibilityLabel={`${b.fullName} kundli`} style={{ flex: 1, flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: TONES[i % TONES.length], alignItems: 'center', justifyContent: 'center' }}><Txt w="s" size={22} color="#fff">{b.fullName[0]}</Txt></View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt w="s" size={16}>{b.fullName} <Txt size={12.5} color={c.muted}>· {b.label}</Txt></Txt>
              <Txt size={13} color={c.text2}>{fmtDate(b.birthDate)}, {b.birthTime ? b.birthTime.slice(0, 5) : 'time unknown'}</Txt>
              <Txt size={13} color={c.text2} numberOfLines={1}>{b.placeName}</Txt>
              {b.latestChart?.status === 'stale' ? <Txt w="m" size={12} color={c.warn}>Chart out of date — tap to regenerate</Txt> : null}
            </View>
            </Pressable>
            <Pressable onPress={() => router.push(`/birth-profile/${b.birthProfileId}`)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Edit ${b.fullName}`} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F4ECE4', alignItems: 'center', justifyContent: 'center' }}>
              <MCI name="square-edit-outline" size={20} color={c.text2} />
            </Pressable>
          </View>
        ))}
        {!list.loading && !list.data?.length ? (
          <View style={{ alignItems: 'center', padding: 30, gap: 8 }}><MCI name="dharmachakra" size={46} color={c.primary} /><Txt w="s">No kundli yet</Txt><Txt size={13} color={c.muted} style={{ textAlign: 'center' }}>Create your free kundli in under a minute.</Txt></View>
        ) : null}
      </ScrollView>
      <View style={{ position: 'absolute', left: 16, right: 16, bottom: 88 }}>
        <GradientButton title="Create New Kundli" trailing="+" onPress={() => router.push('/birth-profile/new')} />
      </View>
    </SafeAreaView>
  );
}
