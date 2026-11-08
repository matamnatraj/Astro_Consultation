import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { createRealtime, RealtimeContext } from './realtime.js';
import { useTheme } from './theme.js';
import { T, H1, Button, Field, ErrorBox, Loading, Notice, Check, Screen } from './ui.js';
import { registerForPush } from './push.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

/** Holds the signed-in user, the realtime connection and push registration for one app. */
export function AuthProvider({ api, role, app, children }) {
  const [me, setMe] = useState(undefined);
  const [attempt, setAttempt] = useState(0);
  const realtime = useMemo(() => createRealtime(api), [api]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!(await api.hasSession())) { if (alive) setMe(null); return; }
      try {
        const m = await api.get('/me');
        if (!alive) return;
        if (m.user.role !== role) { await api.logout(); setMe(null); return; }
        setMe(m);
        realtime.connect();
        registerForPush(api, app).catch(() => {});
      } catch (e) {
        if (alive) setMe(e.status === 0 ? { offline: true } : null);
      }
    };
    load();
    const off = api.onSessionChange((s) => { if (!s) { realtime.disconnect(); setMe(null); } else load(); });
    return () => { alive = false; off(); realtime.disconnect(); };
  }, [api, role, app, realtime, attempt]);

  const value = useMemo(() => ({ me, api, role, logout: () => api.logout(), reloadMe: async () => setMe(await api.get('/me')) }), [me, api, role]);
  if (me === undefined) return <Loading label="Loading…" />;
  if (me?.offline) {
    return (
      <Screen>
        <Notice tone="warn">Cannot reach the server. Check your internet connection and try again.</Notice>
        <Button title="Retry" onPress={() => { setMe(undefined); setAttempt((a) => a + 1); }} />
      </Screen>
    );
  }
  return <AuthContext.Provider value={value}><RealtimeContext.Provider value={realtime}>{children}</RealtimeContext.Provider></AuthContext.Provider>;
}

/** OTP sign-in screen shared by both mobile apps. */
export function LoginScreen({ api, role, title, tagline }) {
  const c = useTheme();
  const [step, setStep] = useState('id');
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const request = async () => {
    setBusy(true); setError(null);
    try {
      const ch = await api.post('/auth/otp/request', { identifier, role }, { retry: false });
      setChallenge(ch); setCode(ch.devCode || ''); setStep('code');
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  const verify = async () => {
    setBusy(true); setError(null);
    try {
      const s = await api.post('/auth/otp/verify', { challengeId: challenge.challengeId, code, displayName: name || undefined }, { retry: false });
      await api.setSession({ accessToken: s.accessToken, refreshToken: s.refreshToken });
    } catch (e) { setError(e); setBusy(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}><T size={32} color="#fff">✦</T></View>
          <H1 center>{title}</H1>
          <T muted center>{tagline}</T>
        </View>
        <ErrorBox error={error} />
        {step === 'id' ? (
          <>
            <Field label="Mobile number" placeholder="98765 43210" value={identifier} onChangeText={setIdentifier} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" autoFocus />
            <Button title="Send one-time code" size="lg" loading={busy} disabled={identifier.trim().length < 6} onPress={request} />
          </>
        ) : (
          <>
            <T small>Enter the 6-digit code sent by SMS to <T small bold>{identifier}</T>.</T>
            {challenge.devCode ? <Notice tone="info">{`Development mode: code ${challenge.devCode} filled in.`}</Notice> : null}
            <Field label="One-time code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" autoComplete="sms-otp" textContentType="oneTimeCode" autoFocus />
            {challenge.isNewAccount ? <Field label="Your name" value={name} onChangeText={setName} autoComplete="name" textContentType="name" /> : null}
            <Button title="Verify & continue" size="lg" loading={busy} disabled={code.length !== 6 || (challenge.isNewAccount && !name.trim())} onPress={verify} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Button variant="ghost" size="sm" title="Change number" onPress={() => setStep('id')} />
              <Button variant="ghost" size="sm" title="Resend code" onPress={request} disabled={busy} />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** Blocks the app until the current required notices are accepted (version + time recorded server-side). */
export function ConsentGate({ children }) {
  const { api } = useAuth();
  const c = useTheme();
  const [pending, setPending] = useState(null);
  const [checked, setChecked] = useState({});
  const [open, setOpen] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { api.get('/consents/pending').then(setPending).catch(setError); }, [api]);
  if (pending === null) return error ? <Screen><ErrorBox error={error} /></Screen> : <Loading />;
  if (!pending.length) return children;
  const accept = async () => {
    setBusy(true);
    try { await api.post('/consents', { accept: pending.map((p) => ({ noticeType: p.noticeType, version: p.version })), context: 'mobile_app_gate' }); setPending([]); } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Screen edges={['top', 'bottom']} footer={<View style={{ padding: 16 }}><Button title="I agree" size="lg" disabled={!pending.every((p) => checked[p.noticeType])} loading={busy} onPress={accept} /></View>}>
      <H1>Before you continue</H1>
      <T muted small>Please review and accept these notices. We record the version and time of your acceptance.</T>
      <ErrorBox error={error} />
      {pending.map((p) => (
        <View key={p.noticeType} style={{ backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border, padding: 14, gap: 10 }}>
          <Check checked={!!checked[p.noticeType]} onChange={(v) => setChecked({ ...checked, [p.noticeType]: v })} label={<T small>I have read and accept the <T small bold>{p.title}</T> (v{p.version})</T>} />
          <Button variant="ghost" size="sm" title={open[p.noticeType] ? 'Hide text' : 'Read'} onPress={() => setOpen({ ...open, [p.noticeType]: !open[p.noticeType] })} style={{ alignSelf: 'flex-start' }} />
          {open[p.noticeType] ? <T small muted>{p.body}</T> : null}
        </View>
      ))}
    </Screen>
  );
}
