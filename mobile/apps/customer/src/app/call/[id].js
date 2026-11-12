import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons as MCI } from '@expo/vector-icons';
import { useAuth, useConsultation, Loading, mmss, rupees } from '@astro/mobile-core';
import { astrovedas as c } from '../../lib/theme.js';
import { useWallet } from '../../lib/stores.js';
import { Txt, AstroAvatar } from '../../components/brand.js';
import { goBack } from '../../components/Header.js';

/**
 * Audio-call screen (Figma). Session state, timer and billing come from the same consultation
 * record as chat. The audio stream itself needs an RTC provider (Agora / 100ms / Twilio) wired in
 * behind `ENABLED_MODES=voice` — until then this screen is not reachable from the app.
 */
function Wave({ active }) {
  const bars = useRef([0, 1, 2, 3, 4, 5, 6, 7].map(() => new Animated.Value(0.4))).current;
  useEffect(() => {
    if (!active) return undefined;
    const loops = bars.map((v, i) => Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 300 + i * 60, useNativeDriver: false }),
      Animated.timing(v, { toValue: 0.3, duration: 300 + i * 60, useNativeDriver: false }),
    ])));
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active, bars]);
  const colors = ['#F59E2B', '#E8711A', '#2563EB', '#E8711A', '#fff', '#2563EB', '#E8711A', '#F59E2B'];
  return <View style={{ flexDirection: 'row', gap: 4, height: 30, alignItems: 'center' }}>{bars.map((v, i) => <Animated.View key={i} style={{ width: 4, borderRadius: 2, backgroundColor: colors[i], height: v.interpolate({ inputRange: [0, 1], outputRange: [6, 30] }) }} />)}</View>;
}

const RoundButton = ({ icon, label, active, onPress }) => (
  <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: active }} style={{ alignItems: 'center', gap: 8 }}>
    <View style={{ width: 68, height: 68, borderRadius: 34, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.7)', backgroundColor: active ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon} size={28} color="#fff" />
    </View>
    <Txt size={14} color="rgba(255,255,255,0.9)">{label}</Txt>
  </Pressable>
);

export default function CallScreen() {
  const { id } = useLocalSearchParams();
  const { api } = useAuth();
  const s = useConsultation(id);
  const [balance, refreshWallet] = useWallet();
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const k = s.consultation;
  if (!k) return <Loading />;
  const live = k.status === 'in_progress';
  const end = async () => { if (live) { s.setConsultation(await api.post(`/consultations/${id}/end`)); refreshWallet(); } goBack(`/consultation/${id}`); };
  return (
    <LinearGradient colors={['#FFF7F0', '#FBC9A0', '#F28C3A']} locations={[0, 0.45, 1]} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, alignItems: 'center', paddingHorizontal: 24 }}>
        <View style={{ alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 }}>
          <Pressable onPress={() => goBack(`/consultation/${id}`)} hitSlop={12} accessibilityLabel="Minimise"><Ionicons name="chevron-down" size={28} color={c.text} /></Pressable>
          <Ionicons name="ellipsis-vertical" size={22} color={c.text} />
        </View>
        <View style={{ marginTop: 40, padding: 10, borderRadius: 200, backgroundColor: 'rgba(255,255,255,0.4)' }}><AstroAvatar name={k.astrologer.name} size={170} /></View>
        <Txt w="s" size={30} color="#fff" style={{ marginTop: 24, textShadowColor: 'rgba(0,0,0,0.12)', textShadowRadius: 6 }}>{k.astrologer.name}</Txt>
        <Txt size={16} color="rgba(255,255,255,0.9)">{live ? 'On call' : k.status === 'completed' ? 'Call ended' : 'Connecting…'}</Txt>
        <Txt w="b" size={42} color="#fff" style={{ marginTop: 14, letterSpacing: 4, fontVariant: ['tabular-nums'] }}>{mmss(s.timer?.elapsed || 0)}</Txt>
        <Wave active={live && !muted} />
        <View style={{ alignSelf: 'stretch', marginTop: 28, backgroundColor: 'rgba(80,45,25,0.78)', borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: 'rgba(249,178,51,0.25)', borderWidth: 1, borderColor: c.gold, alignItems: 'center', justifyContent: 'center' }}><MCI name="wallet" size={24} color={c.gold} /></View>
          <View style={{ flex: 1 }}><Txt size={12} color="rgba(255,255,255,0.75)" style={{ letterSpacing: 1 }}>WALLET BALANCE</Txt><Txt w="s" size={20} color="#fff">{rupees(balance ?? 0)}</Txt></View>
          <View style={{ alignItems: 'flex-end' }}><Txt size={12} color="rgba(255,255,255,0.75)" style={{ letterSpacing: 1 }}>RATE</Txt><Txt w="s" size={20} color="#fff">{rupees(k.ratePaise)}<Txt size={13} color="#fff">/min</Txt></Txt></View>
        </View>
        <View style={{ flexDirection: 'row', gap: 70, marginTop: 30 }}>
          <RoundButton icon={muted ? 'mic-off' : 'mic'} label="Mute" active={muted} onPress={() => setMuted(!muted)} />
          <RoundButton icon={speaker ? 'volume-high' : 'volume-medium'} label="Speaker" active={speaker} onPress={() => setSpeaker(!speaker)} />
        </View>
        <Pressable onPress={end} accessibilityRole="button" accessibilityLabel="End call" style={{ marginTop: 34, width: 86, height: 86, borderRadius: 43, backgroundColor: '#E53935', alignItems: 'center', justifyContent: 'center', ...c.shadow, shadowColor: '#E53935', shadowOpacity: 0.4 }}>
          <MCI name="phone-hangup" size={38} color="#fff" />
        </Pressable>
      </SafeAreaView>
    </LinearGradient>
  );
}
