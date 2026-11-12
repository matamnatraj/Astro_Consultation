import { useEffect, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons as MCI } from '@expo/vector-icons';
import { useAuth, useAsync, ErrorBox, fmtDate } from '@astro/mobile-core';
import { astrovedas as c } from '../../lib/theme.js';
import { useT } from '../../lib/i18n.js';
import { verdictKey, scoreColor } from '../../lib/matching.js';
import { fontFor, Txt, GradientButton, ChipToggle } from '../../components/brand.js';

const pad2 = (n) => String(n).padStart(2, '0');
const EMPTY = { source: 'manual', birthProfileId: null, name: '', day: '', month: '', year: '', hour: '', minute: '', unknownTime: false, place: null };
const digits = (n) => (v) => v.replace(/\D/g, '').slice(0, n);

const Input = ({ style, ...p }) => (
  <TextInput placeholderTextColor={c.muted} {...p}
    style={[fontFor('m', p.value || p.placeholder), { backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, height: 50, fontSize: 15, color: c.text, minWidth: 0 }, style]} />
);
const Label = ({ children }) => <Txt w="m" size={13} color={c.text2}>{children}</Txt>;

function validDate(p) {
  const iso = `${p.year}-${pad2(p.month)}-${pad2(p.day)}`;
  const d = new Date(`${iso}T00:00:00Z`);
  return p.year.length === 4 && !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso && d <= new Date() ? iso : null;
}
const validTime = (p) => (p.unknownTime ? true : p.hour !== '' && p.minute !== '' && Number(p.hour) <= 23 && Number(p.minute) <= 59);
const personReady = (p) => (p.source === 'saved' ? !!p.birthProfileId : !!(p.name.trim() && validDate(p) && validTime(p) && p.place));
const toBody = (p) => (p.source === 'saved' ? { birthProfileId: p.birthProfileId } : {
  name: p.name.trim(), birthDate: validDate(p), birthTime: p.unknownTime ? null : `${pad2(p.hour)}:${pad2(p.minute)}`,
  timeAccuracy: p.unknownTime ? 'unknown' : 'exact', placeName: p.place.label, latitude: p.place.latitude, longitude: p.place.longitude, tzName: p.place.tzName,
});

function PlaceSearch({ api, value, onChange, t, label }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  useEffect(() => {
    if (q.length < 2) { setResults([]); return undefined; }
    const h = setTimeout(() => api.get(`/places?q=${encodeURIComponent(q)}`).then(setResults).catch(() => {}), 250);
    return () => clearTimeout(h);
  }, [q, api]);
  if (value) {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, height: 50 }}>
        <Ionicons name="location" size={18} color={c.primary} />
        <Txt w="m" size={14.5} style={{ flex: 1 }} numberOfLines={1}>{value.label}</Txt>
        <Pressable onPress={() => onChange(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Change ${label}`}><Ionicons name="close-circle" size={20} color={c.muted} /></Pressable>
      </View>
    );
  }
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surface, borderRadius: 14, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, height: 50 }}>
        <Ionicons name="search-outline" size={18} color={c.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder={t('match.searchCity')} placeholderTextColor={c.muted} autoCorrect={false} accessibilityLabel={label} style={[fontFor('r', q || t('match.searchCity')), { flex: 1, fontSize: 14.5, color: c.text }]} />
      </View>
      {results.slice(0, 6).map((p) => (
        <Pressable key={p.label} onPress={() => { onChange(p); setQ(''); setResults([]); }} accessibilityRole="button" style={{ paddingVertical: 9, paddingHorizontal: 6, borderBottomWidth: 1, borderColor: c.border }}>
          <Txt w="m" size={14}>{p.label}</Txt><Txt size={11.5} color={c.muted}>{p.tzName}</Txt>
        </Pressable>
      ))}
    </View>
  );
}

function PersonCard({ side, value, onChange, profiles, api, t }) {
  const set = (patch) => onChange({ ...value, ...patch });
  const accent = side === 'boy' ? '#4B5BC4' : '#DB2777';
  const title = t(side === 'boy' ? 'match.boy' : 'match.girl');
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: 22, padding: 16, gap: 12, ...c.shadow }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }}><MCI name={side === 'boy' ? 'gender-male' : 'gender-female'} size={20} color="#fff" /></View>
        <Txt w="s" size={16.5}>{title}</Txt>
      </View>
      {profiles.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <ChipToggle label={t('match.enterDetails')} active={value.source === 'manual'} onPress={() => set({ source: 'manual' })} />
          <ChipToggle label={t('match.useSaved')} active={value.source === 'saved'} onPress={() => set({ source: 'saved' })} />
        </View>
      ) : null}
      {value.source === 'saved' ? (
        <View style={{ gap: 8 }}>
          {profiles.map((p) => {
            const on = value.birthProfileId === p.birthProfileId;
            return (
              <Pressable key={p.birthProfileId} onPress={() => set({ birthProfileId: p.birthProfileId })} accessibilityRole="radio" accessibilityState={{ checked: on }} accessibilityLabel={`${title}: ${p.fullName}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1.5, borderColor: on ? c.primary : c.border, backgroundColor: on ? c.primarySoft : c.surface }}>
                <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? c.primary : c.muted} />
                <View style={{ flex: 1 }}>
                  <Txt w="m" size={14.5}>{p.fullName} <Txt size={12} color={c.muted}>· {p.label}</Txt></Txt>
                  <Txt size={12} color={c.text2} numberOfLines={1}>{fmtDate(p.birthDate)}, {p.birthTime ? p.birthTime.slice(0, 5) : t('kundli.timeUnknown')} · {p.placeName}</Txt>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          <Label>{t('match.name')}</Label>
          <Input value={value.name} onChangeText={(name) => set({ name })} placeholder={t('match.enterName')} accessibilityLabel={`${title}: ${t('match.name')}`} />
          <Label>{t('match.birthDate')}</Label>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Input style={{ flex: 1 }} value={value.day} onChangeText={(v) => set({ day: digits(2)(v) })} placeholder={t('match.day')} keyboardType="number-pad" accessibilityLabel={`${title}: day`} />
            <Input style={{ flex: 1 }} value={value.month} onChangeText={(v) => set({ month: digits(2)(v) })} placeholder={t('match.month')} keyboardType="number-pad" accessibilityLabel={`${title}: month`} />
            <Input style={{ flex: 1.5 }} value={value.year} onChangeText={(v) => set({ year: digits(4)(v) })} placeholder={t('match.year')} keyboardType="number-pad" accessibilityLabel={`${title}: year`} />
          </View>
          {value.year.length === 4 && !validDate(value) ? <Txt size={12} color={c.bad}>Enter a valid date.</Txt> : null}
          <Label>{t('match.birthTime')}</Label>
          {!value.unknownTime ? (
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Input style={{ flex: 1 }} value={value.hour} onChangeText={(v) => set({ hour: digits(2)(v) })} placeholder={`${t('match.hour')} (0–23)`} keyboardType="number-pad" accessibilityLabel={`${title}: hour`} />
              <Input style={{ flex: 1 }} value={value.minute} onChangeText={(v) => set({ minute: digits(2)(v) })} placeholder={t('match.minute')} keyboardType="number-pad" accessibilityLabel={`${title}: minute`} />
            </View>
          ) : null}
          <Pressable onPress={() => set({ unknownTime: !value.unknownTime })} accessibilityRole="checkbox" accessibilityState={{ checked: value.unknownTime }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <MCI name={value.unknownTime ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={value.unknownTime ? c.primary : c.muted} />
            <Txt size={13.5} style={{ flex: 1 }}>{t('match.dontKnow')}</Txt>
          </Pressable>
          {value.unknownTime ? <Txt size={12} color={c.warn}>{t('match.timeNote')}</Txt> : null}
          <Label>{t('match.birthPlace')}</Label>
          <PlaceSearch api={api} t={t} value={value.place} onChange={(place) => set({ place })} label={`${title}: ${t('match.birthPlace')}`} />
        </View>
      )}
    </View>
  );
}

export default function Matching() {
  const { api } = useAuth();
  const t = useT();
  const profiles = useAsync(() => api.get('/clients/me/birth-profiles'), []);
  const recent = useAsync(() => api.get('/matching'), [], { refocus: true });
  const [boy, setBoy] = useState(EMPTY);
  const [girl, setGirl] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const ready = personReady(boy) && personReady(girl);
  const submit = async () => {
    setBusy(true); setErr(null);
    try { const m = await api.post('/matching', { boy: toBody(boy), girl: toBody(girl) }); router.push(`/matching/${m.matchId}`); recent.reload(); } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#2A170C', borderRadius: 22, padding: 16 }}>
          <MCI name="heart-multiple" size={34} color={c.gold} />
          <View style={{ flex: 1 }}><Txt w="s" size={16} color="#fff">{t('match.new')}</Txt><Txt size={12.5} color="rgba(255,255,255,0.8)">{t('kundli.matchingSub')}</Txt></View>
        </View>
        <PersonCard side="boy" value={boy} onChange={setBoy} profiles={profiles.data || []} api={api} t={t} />
        <PersonCard side="girl" value={girl} onChange={setGirl} profiles={profiles.data || []} api={api} t={t} />
        <ErrorBox error={err} />
        <GradientButton title={t('match.cta')} icon="heart-multiple-outline" onPress={submit} loading={busy} disabled={!ready} />

        <Txt w="s" size={17} style={{ marginTop: 8 }}>{t('match.recent')}</Txt>
        {!recent.data?.length ? <Txt color={c.muted}>{recent.loading ? t('common.loading') : t('match.empty')}</Txt> : recent.data.map((m) => (
          <Pressable key={m.matchId} onPress={() => router.push(`/matching/${m.matchId}`)} accessibilityRole="button" accessibilityLabel={`${m.boy.name} and ${m.girl.name}, ${m.total} of 36`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.surface, borderRadius: 18, padding: 14, ...c.shadow }}>
            <View style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 3, borderColor: scoreColor(m.total), alignItems: 'center', justifyContent: 'center' }}>
              <Txt w="b" size={15} color={scoreColor(m.total)}>{m.total}</Txt>
            </View>
            <View style={{ flex: 1 }}>
              <Txt w="s" size={15} numberOfLines={1}>{m.boy.name} & {m.girl.name}</Txt>
              <Txt size={12.5} color={c.text2}>{t(verdictKey(m.total))} · {fmtDate(m.createdAt)}</Txt>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.muted} />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
