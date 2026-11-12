import { FlatList, View } from 'react-native';
import { useAuth, useAsync, useToast } from '@astro/mobile-core';
import { MaterialCommunityIcons as MCI } from '@expo/vector-icons';
import { astrovedas as c } from '../lib/theme.js';
import { useAppConfig } from '../lib/stores.js';
import { useFavoriteToggle, startChat, startCall } from '../lib/actions.js';
import { Txt, AstrologerCard } from '../components/brand.js';

export default function Favorites() {
  const { api } = useAuth();
  const cfg = useAppConfig();
  const list = useAsync(() => api.get('/astrologers?favorites=true&sort=rating'), []);
  const [toast, show] = useToast();
  const toggle = useFavoriteToggle(list.setData, show);
  const callEnabled = cfg.enabledModes.includes('voice');
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <FlatList contentContainerStyle={{ padding: 16, gap: 14 }} data={(list.data || []).filter((a) => a.isFavorite)} keyExtractor={(a) => a.astrologerId} onRefresh={list.refresh} refreshing={list.refreshing}
        ListEmptyComponent={<View style={{ alignItems: 'center', padding: 40, gap: 8 }}><MCI name="heart-outline" size={40} color={c.primary} /><Txt w="s">{list.loading ? 'Loading…' : 'No favourites yet'}</Txt><Txt size={13} color={c.muted}>Tap ♡ on an astrologer to save them here.</Txt></View>}
        renderItem={({ item }) => <AstrologerCard a={item} callEnabled={callEnabled} onToggleFavorite={toggle} onChat={startChat} onCall={(a) => startCall(a, show, callEnabled)} />} />
      {toast}
    </View>
  );
}
