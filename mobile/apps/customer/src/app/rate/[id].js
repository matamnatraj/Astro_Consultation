import { useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons as MCI } from '@expo/vector-icons';
import { useAuth, useAsync, Loading, ErrorBox, rupees, fmtDate } from '@astro/mobile-core';
import { astrovedas as c } from '../../lib/theme.js';
import { useAppConfig } from '../../lib/stores.js';
import { F, Txt, AstroAvatar, GradientButton } from '../../components/brand.js';

const Tile = ({ icon, label, value }) => (
  <View style={{ flex: 1, borderRadius: 18, borderWidth: 1, borderColor: '#F3DCC4', backgroundColor: '#FFF8F1', paddingVertical: 14, alignItems: 'center', gap: 4 }}>
    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}><MCI name={icon} size={19} color={c.accent} /></View>
    <Txt size={13} color={c.text2}>{label}</Txt><Txt w="s" size={15}>{value}</Txt>
  </View>
);

export default function RateConsultation() {
  const { id } = useLocalSearchParams();
  const { api } = useAuth();
  const cfg = useAppConfig();
  const k = useAsync(() => api.get(`/consultations/${id}`), [id], { refocus: false });
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [tags, setTags] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  if (k.loading) return <Loading />;
  if (k.error) return <View style={{ padding: 16 }}><ErrorBox error={k.error} /></View>;
  const x = k.data;
  const submit = async () => {
    setBusy(true); setErr(null);
    try { await api.post(`/consultations/${id}/review`, { rating, comment: text || undefined, tags }); router.replace(`/consultation/${id}`); } catch (e) { setErr(e); setBusy(false); }
  };
  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 20, gap: 20, alignItems: 'stretch' }}>
      <View style={{ alignItems: 'center', gap: 4 }}>
        <AstroAvatar name={x.astrologer.name} size={96} />
        <Txt w="s" size={20} style={{ marginTop: 8 }}>{x.astrologer.name}</Txt>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Tile icon="clock-outline" label="Duration" value={`${Math.ceil((x.billableSeconds || 0) / 60)} minute${Math.ceil((x.billableSeconds || 0) / 60) === 1 ? "" : "s"}`} />
        <Tile icon="currency-inr" label="Amount" value={rupees(x.chargedPaise ?? x.finalAmountPaise ?? 0)} />
        <Tile icon="calendar-blank-outline" label="Date" value={fmtDate(x.endedAt || x.startedAt)} />
      </View>
      <Txt w="m" size={17} style={{ textAlign: 'center' }}>How was your experience?</Txt>
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 14 }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Pressable key={i} onPress={() => setRating(i)} hitSlop={6} accessibilityRole="button" accessibilityLabel={`${i} stars`}>
            <Ionicons name={rating >= i ? 'star' : 'star-outline'} size={40} color={rating >= i ? c.primary : '#BDB1A6'} />
          </Pressable>
        ))}
      </View>
      <View style={{ backgroundColor: c.surface, borderRadius: 20, borderWidth: 1, borderColor: c.border, padding: 14, minHeight: 130 }}>
        <TextInput value={text} onChangeText={(v) => setText(v.slice(0, 500))} multiline placeholder={'Share your feedback...\n(optional)'} placeholderTextColor={c.muted} accessibilityLabel="Feedback"
          style={[F.r, { fontSize: 15, color: c.text, minHeight: 90, textAlignVertical: 'top' }]} />
        <Txt size={12} color={c.muted} style={{ textAlign: 'right' }}>{text.length}/500</Txt>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {(cfg.reviewTags.length ? cfg.reviewTags : ['Knowledgeable', 'Helpful', 'Polite', 'Accurate', 'Friendly', 'Professional']).map((t) => {
          const on = tags.includes(t);
          return (
            <Pressable key={t} onPress={() => setTags(on ? tags.filter((x2) => x2 !== t) : [...tags, t])} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1.5, borderColor: on ? '#F3C66B' : c.border, backgroundColor: on ? '#FFF6E0' : c.surface }}>
              {on ? <Ionicons name="checkmark" size={15} color={c.pricePillText} /> : null}<Txt size={14.5} color={on ? c.pricePillText : c.text}>{t}</Txt>
            </Pressable>
          );
        })}
      </View>
      <ErrorBox error={err} />
      <GradientButton title="Submit Review" trailing="" onPress={submit} disabled={!rating} loading={busy} />
      <Txt size={12} color={c.muted} style={{ textAlign: 'center' }}>Reviews are public and may be moderated. For complaints, contact support instead.</Txt>
    </ScrollView>
  );
}
