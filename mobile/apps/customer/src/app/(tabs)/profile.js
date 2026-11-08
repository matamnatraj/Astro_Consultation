import { useEffect, useState } from 'react';
import { Share, Alert, Platform, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth, useAsync, Screen, Card, T, Row, Button, Badge, Field, Chips, Chip, Loading, ErrorBox, Sheet, useToast, useTheme, fmtDate, fmtDateTime, titleCase } from '@astro/mobile-core';

export default function Profile() {
  const { api, logout } = useAuth();
  const c = useTheme();
  const profile = useAsync(() => api.get('/clients/me'), []);
  const births = useAsync(() => api.get('/clients/me/birth-profiles'), []);
  const consents = useAsync(() => api.get('/consents'), []);
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [showConsents, setShowConsents] = useState(false);
  const [toast, show] = useToast();
  useEffect(() => {
    if (profile.data && !form) setForm({ fullName: profile.data.fullName || '', gender: profile.data.gender || '', contactEmail: profile.data.contactEmail || '', preferredLanguage: profile.data.preferredLanguage || 'en', notificationPrefs: profile.data.notificationPrefs });
  }, [profile.data, form]);

  const save = async () => {
    setBusy(true); setErr(null);
    try { await api.put('/clients/me', { ...form, gender: form.gender || null, contactEmail: form.contactEmail || null }); show('Profile saved'); } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const exportData = async () => {
    try {
      const data = await api.get('/clients/me/export');
      await Share.share({ title: 'My data', message: JSON.stringify(data, null, 2) });
    } catch (e) { show(e.message, 'bad'); }
  };
  const confirmLogout = () => (Platform.OS === 'web' ? logout() : Alert.alert('Sign out?', '', [{ text: 'Cancel', style: 'cancel' }, { text: 'Sign out', style: 'destructive', onPress: logout }]));

  if (!form) return <Loading />;
  return (
    <>
      <Screen onRefresh={() => { profile.refresh(); births.refresh(); }} refreshing={births.refreshing}>
        <Card title="Birth profiles" right={<Button size="sm" title="+ Add" onPress={() => router.push('/birth-profile/new')} />}>
          {births.loading ? <Loading /> : !births.data.length ? <T small muted>No birth details yet. Add yours and your family's to get charts.</T> : births.data.map((b, i) => (
            <View key={b.birthProfileId} style={{ gap: 6, paddingVertical: 10, borderBottomWidth: i === births.data.length - 1 ? 0 : 1, borderColor: c.border }}>
              <Row gap={6} wrap><T bold>{b.fullName}</T><Badge tone="muted" label={b.label} />{b.isPrimary ? <Badge tone="info" label="Primary" /> : null}
                {b.latestChart ? <Badge status={b.latestChart.status} label={b.latestChart.status === 'stale' ? 'Chart outdated' : 'Chart ready'} /> : <Badge tone="muted" label="No chart" />}</Row>
              <T small muted>{`${fmtDate(b.birthDate)} · ${b.birthTime ? b.birthTime.slice(0, 5) : 'time unknown'}${b.timeAccuracy === 'approximate' ? ' (approx.)' : ''} · ${b.placeName}`}</T>
              <Row gap={8}>
                <Button size="sm" variant="secondary" title="View chart" onPress={() => router.push(`/chart/${b.birthProfileId}`)} />
                <Button size="sm" variant="ghost" title="Edit" onPress={() => router.push(`/birth-profile/${b.birthProfileId}`)} />
              </Row>
            </View>
          ))}
        </Card>
        <Card title="Personal details">
          <ErrorBox error={err} />
          <Field label="Full name" value={form.fullName} onChangeText={(v) => setForm({ ...form, fullName: v })} autoComplete="name" />
          <T small bold>Gender</T>
          <Chips>{[['', 'Prefer not to say'], ['female', 'Female'], ['male', 'Male'], ['non_binary', 'Non-binary']].map(([v, l]) => <Chip key={v} label={l} active={form.gender === v} onPress={() => setForm({ ...form, gender: v })} />)}</Chips>
          <Field label="Email (for receipts)" value={form.contactEmail} onChangeText={(v) => setForm({ ...form, contactEmail: v })} keyboardType="email-address" autoCapitalize="none" />
          <T small bold>Preferred language</T>
          <Chips>{[['en', 'English'], ['hi', 'हिन्दी'], ['ta', 'தமிழ்'], ['te', 'తెలుగు'], ['mr', 'मराठी'], ['bn', 'বাংলা']].map(([v, l]) => <Chip key={v} label={l} active={form.preferredLanguage === v} onPress={() => setForm({ ...form, preferredLanguage: v })} />)}</Chips>
          <T small bold>Notify me by</T>
          <Chips>{['push', 'email', 'sms'].map((ch) => <Chip key={ch} label={ch.toUpperCase()} active={!!form.notificationPrefs?.[ch]} onPress={() => setForm({ ...form, notificationPrefs: { ...form.notificationPrefs, [ch]: !form.notificationPrefs?.[ch] } })} />)}</Chips>
          <Button title="Save" loading={busy} disabled={!form.fullName.trim()} onPress={save} />
        </Card>
        <Card title="Privacy & data">
          <T small muted>Your birth details are shown only to the astrologer of an accepted consultation, and every access is logged. Notification previews never include birth details or messages.</T>
          <Button variant="secondary" title="Export my data" onPress={exportData} />
          <Button variant="ghost" title={showConsents ? 'Hide accepted notices' : 'Notices you have accepted'} onPress={() => setShowConsents(!showConsents)} />
          {showConsents ? consents.data?.map((x, i) => <T key={i} tiny muted>{titleCase(x.notice_type)} v{x.notice_version} · {x.context} · {fmtDateTime(x.accepted_at)}</T>) : null}
          <Button variant="ghost" title="Request account deletion" onPress={() => setDeleteOpen(true)} />
        </Card>
        <Button variant="secondary" title="Sign out" onPress={confirmLogout} />
      </Screen>
      <DeleteSheet visible={deleteOpen} onClose={() => setDeleteOpen(false)} onDone={(n) => { setDeleteOpen(false); show(`Deletion request #${n} submitted`); }} />
      {toast}
    </>
  );
}

function DeleteSheet({ visible, onClose, onDone }) {
  const { api } = useAuth();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <Sheet visible={visible} onClose={onClose} title="Request account deletion"
      footer={<Button variant="danger" title="Submit request" loading={busy} onPress={async () => { setBusy(true); try { const r = await api.post('/clients/me/deletion-request', { reason: reason || undefined }); onDone(r.ticketNumber); } finally { setBusy(false); } }} />}>
      <T small>Our team processes requests within 72 hours. Payment and tax records are kept for the legal period; everything else is deleted or anonymised.</T>
      <Field label="Reason (optional)" value={reason} onChangeText={setReason} multiline />
    </Sheet>
  );
}
