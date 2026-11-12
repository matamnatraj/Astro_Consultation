import { useEffect, useState } from 'react';
import { Alert, Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth, useAsync, Screen, Card, T, Row, Button, Badge, Field, Chips, Chip, Notice, ErrorBox, Loading, ListItem, useToast, fmtDateTime, titleCase, useI18n, LANGS, LanguagePicker } from '@astro/mobile-core';

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
  const { t, lang } = useI18n();
  const [langOpen, setLangOpen] = useState(false);
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
  }), t('pf.saved'));
  const upload = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true });
    if (res.canceled) return;
    const file = res.assets[0];
    if (file.size && file.size > 5 * 1024 * 1024) { show(t('pf.tooBig'), 'bad'); return; }
    await run('upload', async () => api.post('/astrologer/me/documents', { docType, fileName: file.name, mimeType: file.mimeType || 'application/pdf', contentBase64: await fileToBase64(file.uri) }), t('pf.uploaded'));
  };
  const saveBank = () => run('bank', () => api.put('/astrologer/me/payout-details', { ...bank, ifsc: bank.ifsc.toUpperCase(), pan: bank.pan ? bank.pan.toUpperCase() : undefined }), t('pf.bankSaved'));
  const submit = () => run('submit', () => api.post('/astrologer/me/submit-verification'), t('pf.submitted'));
  const confirmLogout = () => (Platform.OS === 'web' ? logout() : Alert.alert(t('pf.signOutQ'), '', [{ text: t('common.cancel'), style: 'cancel' }, { text: t('pf.signOut'), style: 'destructive', onPress: logout }]));

  return (
    <>
      <Screen onRefresh={me.refresh} refreshing={me.refreshing}>
        <Card title={t('lang.title')}>
          <ListItem last title={LANGS.find((l) => l.code === lang)?.native} subtitle={LANGS.find((l) => l.code === lang)?.label} onPress={() => setLangOpen(true)} right={<T bold>›</T>} />
        </Card>
        <Row gap={8}><T bold>{t('pf.verification')}</T><Badge status={a.verificationStatus} /></Row>
        {a.verificationNotes ? <Notice tone={a.verificationStatus === 'rejected' ? 'bad' : 'info'}>{t('pf.reviewerNotes', { notes: a.verificationNotes })}</Notice> : null}
        <ErrorBox error={err} />
        <Card title={t('pf.public')}>
          <Field label={t('pf.displayName')} value={f.displayName} onChangeText={(v) => setF({ ...f, displayName: v })} />
          <Field label={t('pf.years')} value={f.experienceYears} onChangeText={(v) => setF({ ...f, experienceYears: v.replace(/\D/g, '') })} keyboardType="number-pad" />
          <Field label={t('pf.about')} hint={t('pf.aboutHint', { n: f.bio.length })} value={f.bio} onChangeText={(v) => setF({ ...f, bio: v })} multiline maxLength={2000} />
          <T small bold>{t('pf.languages')}</T>
          <Chips>{LANGUAGES.map((l) => <Chip key={l} label={l} active={f.languages.includes(l)} onPress={() => setF({ ...f, languages: toggle(f.languages, l) })} />)}</Chips>
          <T small bold>{t('pf.specialties')}</T>
          <Chips>{SPECIALTIES.map((l) => <Chip key={l} label={l} active={f.specialties.includes(l)} onPress={() => setF({ ...f, specialties: toggle(f.specialties, l) })} />)}</Chips>
          <Field label={t('pf.services')} value={f.services} onChangeText={(v) => setF({ ...f, services: v })} />
          <T small bold>{t('pf.modes')}</T>
          <Chips>{['chat', 'voice', 'video'].map((m) => <Chip key={m} label={t(`mode.${m}`)} active={f.modes.includes(m)} onPress={() => setF({ ...f, modes: toggle(f.modes, m) })} />)}</Chips>
          <Row>{f.modes.map((m) => <Field key={m} label={t(`mode.${m}`)} value={f[m]} onChangeText={(v) => setF({ ...f, [m]: v.replace(/[^\d.]/g, '') })} keyboardType="decimal-pad" style={{ flex: 1 }} />)}</Row>
          <T tiny muted>{t('pf.voiceNote')}</T>
          <Button title={t('pf.save')} loading={busy === 'profile'} onPress={saveProfile} />
        </Card>
        <Card title={t('pf.docs')}>
          {a.documents.length === 0 ? <T small muted>{t('pf.noDocs')}</T> : a.documents.map((d, i) => (
            <ListItem key={d.document_id} last={i === a.documents.length - 1} title={({ government_id: t('pf.govId'), address_proof: t('pf.address'), certification: t('pf.cert'), photo: t('pf.photo') })[d.doc_type] || titleCase(d.doc_type)} subtitle={`${d.file_name} · ${fmtDateTime(d.uploaded_at)}`} right={<Badge status={d.status === 'accepted' ? 'approved' : d.status} />} />
          ))}
          <Chips>{[['government_id', t('pf.govId')], ['address_proof', t('pf.address')], ['certification', t('pf.cert')], ['photo', t('pf.photo')]].map(([v, l]) => <Chip key={v} label={l} active={docType === v} onPress={() => setDocType(v)} />)}</Chips>
          <Button variant="secondary" title={t('pf.upload')} loading={busy === 'upload'} onPress={upload} />
          <T tiny muted>{t('pf.uploadNote')}</T>
        </Card>
        <Card title={t('pf.bank')}>
          {a.payoutDetails ? <T small>{t('pf.onFile')} {a.payoutDetails.accountHolder} · {a.payoutDetails.accountNumber} · {a.payoutDetails.ifsc}</T> : null}
          <Field label={t('pf.holder')} value={bank.accountHolder} onChangeText={(v) => setBank({ ...bank, accountHolder: v })} />
          <Field label={t('pf.accNo')} value={bank.accountNumber} onChangeText={(v) => setBank({ ...bank, accountNumber: v.replace(/\D/g, '') })} keyboardType="number-pad" />
          <Field label={t('pf.ifsc')} value={bank.ifsc} onChangeText={(v) => setBank({ ...bank, ifsc: v })} autoCapitalize="characters" />
          <Field label={t('pf.pan')} value={bank.pan} onChangeText={(v) => setBank({ ...bank, pan: v })} autoCapitalize="characters" />
          <Button variant="secondary" title={t('pf.saveBank')} loading={busy === 'bank'} disabled={!bank.accountHolder || !bank.accountNumber || !bank.ifsc} onPress={saveBank} />
        </Card>
        {['draft', 'rejected'].includes(a.verificationStatus) ? (
          <Card title={t('pf.submit')}>
            <T small muted>{t('pf.submitNote')}</T>
            <Button title={t('pf.submit')} loading={busy === 'submit'} onPress={submit} />
          </Card>
        ) : null}
        <Button variant="secondary" title={t('pf.signOut')} onPress={confirmLogout} />
      </Screen>
      <LanguagePicker visible={langOpen} onClose={() => setLangOpen(false)} />
      {toast}
    </>
  );
}
