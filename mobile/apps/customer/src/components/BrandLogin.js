import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ErrorBox } from '@astro/mobile-core';
import { astrovedas as c } from '../lib/theme.js';
import { fontFor, Txt, Logo, GradientButton } from './brand.js';
import { useT } from '../lib/i18n.js';
import { LanguageButton } from './LanguagePicker.js';

const Input = (p) => (
  <TextInput placeholderTextColor={c.muted} {...p}
    style={[fontFor('m', p.value || p.placeholder), { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, paddingHorizontal: 16, height: 54, fontSize: 16, color: c.text }]} />
);

export function BrandLogin({ api }) {
  const t = useT();
  const [step, setStep] = useState('id');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [ch, setCh] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const request = async () => {
    setBusy(true); setErr(null);
    try { const r = await api.post('/auth/otp/request', { identifier: phone, role: 'customer' }, { retry: false }); setCh(r); setCode(r.devCode || ''); setStep('code'); } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true); setErr(null);
    try { const s = await api.post('/auth/otp/verify', { challengeId: ch.challengeId, code, displayName: name || undefined }, { retry: false }); await api.setSession({ accessToken: s.accessToken, refreshToken: s.refreshToken }); } catch (e) { setErr(e); setBusy(false); }
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
          <LanguageButton style={{ alignSelf: 'flex-end' }} />
          <LinearGradient colors={c.banner} style={{ borderRadius: 28, padding: 28, alignItems: 'center', gap: 10, marginTop: 0 }}>
            <Logo size={72} />
            <Txt w="b" size={26} color="#fff" style={{ letterSpacing: 1.5 }}>ASTROVEDAS</Txt>
            <Txt size={14} color="rgba(255,255,255,0.85)" style={{ textAlign: 'center' }}>{t('login.tagline')}</Txt>
          </LinearGradient>
          <View style={{ gap: 14, marginTop: 8 }}>
            <Txt w="s" size={20}>{step === 'id' ? t('login.title') : t('login.enterCode')}</Txt>
            <ErrorBox error={err} />
            {step === 'id' ? (
              <>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, height: 54, justifyContent: 'center' }}><Txt w="m" size={16}>🇮🇳 +91</Txt></View>
                  <View style={{ flex: 1 }}><Input value={phone} onChangeText={setPhone} placeholder={t('login.mobile')} keyboardType="phone-pad" autoComplete="tel" accessibilityLabel="Mobile number" autoFocus /></View>
                </View>
                <GradientButton title={t('login.getOtp')} onPress={request} loading={busy} disabled={phone.replace(/\D/g, '').length < 10} />
                <Txt size={12} color={c.muted} style={{ textAlign: 'center' }}>{t('login.terms')}</Txt>
              </>
            ) : (
              <>
                <Txt size={14} color={c.text2}>{t('login.sentTo', { phone })}</Txt>
                {ch?.devCode ? <View style={{ backgroundColor: c.accentSoft, borderRadius: 12, padding: 10 }}><Txt size={13} color={c.pricePillText}>Development mode — code {ch.devCode} filled in.</Txt></View> : null}
                <Input value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} placeholder={t('login.code')} keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" accessibilityLabel="One-time code" />
                {ch?.isNewAccount ? <Input value={name} onChangeText={setName} placeholder={t('login.name')} autoComplete="name" accessibilityLabel="Your name" /> : null}
                <GradientButton title={t('login.verify')} onPress={verify} loading={busy} disabled={code.length !== 6 || (ch?.isNewAccount && !name.trim())} />
                <Txt w="m" size={14} color={c.primary} style={{ textAlign: 'center' }} onPress={() => setStep('id')}>{t('login.change')}</Txt>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
