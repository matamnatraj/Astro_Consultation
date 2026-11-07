import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Button, Field, ErrorBox, Modal, Spinner } from './ui.jsx';
import { createRealtime, RealtimeContext } from './realtime.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ api, role, children }) {
  const [me, setMe] = useState(undefined);
  const realtime = useMemo(() => createRealtime(api), [api]);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      if (!api.tokens.get()) { setMe(null); return; }
      try {
        const m = await api.get('/me');
        if (!alive) return;
        if (m.user.role !== role) { await api.logout(); setMe(null); return; }
        setMe(m);
        realtime.connect();
      } catch { if (alive) setMe(null); }
    };
    load();
    const off = api.onSessionChange((s) => { if (!s) { realtime.disconnect(); setMe(null); } else load(); });
    return () => { alive = false; off(); realtime.disconnect(); };
  }, [api, role, realtime]);

  const value = useMemo(() => ({
    me, api, role,
    can: (perm) => me?.permissions?.includes('*') || me?.permissions?.includes(perm),
    logout: () => api.logout(),
  }), [me, api, role]);

  if (me === undefined) return <Spinner label="Loading…" />;
  return <AuthContext.Provider value={value}><RealtimeContext.Provider value={realtime}>{children}</RealtimeContext.Provider></AuthContext.Provider>;
}

/** OTP login used by all three apps. */
export function LoginScreen({ api, role, brand, tagline, identifierLabel = 'Mobile number or email', placeholder = '98765 43210', footer }) {
  const [step, setStep] = useState('id');
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const request = async (e) => {
    e?.preventDefault();
    setBusy(true); setError(null);
    try {
      const c = await api.post('/auth/otp/request', { identifier, role }, { retry: false });
      setChallenge(c); setStep('code'); setCode(c.devCode || '');
    } catch (err) { setError(err); } finally { setBusy(false); }
  };
  const verify = async (e) => {
    e.preventDefault();
    setBusy(true); setError(null);
    try {
      const s = await api.post('/auth/otp/verify', { challengeId: challenge.challengeId, code, displayName: name || undefined }, { retry: false });
      api.setSession({ accessToken: s.accessToken, refreshToken: s.refreshToken });
    } catch (err) { setError(err); } finally { setBusy(false); }
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="brand-lg">{brand}</div>
        <p className="muted">{tagline}</p>
        <ErrorBox error={error} />
        {step === 'id' ? (
          <form onSubmit={request} className="stack">
            <Field label={identifierLabel}>
              <input autoFocus required value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder={placeholder} autoComplete="username" />
            </Field>
            <Button type="submit" loading={busy}>Send one-time code</Button>
          </form>
        ) : (
          <form onSubmit={verify} className="stack">
            <p className="small">Enter the 6-digit code sent by {challenge.channel === 'email' ? 'email' : 'SMS'} to <strong>{identifier}</strong>.</p>
            {challenge.devCode && <div className="alert alert-info small">Development mode: code <strong>{challenge.devCode}</strong> pre-filled.</div>}
            <Field label="One-time code">
              <input autoFocus required inputMode="numeric" pattern="\d{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoComplete="one-time-code" />
            </Field>
            {challenge.isNewAccount && role !== 'admin' && (
              <Field label="Your name"><input required value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>
            )}
            <Button type="submit" loading={busy}>Verify & continue</Button>
            <div className="row between small">
              <button type="button" className="link" onClick={() => setStep('id')}>Change number</button>
              <button type="button" className="link" onClick={request} disabled={busy}>Resend code</button>
            </div>
          </form>
        )}
        {footer}
      </div>
    </div>
  );
}

/** Blocks the app until current required notices (terms, privacy, disclaimers) are accepted. Version + timestamp recorded server-side. */
export function ConsentGate({ children }) {
  const { api } = useAuth();
  const [pending, setPending] = useState(null);
  const [checked, setChecked] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => { api.get('/consents/pending').then(setPending).catch(setError); }, [api]);
  if (pending === null) return error ? <ErrorBox error={error} /> : <Spinner />;
  if (!pending.length) return children;
  const all = pending.every((p) => checked[p.noticeType]);
  const accept = async () => {
    setBusy(true);
    try {
      await api.post('/consents', { accept: pending.map((p) => ({ noticeType: p.noticeType, version: p.version })), context: 'app_gate' });
      setPending([]);
    } catch (e) { setError(e); } finally { setBusy(false); }
  };
  return (
    <Modal open title="Before you continue" footer={<Button disabled={!all} loading={busy} onClick={accept}>I agree</Button>}>
      <p className="muted small">Please review and accept the following notices. We record the version and time of your acceptance.</p>
      <ErrorBox error={error} />
      {pending.map((p) => (
        <details key={p.noticeType} className="notice">
          <summary><label className="check" onClick={(e) => e.stopPropagation()}>
            <input type="checkbox" checked={!!checked[p.noticeType]} onChange={(e) => setChecked({ ...checked, [p.noticeType]: e.target.checked })} />
            <span>I have read and accept the <strong>{p.title}</strong> (v{p.version})</span>
          </label></summary>
          <div className="notice-body">{p.body}</div>
        </details>
      ))}
    </Modal>
  );
}
