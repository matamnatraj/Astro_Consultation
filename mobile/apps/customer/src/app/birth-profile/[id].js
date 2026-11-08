import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth, Screen, Card, T, Row, Button, Field, Chips, Chip, Notice, ErrorBox, Loading, Check, useTheme } from '@astro/mobile-core';

const TIMEZONES = ['Asia/Kolkata', 'Asia/Kathmandu', 'Asia/Colombo', 'Asia/Dhaka', 'Asia/Karachi', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'America/Toronto', 'Australia/Sydney', 'Australia/Melbourne'];
const pad2 = (n) => String(n).padStart(2, '0');
// Return to the previous screen, or to Profile when opened directly (deep link / cold start).
const done = () => (router.canGoBack() ? router.back() : router.replace('/profile'));

export default function BirthProfileForm() {
  const { id } = useLocalSearchParams();
  const isNew = id === 'new';
  const { api } = useAuth();
  const c = useTheme();
  const [initial, setInitial] = useState(null);
  const [f, setF] = useState(isNew ? { label: 'Self', fullName: '', gender: '', day: '', month: '', year: '', hour: '', minute: '', timeAccuracy: 'exact', timeSource: '', placeName: '', latitude: '', longitude: '', tzName: 'Asia/Kolkata', placeConfirmed: false, isPrimary: false } : null);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [manual, setManual] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    if (isNew) return;
    api.get(`/clients/me/birth-profiles/${id}`).then((b) => {
      setInitial(b);
      const [year, month, day] = b.birthDate.split('-');
      const [hour = '', minute = ''] = (b.birthTime || '').split(':');
      setF({ label: b.label, fullName: b.fullName, gender: b.gender || '', day, month, year, hour, minute, timeAccuracy: b.timeAccuracy, timeSource: b.timeSource || '', placeName: b.placeName, latitude: String(b.latitude), longitude: String(b.longitude), tzName: b.tzName, placeConfirmed: b.placeConfirmed, isPrimary: b.isPrimary });
    }).catch(setErr);
  }, [api, id, isNew]);
  useEffect(() => {
    if (q.length < 2) { setResults([]); return undefined; }
    const t = setTimeout(() => api.get(`/places?q=${encodeURIComponent(q)}`).then(setResults).catch(() => {}), 250);
    return () => clearTimeout(t);
  }, [q, api]);

  if (!f) return err ? <Screen><ErrorBox error={err} /></Screen> : <Loading />;
  const birthDate = `${f.year}-${pad2(f.month)}-${pad2(f.day)}`;
  const birthTime = f.timeAccuracy === 'unknown' ? null : `${pad2(f.hour)}:${pad2(f.minute)}`;
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) && !Number.isNaN(new Date(`${birthDate}T00:00:00Z`).getTime()) && new Date(`${birthDate}T00:00:00Z`).toISOString().slice(0, 10) === birthDate && new Date(birthDate) <= new Date();
  const timeValid = f.timeAccuracy === 'unknown' || (Number(f.hour) >= 0 && Number(f.hour) <= 23 && Number(f.minute) >= 0 && Number(f.minute) <= 59 && f.hour !== '' && f.minute !== '');
  const ready = f.fullName.trim() && dateValid && timeValid && f.placeName && f.latitude !== '' && f.placeConfirmed;
  const chartChanged = initial && (birthDate !== initial.birthDate || (birthTime || '') !== (initial.birthTime?.slice(0, 5) || '') || f.timeAccuracy !== initial.timeAccuracy || Number(f.latitude) !== initial.latitude || Number(f.longitude) !== initial.longitude || f.tzName !== initial.tzName);

  const save = async () => {
    setBusy(true); setErr(null);
    try {
      const body = { label: f.label, fullName: f.fullName, gender: f.gender || null, birthDate, birthTime, timeAccuracy: f.timeAccuracy, timeSource: f.timeSource || null, placeName: f.placeName, latitude: Number(f.latitude), longitude: Number(f.longitude), tzName: f.tzName, placeConfirmed: f.placeConfirmed, isPrimary: f.isPrimary };
      if (isNew) await api.post('/clients/me/birth-profiles', body); else await api.put(`/clients/me/birth-profiles/${id}`, body);
      done();
    } catch (e) { setErr(e); setBusy(false); }
  };
  const remove = () => {
    const go = async () => { await api.del(`/clients/me/birth-profiles/${id}`); done(); };
    if (Platform.OS === 'web') go(); else Alert.alert('Remove this birth profile?', 'Past consultations keep their records.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: go }]);
  };

  return (
    <Screen edges={['bottom']} footer={<View style={{ padding: 16, gap: 8, backgroundColor: c.surface, borderTopWidth: 1, borderColor: c.border }}><Button title="Save" size="lg" loading={busy} disabled={!ready} onPress={save} />{!isNew ? <Button variant="ghost" title="Remove profile" onPress={remove} /> : null}</View>}>
      <ErrorBox error={err} />
      <Card>
        <Field label="Full name" value={f.fullName} onChangeText={set('fullName')} />
        <T small bold>Relationship</T>
        <Chips>{['Self', 'Spouse', 'Child', 'Parent', 'Sibling', 'Friend', 'Other'].map((l) => <Chip key={l} label={l} active={f.label === l} onPress={() => set('label')(l)} />)}</Chips>
        <T small bold>Gender</T>
        <Chips>{[['', 'Prefer not to say'], ['female', 'Female'], ['male', 'Male'], ['non_binary', 'Non-binary']].map(([v, l]) => <Chip key={v} label={l} active={f.gender === v} onPress={() => set('gender')(v)} />)}</Chips>
      </Card>
      <Card title="Date & time of birth">
        <Row>
          <Field label="Day" placeholder="DD" value={f.day} onChangeText={(v) => set('day')(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" style={{ flex: 1 }} />
          <Field label="Month" placeholder="MM" value={f.month} onChangeText={(v) => set('month')(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" style={{ flex: 1 }} />
          <Field label="Year" placeholder="YYYY" value={f.year} onChangeText={(v) => set('year')(v.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" style={{ flex: 1.4 }} />
        </Row>
        {f.year.length === 4 && !dateValid ? <T tiny color={c.bad}>Enter a valid date of birth.</T> : null}
        <T small bold>How accurate is the birth time?</T>
        <Chips>{[['exact', 'Exact'], ['approximate', 'Approximate'], ['unknown', "Don't know"]].map(([v, l]) => <Chip key={v} label={l} active={f.timeAccuracy === v} onPress={() => set('timeAccuracy')(v)} />)}</Chips>
        {f.timeAccuracy !== 'unknown' ? (
          <>
            <Row>
              <Field label="Hour (0–23)" placeholder="HH" value={f.hour} onChangeText={(v) => set('hour')(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" style={{ flex: 1 }} />
              <Field label="Minute" placeholder="MM" value={f.minute} onChangeText={(v) => set('minute')(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" style={{ flex: 1 }} />
            </Row>
            <Field label="Source of time (optional)" placeholder="e.g. birth certificate" value={f.timeSource} onChangeText={set('timeSource')} />
          </>
        ) : null}
        {f.timeAccuracy !== 'exact' ? <Notice tone="warn">Without an exact time, the ascendant (lagna), houses and dasha dates may be inaccurate. Astrologers will see this warning.</Notice> : null}
      </Card>
      <Card title="Place of birth">
        {f.placeName && !manual ? (
          <>
            <T bold>{f.placeName}</T>
            <T small muted>{Number(f.latitude).toFixed(4)}, {Number(f.longitude).toFixed(4)} · {f.tzName}</T>
            <Check checked={f.placeConfirmed} onChange={set('placeConfirmed')} label="I confirm this location and time zone are correct" />
            <Button variant="ghost" size="sm" title="Change place" onPress={() => setF({ ...f, placeName: '', placeConfirmed: false })} style={{ alignSelf: 'flex-start' }} />
          </>
        ) : !manual ? (
          <>
            <Field placeholder="Search city…" value={q} onChangeText={setQ} autoCorrect={false} accessibilityLabel="Search city" />
            {results.map((p) => (
              <Pressable key={p.label} onPress={() => { setF({ ...f, placeName: p.label, latitude: String(p.latitude), longitude: String(p.longitude), tzName: p.tzName, placeConfirmed: false }); setQ(''); setResults([]); }} style={{ paddingVertical: 10, borderBottomWidth: 1, borderColor: c.border }} accessibilityRole="button">
                <T bold small>{p.label}</T><T tiny muted>{p.latitude}, {p.longitude} · {p.tzName}</T>
              </Pressable>
            ))}
            <Button variant="ghost" size="sm" title="Can't find it? Enter coordinates" onPress={() => setManual(true)} style={{ alignSelf: 'flex-start' }} />
          </>
        ) : (
          <>
            <Field label="Place name" value={f.placeName} onChangeText={set('placeName')} />
            <Row>
              <Field label="Latitude (N +)" value={f.latitude} onChangeText={set('latitude')} keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
              <Field label="Longitude (E +)" value={f.longitude} onChangeText={set('longitude')} keyboardType="numbers-and-punctuation" style={{ flex: 1 }} />
            </Row>
            <T small bold>Time zone</T>
            <Chips>{TIMEZONES.map((t) => <Chip key={t} label={t.split('/')[1].replace('_', ' ')} active={f.tzName === t} onPress={() => set('tzName')(t)} />)}</Chips>
            <Check checked={f.placeConfirmed} onChange={set('placeConfirmed')} label="I confirm these coordinates and time zone are correct" />
            <Button variant="ghost" size="sm" title="Search instead" onPress={() => setManual(false)} style={{ alignSelf: 'flex-start' }} />
          </>
        )}
        <T tiny muted>The historical UTC offset for your birth date (daylight saving, war time) is worked out automatically.</T>
      </Card>
      <Check checked={!!f.isPrimary} onChange={set('isPrimary')} label="Use as my default profile for bookings" />
      {chartChanged ? <Notice tone="info">Changing date, time or place marks the current chart as out of date. Earlier versions are kept.</Notice> : null}
    </Screen>
  );
}
