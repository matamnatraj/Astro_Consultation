import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth, useAsync, useToast } from '@astro/mobile-core';
import { astrovedas as c } from '../../lib/theme.js';
import { useFilters, filtersToQuery, activeFilterCount, useAppConfig } from '../../lib/stores.js';
import { useFavoriteToggle, startChat, startCall } from '../../lib/actions.js';
import { Txt, ModeTabs, SearchRow, AstrologerCard } from '../../components/brand.js';
import { MaterialCommunityIcons as MCI } from '@expo/vector-icons';

const SORTS = [['popular', 'Popular'], ['rating', 'Top rated'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low'], ['experience', 'Most experienced']];

export default function Astrologers() {
  const { api } = useAuth();
  const { focus } = useLocalSearchParams();
  const cfg = useAppConfig();
  const [f, setF] = useFilters();
  const [q, setQ] = useState(f.q);
  const [sortOpen, setSortOpen] = useState(false);
  const [toast, show] = useToast();
  useEffect(() => { const t = setTimeout(() => setF({ q }), 300); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  const query = filtersToQuery(f);
  const list = useAsync(() => api.get(`/astrologers?${query}`), [query]);
  const toggleFavorite = useFavoriteToggle(list.setData, show);
  const callEnabled = cfg.enabledModes.includes('voice');

  const header = (
    <View style={{ gap: 14, paddingBottom: 4 }}>
      <ModeTabs value={f.mode} onChange={(mode) => (mode === 'voice' && !callEnabled ? show('Audio calls are coming soon. Chat is available now.', 'info') : setF({ mode }))} />
      <SearchRow value={q} onChangeText={setQ} placeholder="Search astrologers, skills…" onFilter={() => router.push('/filters')} filterCount={activeFilterCount(f)} />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Switch value={f.online} onValueChange={(online) => setF({ online })} trackColor={{ true: c.primary, false: '#E7D7C8' }} thumbColor="#fff" accessibilityLabel="Online only" />
          <Txt w="m" size={15}>Online Only</Txt>
        </View>
        <Pressable onPress={() => setSortOpen(true)} accessibilityRole="button" accessibilityLabel="Sort" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.surface, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, ...c.shadow }}>
          <Txt size={13} color={c.text2}>Sort:</Txt><Txt w="s" size={14} color={c.pricePillText}>{SORTS.find(([v]) => v === f.sort)?.[1].split(':')[0]}</Txt><Ionicons name="chevron-down" size={16} color={c.pricePillText} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList
        data={list.data || []}
        keyExtractor={(a) => a.astrologerId}
        contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 110 }}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        onRefresh={list.refresh}
        refreshing={list.refreshing}
        renderItem={({ item }) => <AstrologerCard a={item} callEnabled={callEnabled} onToggleFavorite={toggleFavorite} onChat={(a) => startChat(a)} onCall={(a) => startCall(a, show, callEnabled)} />}
        ListEmptyComponent={<View style={{ alignItems: 'center', padding: 40, gap: 8 }}><MCI name="account-search-outline" size={40} color={c.primary} /><Txt w="s">{list.loading ? 'Finding astrologers…' : 'No astrologers match'}</Txt>{!list.loading ? <Txt size={13} color={c.muted}>Try removing a filter.</Txt> : null}</View>}
        ListFooterComponent={(list.data || []).length ? (
          <View style={{ backgroundColor: c.accentSoft, borderRadius: 20, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center', marginTop: 4 }}>
            <MCI name="check-decagram" size={32} color={c.primary} />
            <View style={{ flex: 1 }}><Txt w="s" size={15}>100% Certified Astrologers</Txt><Txt size={12.5} color={c.text2}>Every astrologer is verified by our team before taking consultations.</Txt></View>
          </View>
        ) : null}
      />
      <Modal visible={sortOpen} transparent animationType="fade" onRequestClose={() => setSortOpen(false)}>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(30,20,10,0.35)', justifyContent: 'flex-end' }} onPress={() => setSortOpen(false)}>
          <View style={{ backgroundColor: c.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, gap: 6, paddingBottom: 36 }}>
            <Txt w="s" size={17} style={{ marginBottom: 6 }}>Sort by</Txt>
            {SORTS.map(([v, l]) => (
              <Pressable key={v} onPress={() => { setF({ sort: v }); setSortOpen(false); }} accessibilityRole="radio" accessibilityState={{ selected: f.sort === v }} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 }}>
                <Txt w={f.sort === v ? 's' : 'r'} size={15} color={f.sort === v ? c.primary : c.text}>{l}</Txt>
                {f.sort === v ? <Ionicons name="checkmark-circle" size={20} color={c.primary} /> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
      {toast}
      {focus ? null : null}
    </SafeAreaView>
  );
}
