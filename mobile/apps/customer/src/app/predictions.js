import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons as MCI } from '@expo/vector-icons';
import { useAuth, useAsync, Loading, ErrorBox, fmtDate } from '@astro/mobile-core';
import { astrovedas as c } from '../lib/theme.js';
import { setFilters, EMPTY_FILTERS } from '../lib/stores.js';
import { Txt, GradientButton } from '../components/brand.js';

const GLYPH = { Sun: '☉', Moon: '☽', Mars: '♂', Mercury: '☿', Jupiter: '♃', Venus: '♀', Saturn: '♄', Rahu: '☊', Ketu: '☋' };

export default function Predictions() {
  const { api } = useAuth();
  const d = useAsync(() => api.get('/clients/me/today'), []);
  if (d.loading) return <Loading />;
  if (d.error) return <View style={{ padding: 16 }}><ErrorBox error={d.error} onRetry={d.reload} /></View>;
  if (!d.data.available) {
    return (
      <View style={{ flex: 1, backgroundColor: c.bg, padding: 24, gap: 14, justifyContent: 'center' }}>
        <MCI name="dharmachakra" size={52} color={c.primary} style={{ alignSelf: 'center' }} />
        <Txt w="s" size={18} style={{ textAlign: 'center' }}>Add your birth details first</Txt>
        <Txt color={c.text2} style={{ textAlign: 'center' }}>We need your kundli to work out today's transits for you.</Txt>
        <GradientButton title="Create Free Kundli" onPress={() => router.push('/birth-profile/new')} />
      </View>
    );
  }
  const x = d.data;
  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 40 }}>
      <LinearGradient colors={c.banner} style={{ borderRadius: 22, padding: 20, gap: 6 }}>
        <Txt w="m" size={12} color={c.gold} style={{ letterSpacing: 0.8 }}>{fmtDate(x.date).toUpperCase()}</Txt>
        <Txt w="b" size={22} color="#fff">Today's sky for {x.forName.split(' ')[0]}</Txt>
        <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}>
          {[['Moon sign', x.moonSign], ['Lagna', x.lagna], ['Nakshatra', x.nakshatra.split(' (')[0]]].map(([k, v]) => <View key={k}><Txt size={11.5} color="rgba(255,255,255,0.7)">{k}</Txt><Txt w="s" color="#fff">{v}</Txt></View>)}
        </View>
      </LinearGradient>
      {x.currentMahadasha ? (
        <View style={{ backgroundColor: c.surface, borderRadius: 20, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center', ...c.shadow }}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Txt w="b" size={22} color={c.primary}>{GLYPH[x.currentMahadasha.lord]}</Txt></View>
          <View style={{ flex: 1 }}><Txt size={12.5} color={c.text2}>Current Mahadasha</Txt><Txt w="s" size={16}>{x.currentMahadasha.lord}</Txt><Txt size={12.5} color={c.text2}>{fmtDate(x.currentMahadasha.start)} – {fmtDate(x.currentMahadasha.end)}</Txt></View>
        </View>
      ) : null}
      <Txt w="s" size={17}>Planetary transits</Txt>
      <View style={{ backgroundColor: c.surface, borderRadius: 20, paddingHorizontal: 14, ...c.shadow }}>
        {x.transits.map((t, i) => (
          <View key={t.planet} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: c.border }}>
            <Txt w="b" size={22} color={c.primary} style={{ width: 28, textAlign: 'center' }}>{GLYPH[t.planet]}</Txt>
            <View style={{ flex: 1 }}>
              <Txt w="s" size={14.5}>{t.planet} in {t.sign}{t.retrograde && !['Rahu', 'Ketu'].includes(t.planet) ? ' (R)' : ''}</Txt>
              <Txt size={12.5} color={c.text2}>House {t.houseFromMoon} from your Moon · {t.theme}</Txt>
            </View>
            <Txt size={12} color={c.muted}>{t.degree}</Txt>
          </View>
        ))}
      </View>
      <Txt size={12.5} color={c.muted}>{x.note}</Txt>
      <GradientButton title="Ask an astrologer about this" onPress={() => { setFilters({ ...EMPTY_FILTERS }); router.push('/astrologers'); }} />
    </ScrollView>
  );
}
