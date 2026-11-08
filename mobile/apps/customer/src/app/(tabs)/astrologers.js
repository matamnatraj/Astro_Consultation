import { useState } from 'react';
import { FlatList, View } from 'react-native';
import { useAuth, useAsync, Field, Chips, Chip, Loading, Empty, ErrorBox, T, useTheme } from '@astro/mobile-core';
import { AstrologerCard } from '../../components/AstrologerCard.js';

const SORTS = [['rating', 'Top rated'], ['price_asc', 'Price ↑'], ['price_desc', 'Price ↓'], ['experience', 'Experience']];

export default function Astrologers() {
  const { api } = useAuth();
  const c = useTheme();
  const [q, setQ] = useState('');
  const [language, setLanguage] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [online, setOnline] = useState(false);
  const [sort, setSort] = useState('rating');
  const filters = useAsync(() => api.get('/astrologers/filters'), []);
  const qs = new URLSearchParams(Object.entries({ q, language, specialty, online: online ? 'true' : '', sort }).filter(([, v]) => v)).toString();
  const list = useAsync(() => api.get(`/astrologers?${qs}`), [qs]);

  const header = (
    <View style={{ gap: 10, paddingBottom: 6 }}>
      <Field placeholder="Search by name or expertise" value={q} onChangeText={setQ} autoCorrect={false} accessibilityLabel="Search astrologers" />
      <Chips>
        <Chip label="● Online now" active={online} onPress={() => setOnline(!online)} />
        {SORTS.map(([v, l]) => <Chip key={v} label={l} active={sort === v} onPress={() => setSort(v)} />)}
      </Chips>
      <T tiny muted bold>LANGUAGE</T>
      <Chips>{['', ...(filters.data?.languages || [])].map((l) => <Chip key={l || 'any'} label={l || 'Any'} active={language === l} onPress={() => setLanguage(l)} />)}</Chips>
      <T tiny muted bold>SPECIALTY</T>
      <Chips>{['', ...(filters.data?.specialties || [])].map((l) => <Chip key={l || 'any'} label={l || 'Any'} active={specialty === l} onPress={() => setSpecialty(l)} />)}</Chips>
      <ErrorBox error={list.error} onRetry={list.reload} />
    </View>
  );
  return (
    <FlatList
      style={{ backgroundColor: c.bg }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={list.data || []}
      keyExtractor={(a) => a.astrologerId}
      ListHeaderComponent={header}
      ListEmptyComponent={list.loading ? <Loading /> : <Empty title="No astrologers match">Try removing a filter.</Empty>}
      renderItem={({ item }) => <AstrologerCard a={item} />}
      onRefresh={list.refresh}
      refreshing={list.refreshing}
      keyboardShouldPersistTaps="handled"
    />
  );
}
