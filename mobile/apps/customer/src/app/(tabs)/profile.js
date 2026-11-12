import { Alert, Platform, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialCommunityIcons as MCI } from '@expo/vector-icons';
import { useAuth, rupees } from '@astro/mobile-core';
import { astrovedas as c } from '../../lib/theme.js';
import { useWallet, useAppConfig } from '../../lib/stores.js';
import { Txt, Logo } from '../../components/brand.js';
import { LANGS, useI18n } from '../../lib/i18n.js';
import { LanguagePicker } from '../../components/LanguagePicker.js';
import { useState } from 'react';

const Item = ({ icon, label, onPress, color = c.text, last, value }) => (
  <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, borderBottomWidth: last ? 0 : 1, borderColor: c.border, opacity: pressed ? 0.7 : 1 })}>
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F6EDE4', alignItems: 'center', justifyContent: 'center' }}><MCI name={icon} size={20} color={color === c.text ? c.primary : color} /></View>
    <Txt w="m" size={15.5} color={color} style={{ flex: 1 }}>{label}</Txt>
    {value ? <Txt size={13.5} color={c.text2}>{value}</Txt> : null}
    <Ionicons name="chevron-forward" size={18} color={c.muted} />
  </Pressable>
);

export default function Profile() {
  const { me, logout } = useAuth();
  const { t, lang } = useI18n();
  const [langOpen, setLangOpen] = useState(false);
  const cfg = useAppConfig();
  const [balance] = useWallet();
  const signOut = () => (Platform.OS === 'web' ? logout() : Alert.alert(t('profile.signOutConfirm'), '', [{ text: t('profile.cancel'), style: 'cancel' }, { text: t('profile.signOut'), style: 'destructive', onPress: logout }]));
  const phone = me.user.phone ? `${me.user.phone.slice(0, 6)}xxxx${me.user.phone.slice(-3)}` : me.user.email;
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 110 }}>
        <View style={{ backgroundColor: c.surface, borderRadius: 24, overflow: 'hidden', ...c.shadow }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18 }}>
            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: c.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Txt w="b" size={26} color={c.primary}>{(me.user.displayName || '?')[0]}</Txt></View>
            <View style={{ flex: 1 }}><Txt w="s" size={20}>{me.user.displayName || 'Your profile'}</Txt><Txt size={14} color={c.text2}>{phone}</Txt></View>
            <Pressable onPress={() => router.push('/account')} hitSlop={8} accessibilityRole="button" accessibilityLabel="Edit profile" style={{ width: 42, height: 42, borderRadius: 21, backgroundColor: '#F4ECE4', alignItems: 'center', justifyContent: 'center' }}><MCI name="square-edit-outline" size={21} color={c.text2} /></Pressable>
          </View>
          <View style={{ backgroundColor: '#FFF6E8', borderTopWidth: 1, borderColor: '#F6DDB0', padding: 16, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}><Txt size={14} color={c.text2}>{cfg.walletName}</Txt><Txt w="b" size={22}>{rupees(balance ?? 0)}</Txt></View>
            <Pressable onPress={() => router.push('/wallet')} accessibilityRole="button" style={{ backgroundColor: c.primary, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 9 }}><Txt w="s" color="#fff">{t('profile.recharge')}</Txt></Pressable>
          </View>
        </View>
        <View style={{ backgroundColor: c.surface, borderRadius: 22, paddingHorizontal: 16, ...c.shadow }}>
          <Item icon="history" label={t('profile.consultations')} onPress={() => router.push('/sessions')} />
          <Item icon="dharmachakra" label={t('profile.kundlis')} onPress={() => router.push('/kundli')} />
          <Item icon="heart-multiple-outline" label={t('kundli.matching')} onPress={() => router.push('/matching')} />
          <Item icon="heart-outline" label={t('profile.favorites')} onPress={() => router.push('/favorites')} />
          <Item icon="bell-outline" label={t('profile.notifications')} onPress={() => router.push('/notifications')} />
          <Item icon="translate" label={t('profile.language')} value={LANGS.find((l) => l.code === lang)?.native} onPress={() => setLangOpen(true)} last />
        </View>
        <View style={{ backgroundColor: c.surface, borderRadius: 22, paddingHorizontal: 16, ...c.shadow }}>
          <Item icon="headset" label={t('profile.support')} onPress={() => router.push('/support')} />
          <Item icon="robot-happy-outline" label={t('profile.assistant')} onPress={() => router.push('/assistant')} />
          <Item icon="shield-lock-outline" label={t('profile.account')} onPress={() => router.push('/account')} last />
        </View>
        <View style={{ backgroundColor: c.surface, borderRadius: 22, paddingHorizontal: 16, ...c.shadow }}>
          <Item icon="logout" label={t('profile.signOut')} color={c.bad} onPress={signOut} last />
        </View>
        <View style={{ alignItems: 'center', gap: 6, marginTop: 6 }}><Logo size={34} /><Txt size={12} color={c.muted}>Astrovedas · v1.0.0</Txt></View>
      </ScrollView>
      <LanguagePicker visible={langOpen} onClose={() => setLangOpen(false)} />
    </SafeAreaView>
  );
}
