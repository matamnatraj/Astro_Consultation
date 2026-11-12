import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ErrorBox } from '@astro/mobile-core';
import { astrovedas as c } from '../lib/theme.js';
import { F, Txt, Logo, GradientButton } from './brand.js';

const Input = (p) => (
  <TextInput placeholderTextColor={c.muted} {...p}
    style={[F.m, { backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, paddingHorizontal: 16, height: 54, fontSize: 16, color: c.text }]} />
);

export function BrandLogin({ api }) {
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
          <LinearGradient colors={c.banner} style={{ borderRadius: 28, padding: 28, alignItems: 'center', gap: 10, marginTop: 12 }}>
            <Logo size={72} />
            <Txt w="b" size={26} color="#fff" style={{ letterSpacing: 1.5 }}>ASTROVEDAS</Txt>
            <Txt size={14} color="rgba(255,255,255,0.85)" style={{ textAlign: 'center' }}>Talk to verified astrologers by chat or call — with your kundli always at hand.</Txt>
          </LinearGradient>
          <View style={{ gap: 14, marginTop: 8 }}>
            <Txt w="s" size={20}>{step === 'id' ? 'Login with your mobile' : 'Enter verification code'}</Txt>
            <ErrorBox error={err} />
            {step === 'id' ? (
              <>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, height: 54, justifyContent: 'center' }}><Txt w="m" size={16}>🇮🇳 +91</Txt></View>
                  <View style={{ flex: 1 }}><Input value={phone} onChangeText={setPhone} placeholder="Mobile number" keyboardType="phone-pad" autoComplete="tel" accessibilityLabel="Mobile number" autoFocus /></View>
                </View>
                <GradientButton title="Get OTP" onPress={request} loading={busy} disabled={phone.replace(/\D/g, '').length < 10} />
                <Txt size={12} color={c.muted} style={{ textAlign: 'center' }}>By continuing you agree to our Terms, Privacy Policy and Astrology Disclaimer.</Txt>
              </>
            ) : (
              <>
                <Txt size={14} color={c.text2}>Sent by SMS to {phone}.</Txt>
                {ch?.devCode ? <View style={{ backgroundColor: c.accentSoft, borderRadius: 12, padding: 10 }}><Txt size={13} color={c.pricePillText}>Development mode — code {ch.devCode} filled in.</Txt></View> : null}
                <Input value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} placeholder="6-digit code" keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" accessibilityLabel="One-time code" />
                {ch?.isNewAccount ? <Input value={name} onChangeText={setName} placeholder="Your name" autoComplete="name" accessibilityLabel="Your name" /> : null}
                <GradientButton title="Verify & Continue" onPress={verify} loading={busy} disabled={code.length !== 6 || (ch?.isNewAccount && !name.trim())} />
                <Txt w="m" size={14} color={c.primary} style={{ textAlign: 'center' }} onPress={() => setStep('id')}>Change number</Txt>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
