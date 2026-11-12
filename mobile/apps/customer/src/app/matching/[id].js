import { Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { router, useLocalSearchParams, Stack } from 'expo-router';
import { Ionicons, MaterialCommunityIcons as MCI } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { useAuth, useAsync, Loading, ErrorBox, fmtDate } from '@astro/mobile-core';
import { astrovedas as c } from '../../lib/theme.js';
import { useT } from '../../lib/i18n.js';
import { verdictKey, scoreColor } from '../../lib/matching.js';
import { setFilters, EMPTY_FILTERS } from '../../lib/stores.js';
import { Txt, GradientButton } from '../../components/brand.js';

function ScoreRing({ total, max = 36, size = 150 }) {
  const stroke = 12; const r = (size - stroke) / 2; const len = 2 * Math.PI * r;
  const color = scoreColor(total);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="#F1E3D5" strokeWidth={stroke} fill="none" />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${(len * total) / max} ${len}`} />
      </Svg>
      <Txt w="b" size={38} color={color}>{total}</Txt>
      <Txt w="m" size={13} color={c.text2}>/ {max}</Txt>
    </View>
  );
}

function Person({ p, side, manglik, t }) {
  const accent = side === 'boy' ? '#4B5BC4' : '#DB2777';
  return (
    <View style={{ flex: 1, backgroundColor: c.surface, borderRadius: 18, padding: 12, gap: 3, ...c.shadow }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <MCI name={side === 'boy' ? 'gender-male' : 'gender-female'} size={16} color={accent} />
        <Txt w="s" size={14.5} numberOfLines={1} style={{ flex: 1 }}>{p.name}</Txt>
      </View>
      <Txt size={12} color={c.text2}>{fmtDate(p.birthDate)}{p.birthTime ? `, ${p.birthTime.slice(0, 5)}` : ''}</Txt>
      <Txt size={12} color={c.text2} numberOfLines={1}>{p.placeName}</Txt>
      <Txt size={12}><Txt w="m" size={12}>☾ </Txt>{p.moonSign} · {p.nakshatra}</Txt>
      <View style={{ alignSelf: 'flex-start', marginTop: 4, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: manglik.isManglik ? '#FDE2E2' : '#E5F5EC' }}>
        <Txt w="m" size={11.5} color={manglik.isManglik ? c.bad : c.ok}>{t(manglik.isManglik ? 'match.isManglik' : 'match.notManglik')}</Txt>
      </View>
    </View>
  );
}

export default function MatchResult() {
  const { id } = useLocalSearchParams();
  const { api } = useAuth();
  const t = useT();
  const m = useAsync(() => api.get(`/matching/${id}`), [id]);
  if (m.error) return <View style={{ padding: 16 }}><ErrorBox error={m.error} /></View>;
  if (!m.data) return <Loading />;
  const x = m.data;
  const remove = () => {
    const go = async () => { await api.del(`/matching/${id}`); router.canGoBack() ? router.back() : router.replace('/matching'); };
    if (Platform.OS === 'web') go(); else Alert.alert('Delete this match?', '', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: go }]);
  };
  const ask = () => { setFilters({ ...EMPTY_FILTERS, specialties: ['Kundli Matching', 'Marriage'] }); router.push('/astrologers'); };
  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
      <Stack.Screen options={{ headerRight: () => <Pressable onPress={remove} hitSlop={10} accessibilityRole="button" accessibilityLabel="Delete match"><Ionicons name="trash-outline" size={21} color={c.text2} /></Pressable> }} />
      <View style={{ backgroundColor: c.surface, borderRadius: 26, padding: 20, alignItems: 'center', gap: 10, ...c.shadow }}>
        <ScoreRing total={x.total} max={x.max} />
        <Txt w="b" size={20} color={scoreColor(x.total)}>{t(verdictKey(x.total))}</Txt>
        <Txt w="m" size={14} color={c.text2}>{t('match.gunas', { n: x.total })}</Txt>
      </View>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Person p={x.boy} side="boy" manglik={x.manglik.boy} t={t} />
        <Person p={x.girl} side="girl" manglik={x.manglik.girl} t={t} />
      </View>

      <Txt w="s" size={17}>{t('match.breakdown')}</Txt>
      <View style={{ backgroundColor: c.surface, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 4, ...c.shadow }}>
        {x.kootas.map((k, i) => {
          const pct = k.max ? k.points / k.max : 0;
          const bar = pct >= 0.75 ? c.ok : pct >= 0.4 ? c.accent : c.bad;
          return (
            <View key={k.key} style={{ paddingVertical: 12, gap: 6, borderTopWidth: i ? 1 : 0, borderColor: c.border }} accessibilityLabel={`${k.name}: ${k.points} of ${k.max}`}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Txt w="s" size={15} style={{ flex: 1 }}>{k.name} <Txt size={12.5} color={c.text2}>· {t(`koota.${k.key}`)}</Txt></Txt>
                <Txt w="b" size={15} color={bar}>{k.points}<Txt size={12.5} color={c.muted}> / {k.max}</Txt></Txt>
              </View>
              <View style={{ height: 7, borderRadius: 4, backgroundColor: '#F1E3D5', overflow: 'hidden' }}><View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: bar, borderRadius: 4 }} /></View>
              <Txt size={12} color={c.muted}>{k.boy} · {k.girl}</Txt>
            </View>
          );
        })}
      </View>

      <Txt w="s" size={17}>{t('match.doshas')}</Txt>
      <View style={{ backgroundColor: c.surface, borderRadius: 22, padding: 16, gap: 10, ...c.shadow }}>
        {x.doshas.length ? x.doshas.map((d) => (
          <View key={d.key} style={{ flexDirection: 'row', gap: 10 }}>
            <MCI name="alert-circle-outline" size={20} color={c.bad} />
            <View style={{ flex: 1 }}><Txt w="m" size={14.5}>{d.name}</Txt><Txt size={12.5} color={c.text2}>{d.detail}</Txt></View>
          </View>
        )) : <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}><MCI name="check-circle-outline" size={20} color={c.ok} /><Txt size={14}>{t('match.noDoshas')}</Txt></View>}
      </View>

      <Txt w="s" size={17}>{t('match.manglik')}</Txt>
      <View style={{ backgroundColor: c.surface, borderRadius: 22, padding: 16, gap: 6, ...c.shadow }}>
        <Txt size={14}>{x.manglik.verdict}</Txt>
      </View>

      {x.warnings?.map((w) => (
        <View key={w} style={{ backgroundColor: c.warnSoft, borderRadius: 16, padding: 12, flexDirection: 'row', gap: 8 }}>
          <MCI name="clock-alert-outline" size={18} color={c.warn} /><Txt size={12.5} color={c.warn} style={{ flex: 1 }}>{w}</Txt>
        </View>
      ))}
      <Txt size={12} color={c.muted} style={{ textAlign: 'center' }}>{x.note}</Txt>
      <GradientButton title={t('match.ask')} icon="message-text-outline" onPress={ask} />
    </ScrollView>
  );
}
