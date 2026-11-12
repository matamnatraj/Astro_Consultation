import { useState } from 'react';
import { ScrollView, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { astrovedas as c } from '../lib/theme.js';
import { useFilters, EMPTY_FILTERS, activeFilterCount, useAppConfig } from '../lib/stores.js';
import { Txt, ChipToggle, GradientButton } from '../components/brand.js';
import { RangeSlider } from '../components/RangeSlider.js';
import { goBack } from '../components/Header.js';

const LANGUAGES = ['English', 'Hindi', 'Telugu', 'Tamil', 'Bengali', 'Kannada', 'Malayalam', 'Marathi', 'Gujarati', 'Punjabi'];
const SPECIALTIES = [['Vedic', 'Vedic Astrology'], ['Numerology', 'Numerology'], ['Tarot', 'Tarot'], ['Vastu', 'Vastu'], ['KP System', 'KP Astrology'], ['Nadi', 'Nadi'], ['Palmistry', 'Palmistry'], ['Face Reading', 'Face Reading'], ['Prashna', 'Prashna Kundli'], ['Western', 'Western']];
const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function Section({ title, hint, children }) {
  return (
    <View style={{ gap: 12 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}><Txt w="m" size={17}>{title}</Txt>{hint ? <Txt size={13} color={c.text2}>{hint}</Txt> : null}</View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{children}</View>
    </View>
  );
}

export default function Filters() {
  const [saved, setSaved] = useFilters();
  const cfg = useAppConfig();
  const [f, setF] = useState(saved);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const count = activeFilterCount(f);
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 26, paddingBottom: 40 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Ionicons name="options-outline" size={20} color={c.primary} /><Txt w="s" size={18}>Filter Gurus</Txt></View>
          <Pressable onPress={() => setF({ ...EMPTY_FILTERS, q: f.q })} hitSlop={8} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Ionicons name="refresh" size={16} color={c.primary} /><Txt w="m" color={c.primary}>Reset</Txt>
          </Pressable>
        </View>
        <Section title="Language" hint="Select spoken">
          {LANGUAGES.map((l) => <ChipToggle key={l} label={l} active={f.languages.includes(l)} onPress={() => set({ languages: toggle(f.languages, l) })} />)}
        </Section>
        <Section title="Experience" hint="Years of practice">
          {['0-5', '5-10', '10-15', '15+'].map((e) => <ChipToggle key={e} label={`${e.replace('-', '–')} Yrs`} active={f.experience === e} onPress={() => set({ experience: f.experience === e ? null : e })} />)}
        </Section>
        <View style={{ backgroundColor: c.surface, borderRadius: 24, padding: 20, gap: 16, ...c.shadow }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt w="m" size={17}>Price (per min)</Txt><Txt w="s" size={16} color={c.pricePillText}>₹{f.priceMin} – ₹{f.priceMax}{f.priceMax === 50 ? '+' : ''}</Txt></View>
          <RangeSlider min={10} max={50} low={f.priceMin} high={f.priceMax} onChange={(lo, hi) => set({ priceMin: lo, priceMax: hi })} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Txt size={12.5} color={c.text2}>₹10/min</Txt><Txt size={12.5} color={c.text2}>₹30/min</Txt><Txt size={12.5} color={c.text2}>₹50+/min</Txt></View>
        </View>
        <Section title="Speciality" hint="Multiple allowed">
          {SPECIALTIES.map(([v, l]) => <ChipToggle key={v} label={l} active={f.specialties.includes(v)} onPress={() => set({ specialties: toggle(f.specialties, v) })} />)}
        </Section>
        <Section title="Consultation Mode" hint="Medium">
          <ChipToggle label="Chat" icon="chatbox-outline" active={f.mode === 'chat'} onPress={() => set({ mode: f.mode === 'chat' ? 'all' : 'chat' })} />
          {cfg.enabledModes.includes('voice') ? <ChipToggle label="Call" icon="call-outline" active={f.mode === 'voice'} onPress={() => set({ mode: f.mode === 'voice' ? 'all' : 'voice' })} /> : <ChipToggle label="Call · soon" icon="call-outline" active={false} onPress={() => {}} />}
        </Section>
        <GradientButton title={`Apply Filters${count ? `  (${count})` : ''}`} trailing="" onPress={() => { setSaved(f); goBack('/astrologers'); }} />
        <Txt w="m" size={15} style={{ textAlign: 'center' }} onPress={() => { setSaved({ ...EMPTY_FILTERS }); goBack('/astrologers'); }}>Clear All Filters</Txt>
      </ScrollView>
    </View>
  );
}
