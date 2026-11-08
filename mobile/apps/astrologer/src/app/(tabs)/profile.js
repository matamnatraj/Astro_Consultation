import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth, useAsync, Screen, Card, T, Row, Button, Badge, Field, Chips, Chip, Notice, ErrorBox, Loading, ListItem, useToast, fmtDateTime, titleCase } from '@astro/mobile-core';

const SPECIALTIES = ['Vedic', 'Western', 'KP System', 'Nadi', 'Career', 'Marriage', 'Relationships', 'Finance', 'Business', 'Health', 'Education', 'Kundli Matching', 'Muhurta', 'Nakshatra', 'Remedies', 'Tarot', 'Numerology', 'Vastu', 'Family', 'Property'];
const LANGUAGES = ['English', 'Hindi', 'Bengali', 'Marathi', 'Telugu', 'Tamil', 'Gujarati', 'Kannada', 'Malayalam', 'Punjabi', 'Odia', 'Sanskrit'];
const toggle = (list, v) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

async function fileToBase64(uri) {
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1]);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}

export default function Profile() {
  const { api, logout } = useAuth();
  const me = useAsync(() => api.get('/astrologer/me'), []);
  const [f, setF] = useState(null);
  const [bank, setBank] = useState({ accountHolder: '', accountNumber: '', ifsc: '', pan: '' });
  const [docType, setDocType] = useState('government_id');
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState(null);
  const [toast, show] = useToast();
  useEffect(() => {
    const a = me.data;
    if (a && !f) {
      setF({ displayName: a.displayName, bio: a.bio, experienceYears: String(a.experienceYears), languages: a.languages, specialties: a.specialties, services: a.services.join(', '), modes: a.modes, chat: String(a.rates.chat / 100), voice: String(a.rates.voice / 100), video: String(a.rates.video / 100) });
      setBank((b) => ({ ...b, accountHolder: a.payoutDetails?.accountHolder || '', ifsc: a.payoutDetails?.ifsc || '' }));
    }
  }, [me.data, f]);
  if (me.loading || !f) return <Loading />;
  const a = me.data;

  const run = async (name, fn, okMsg) => {
    setBusy(name); setErr(null);
    try { await fn(); if (okMsg) show(okMsg); me.reload(); } catch (e) { setErr(e); } finally { setBusy(null); }
  };
  const saveProfile = () => run('profile', () => api.put('/astrologer/me', {
    displayName: f.displayName, bio: f.bio, experienceYears: Number(f.experienceYears) || 0, languages: f.languages, specialties: f.specialties,
    services: f.services.split(',').map((s) => s.trim()).filter(Boolean), modes: f.modes,
    rates: { chat: Math.round(Number(f.chat) * 100), voice: Math.round(Number(f.voice || 0) * 100), video: Math.round(Number(f.video || 0) * 100) },
  }), 'Profile saved');
  const upload = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true });
    if (res.canceled) return;
    const file = res.assets[0];
    if (file.size && file.size > 5 * 1024 * 1024) { show('File must be 5 MB or smaller', 'bad'); return; }
    await run('upload', async () => api.post('/astrologer/me/documents', { docType, fileName: file.name, mimeType: file.mimeType || 'application/pdf', contentBase64: await fileToBase64(file.uri) }), 'Document uploaded (encrypted at rest)');
  };
  const saveBank = () => run('bank', () => api.put('/astrologer/me/payout-details', { ...bank, ifsc: bank.ifsc.toUpperCase(), pan: bank.pan ? bank.pan.toUpperCase() : undefined }), 'Bank details saved');
  const submit = () => run('submit', () => api.post('/astrologer/me/submit-verification'), 'Submitted for verification');
  const confirmLogout = () => (Platform.OS === 'web' ? logout() : Alert.alert('Sign out?', '', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: logout }]));

  return (
    <>
      <Screen onRefresh={me.refresh} refreshing={me.refreshing}>
        <Row gap={8}><T bold>Verification</T><Badge status={a.verificationStatus} /></Row>
        {a.verificationNotes ? <Notice tone={a.verificationStatus === 'rejected' ? 'bad' : 'info'}>{`Reviewer notes: ${a.verificationNotes}`}</Notice> : null}
        <ErrorBox error={err} />
        <Card title="Public profile">
          <Field label="Display name" value={f.displayName} onChangeText={(v) => setF({ ...f, displayName: v })} />
          <Field label="Years of experience" value={f.experienceYears} onChangeText={(v) => setF({ ...f, experienceYears: v.replace(/\D/g, '') })} keyboardType="number-pad" />
          <Field label="About you" hint={`${f.bio.length}/2000 · at least 50 characters`} value={f.bio} onChangeText={(v) => setF({ ...f, bio: v })} multiline maxLength={2000} />
          <T small bold>Languages</T>
          <Chips>{LANGUAGES.map((l) => <Chip key={l} label={l} active={f.languages.includes(l)} onPress={() => setF({ ...f, languages: toggle(f.languages, l) })} />)}</Chips>
          <T small bold>Specialties</T>
          <Chips>{SPECIALTIES.map((l) => <Chip key={l} label={l} active={f.specialties.includes(l)} onPress={() => setF({ ...f, specialties: toggle(f.specialties, l) })} />)}</Chips>
          <Field label="Services (comma-separated)" value={f.services} onChangeText={(v) => setF({ ...f, services: v })} />
          <T small bold>Consultation modes & rates (₹/min)</T>
          <Chips>{['chat', 'voice', 'video'].map((m) => <Chip key={m} label={titleCase(m)} active={f.modes.includes(m)} onPress={() => setF({ ...f, modes: toggle(f.modes, m) })} />)}</Chips>
          <Row>{f.modes.map((m) => <Field key={m} label={titleCase(m)} value={f[m]} onChangeText={(v) => setF({ ...f, [m]: v.replace(/[^\d.]/g, '') })} keyboardType="decimal-pad" style={{ flex: 1 }} />)}</Row>
          <T tiny muted>Chat is enabled at launch; voice and video become bookable once the platform enables them.</T>
          <Button title="Save profile" loading={busy === 'profile'} onPress={saveProfile} />
        </Card>
        <Card title="Verification documents">
          {a.documents.length === 0 ? <T small muted>No documents yet. A government ID is required.</T> : a.documents.map((d, i) => (
            <ListItem key={d.document_id} last={i === a.documents.length - 1} title={titleCase(d.doc_type)} subtitle={`${d.file_name} · ${fmtDateTime(d.uploaded_at)}`} right={<Badge status={d.status === 'accepted' ? 'approved' : d.status} />} />
          ))}
          <Chips>{[['government_id', 'Government ID'], ['address_proof', 'Address proof'], ['certification', 'Certification'], ['photo', 'Photo']].map(([v, l]) => <Chip key={v} label={l} active={docType === v} onPress={() => setDocType(v)} />)}</Chips>
          <Button variant="secondary" title="Upload PDF or photo" loading={busy === 'upload'} onPress={upload} />
          <T tiny muted>Up to 5 MB. Visible only to the verification team.</T>
        </Card>
        <Card title="Payout bank account">
          {a.payoutDetails ? <T small>On file: {a.payoutDetails.accountHolder} · {a.payoutDetails.accountNumber} · {a.payoutDetails.ifsc}</T> : null}
          <Field label="Account holder" value={bank.accountHolder} onChangeText={(v) => setBank({ ...bank, accountHolder: v })} />
          <Field label="Account number" value={bank.accountNumber} onChangeText={(v) => setBank({ ...bank, accountNumber: v.replace(/\D/g, '') })} keyboardType="number-pad" />
          <Field label="IFSC" value={bank.ifsc} onChangeText={(v) => setBank({ ...bank, ifsc: v })} autoCapitalize="characters" />
          <Field label="PAN (optional)" value={bank.pan} onChangeText={(v) => setBank({ ...bank, pan: v })} autoCapitalize="characters" />
          <Button variant="secondary" title="Save bank details" loading={busy === 'bank'} disabled={!bank.accountHolder || !bank.accountNumber || !bank.ifsc} onPress={saveBank} />
        </Card>
        {['draft', 'rejected'].includes(a.verificationStatus) ? (
          <Card title="Submit for verification">
            <T small muted>Our team reviews your profile and documents before you become bookable.</T>
            <Button title="Submit for verification" loading={busy === 'submit'} onPress={submit} />
          </Card>
        ) : null}
        <Button variant="secondary" title="Sign out" onPress={confirmLogout} />
      </Screen>
      {toast}
    </>
  );
}
