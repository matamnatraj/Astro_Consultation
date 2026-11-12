import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons as MCI } from '@expo/vector-icons';
import { useAuth, useAsync, useToast, Loading, ErrorBox, rupees, fmtDate } from '@astro/mobile-core';
import { astrovedas as c } from '../../lib/theme.js';
import { useAppConfig } from '../../lib/stores.js';
import { useFavoriteToggle, startChat, startCall } from '../../lib/actions.js';
import { Txt, AstroAvatar, HeartButton, SoftAction } from '../../components/brand.js';
import { BackButton } from '../../components/Header.js';
import { Pressable } from 'react-native';

function StatTile({ icon, value, label }) {
  return (
    <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: 20, paddingVertical: 14, alignItems: 'center', gap: 4, ...c.shadow }}>
      <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}><MCI name={icon} size={20} color={c.primary} /></View>
      <Txt w="s" size={15}>{value}</Txt><Txt size={12} color={c.text2}>{label}</Txt>
    </View>
  );
}

export default function AstrologerProfile() {
  const { id } = useLocalSearchParams();
  const { api } = useAuth();
  const cfg = useAppConfig();
  const a = useAsync(() => api.get(`/astrologers/${id}`), [id]);
  const [tab, setTab] = useState('about');
  const [toast, show] = useToast();
  const toggleFavorite = useFavoriteToggle(a.setData, show);
  if (a.loading) return <Loading />;
  if (a.error) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, padding: 16 }}><BackButton fallback="/astrologers" /><ErrorBox error={a.error} onRetry={a.reload} /></SafeAreaView>;
  const x = a.data;
  const callEnabled = cfg.enabledModes.includes('voice') && x.modes.includes('voice');
  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingHorizontal: 8 }}><BackButton fallback="/astrologers" /></View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 16, paddingBottom: 24 }}>
        <View style={{ alignItems: 'center', gap: 6 }}>
          <View>
            <View style={{ padding: 8, borderRadius: 100, backgroundColor: '#FBE6D3' }}><AstroAvatar name={x.displayName} size={112} online={x.isOnline} showOnlineLabel /></View>
            <View style={{ position: 'absolute', top: 6, right: 0, width: 40, height: 40, borderRadius: 20, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...c.shadow }}><HeartButton active={x.isFavorite} onPress={() => toggleFavorite(x)} /></View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
            <Txt w="b" size={24}>{x.displayName}</Txt>{x.verified ? <MCI name="check-decagram" size={22} color={c.primary} /> : null}
          </View>
          <Txt size={14.5} color={c.text2} style={{ textAlign: 'center' }}>{x.specialties.slice(0, 3).join(' • ')}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.accentSoft, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 5 }}>
            <Ionicons name="star" size={16} color={c.accent} /><Txt w="s">{x.ratingCount ? x.ratingAvg.toFixed(1) : 'New'}</Txt>
            <Txt size={13} color={c.text2}>({x.ratingCount} reviews)</Txt>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <StatTile icon="shield-check-outline" value={`${x.experienceYears}+ Years`} label="Experience" />
          <StatTile icon="message-text-outline" value={`${x.consultations ?? 0}+`} label="Consultations" />
          <StatTile icon="translate" value={`${x.languages.length}`} label="Languages" />
        </View>
        <View style={{ flexDirection: 'row', backgroundColor: '#F6EDE4', borderRadius: 24, padding: 4 }} accessibilityRole="tablist">
          {[['about', 'About'], ['reviews', 'Reviews'], ['services', 'Services']].map(([v, l]) => (
            <Pressable key={v} onPress={() => setTab(v)} accessibilityRole="tab" accessibilityState={{ selected: tab === v }} style={{ flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: 20, backgroundColor: tab === v ? c.primary : 'transparent' }}>
              <Txt w="m" size={15} color={tab === v ? '#fff' : c.text2}>{l}</Txt>
            </Pressable>
          ))}
        </View>
        <View style={{ backgroundColor: c.surface, borderRadius: 24, padding: 18, gap: 10, ...c.shadow }}>
          {tab === 'about' ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><MCI name="star-four-points-outline" size={20} color={c.primary} /><Txt w="s" size={17}>About {x.displayName.split(' ').slice(0, 2).join(' ')}</Txt></View>
              <Txt size={14.5} color={c.text2} style={{ lineHeight: 23 }}>{x.bio}</Txt>
              <Txt size={13} color={c.muted}>Languages: {x.languages.join(', ')}</Txt>
            </>
          ) : tab === 'reviews' ? (
            <>
              {x.topTags?.length ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{x.topTags.map((t) => <View key={t.tag} style={{ borderWidth: 1, borderColor: '#F3D8A6', backgroundColor: c.accentSoft, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4 }}><Txt size={12.5} color={c.pricePillText}>✓ {t.tag} · {t.count}</Txt></View>)}</View> : null}
              {!x.reviews.length ? <Txt color={c.muted}>No reviews yet.</Txt> : x.reviews.map((r, i) => (
                <View key={i} style={{ gap: 3, paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderColor: c.border }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt w="s">{r.reviewer}</Txt><Txt size={12} color={c.muted}>{fmtDate(r.created_at)}</Txt></View>
                  <Txt color={c.accent}>{'★'.repeat(r.rating)}<Txt color="#E9D9C9">{'★'.repeat(5 - r.rating)}</Txt></Txt>
                  {r.comment ? <Txt size={14} color={c.text2}>{r.comment}</Txt> : null}
                </View>
              ))}
            </>
          ) : (
            <>
              {(x.services.length ? x.services : ['Birth chart reading']).map((s) => <View key={s} style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><MCI name="check-circle" size={18} color={c.primary} /><Txt size={14.5}>{s}</Txt></View>)}
              <View style={{ height: 1, backgroundColor: c.border, marginVertical: 4 }} />
              {x.modes.map((m) => <View key={m} style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt size={14.5}>{m === 'voice' ? 'Audio call' : m === 'chat' ? 'Chat' : 'Video'}</Txt><Txt w="s" color={c.pricePillText}>{rupees(x.rates[m])}/min</Txt></View>)}
              <Txt size={12.5} color={c.muted}>{x.slots.length} open slots in the next 14 days for scheduled sessions.</Txt>
            </>
          )}
        </View>
      </ScrollView>
      <View style={{ flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: c.bg }}>
        <SoftAction icon="chatbox" label={`Chat · ${rupees(x.rates.chat)}/min`} filled={!callEnabled} disabled={x.isBusy && !x.slots.length} onPress={() => startChat(x)} />
        <SoftAction icon="call" label={callEnabled ? `Call · ${rupees(x.rates.voice)}/min` : 'Call · soon'} filled={callEnabled} disabled={!callEnabled} onPress={() => startCall(x, show, callEnabled)} />
      </View>
      {toast}
    </SafeAreaView>
  );
}
