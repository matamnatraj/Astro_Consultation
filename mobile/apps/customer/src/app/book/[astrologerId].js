import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { payInBrowser } from '../../lib/payments.js';
import { useAuth, useAsync, Screen, Card, T, Row, Segmented, Chips, Chip, Button, Notice, Check, ErrorBox, Loading, Badge, Sheet, rupees, fmtTime, fmtDateTime, useTheme } from '@astro/mobile-core';

const DURATIONS = [5, 10, 15, 20, 30];


export default function Book() {
  const { astrologerId, type: initialType } = useLocalSearchParams();
  const { api } = useAuth();
  const c = useTheme();
  const astro = useAsync(() => api.get(`/astrologers/${astrologerId}`), [astrologerId]);
  const profiles = useAsync(() => api.get('/clients/me/birth-profiles'), []);
  const [type, setType] = useState(initialType === 'instant' ? 'instant' : 'scheduled');
  const [slotId, setSlotId] = useState(null);
  const [duration, setDuration] = useState(15);
  const [bpId, setBpId] = useState(null);
  const [policyOk, setPolicyOk] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const idempotencyKey = useMemo(() => `bk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`, []);
  const quote = useAsync(() => api.get(`/bookings/quote?astrologerId=${astrologerId}&mode=chat&durationMinutes=${duration}`), [astrologerId, duration], { refocus: false });

  const days = useMemo(() => {
    const m = new Map();
    for (const s of astro.data?.slots || []) {
      const d = new Date(s.startAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
      if (!m.has(d)) m.set(d, []);
      m.get(d).push(s);
    }
    return [...m.entries()];
  }, [astro.data]);
  const [day, setDay] = useState(null);

  if (astro.loading || profiles.loading) return <Loading />;
  if (astro.error) return <Screen><ErrorBox error={astro.error} /></Screen>;
  const a = astro.data;
  const bp = bpId || profiles.data.find((p) => p.isPrimary)?.birthProfileId || profiles.data[0]?.birthProfileId;
  const instantOk = a.isOnline && !a.isBusy;
  const slot = a.slots.find((s) => s.slotId === slotId);
  const maxDuration = type === 'scheduled' && slot ? (new Date(slot.endAt) - new Date(slot.startAt)) / 60000 : 120;
  const activeDay = day || days[0]?.[0];
  const ready = bp && policyOk && quote.data && (type === 'instant' ? instantOk : slot) && duration <= maxDuration;

  const confirm = async () => {
    setBusy(true); setErr(null);
    try {
      const b = await api.post('/bookings', {
        astrologerId, birthProfileId: bp, mode: 'chat', bookingType: type, slotId: type === 'scheduled' ? slotId : undefined,
        durationMinutes: duration, acceptedCancellationPolicyVersion: quote.data.cancellationPolicy.version, idempotencyKey,
      });
      const outcome = await payInBrowser(api, b.bookingId);
      if (outcome !== 'redirected') router.replace(`/booking/${b.bookingId}?payment=${outcome}`);
    } catch (e) { setErr(e); if (e.details?.code === 'policy_changed') quote.reload(); } finally { setBusy(false); }
  };

  return (
    <Screen footer={(
      <View style={{ padding: 16, gap: 10, backgroundColor: c.surface, borderTopWidth: 1, borderColor: c.border }}>
        {quote.data ? <Row style={{ justifyContent: 'space-between' }}><T muted small>{rupees(quote.data.ratePaise)}/min · up to {duration} min</T><T bold size={17}>{rupees(quote.data.amountPaise)}</T></Row> : null}
        <Check checked={policyOk} onChange={setPolicyOk} label={<T small>I've reviewed the price and the <T small bold color={c.primary} onPress={() => setPolicyOpen(true)}>cancellation & refund policy</T>.</T>} />
        <ErrorBox error={err} />
        <Button size="lg" title="Continue to payment" disabled={!ready} loading={busy} onPress={confirm} />
        <T tiny muted center>Paid securely through our payment gateway. We never see your card details.</T>
      </View>
    )}>
      <T bold size={18}>{a.displayName}</T>
      <Card title="1. When">
        <Segmented value={type} onChange={setType} options={[{ value: 'instant', label: 'Now', disabled: !instantOk }, { value: 'scheduled', label: 'Schedule' }]} />
        {type === 'instant'
          ? (instantOk ? <T small muted>{a.displayName} is online and has a few minutes to accept. If they don't, you're not charged.</T> : <Notice tone="warn">{`${a.displayName} is ${a.isBusy ? 'in another session' : 'offline'}. Pick a time instead.`}</Notice>)
          : days.length === 0 ? <T muted>No open slots in the next 14 days.</T> : (
            <>
              <Chips>{days.map(([d]) => <Chip key={d} label={d} active={activeDay === d} onPress={() => setDay(d)} />)}</Chips>
              <Chips>{(days.find(([d]) => d === activeDay)?.[1] || []).map((s) => <Chip key={s.slotId} label={fmtTime(s.startAt)} active={slotId === s.slotId} onPress={() => { setSlotId(s.slotId); setDuration((x) => Math.min(x, (new Date(s.endAt) - new Date(s.startAt)) / 60000)); }} />)}</Chips>
              {slot ? <T small>Selected: <T small bold>{fmtDateTime(slot.startAt)}</T></T> : null}
            </>
          )}
      </Card>
      <Card title="2. Duration">
        <Chips>{DURATIONS.filter((d) => d <= maxDuration).map((d) => <Chip key={d} label={`${d} min`} active={duration === d} onPress={() => setDuration(d)} />)}</Chips>
        <T tiny muted>Charged per started minute, up to this limit. The session ends automatically at the limit.</T>
      </Card>
      <Card title="3. Whose chart?">
        {profiles.data.length === 0 ? (
          <Notice tone="warn" action={<Button size="sm" title="Add birth details" onPress={() => router.push('/birth-profile/new')} style={{ alignSelf: 'flex-start' }} />}>Add birth details so the astrologer can see the chart.</Notice>
        ) : profiles.data.map((p) => (
          <Check key={p.birthProfileId} checked={bp === p.birthProfileId} onChange={() => setBpId(p.birthProfileId)}
            label={<View><Row gap={6}><T bold small>{p.fullName}</T><T tiny muted>({p.label})</T>{p.latestChart?.status === 'stale' ? <Badge tone="warn" label="Chart outdated" /> : null}</Row><T tiny muted>{p.birthDate} · {p.birthTime?.slice(0, 5) || 'time unknown'} · {p.placeName}</T></View>} />
        ))}
        <T tiny muted>Only the astrologer you book can view this chart, and only during the consultation. Access is logged.</T>
      </Card>
      <Sheet visible={policyOpen} onClose={() => setPolicyOpen(false)} title={quote.data ? `${quote.data.cancellationPolicy.title} (v${quote.data.cancellationPolicy.version})` : 'Policy'}>
        <T small>{quote.data?.cancellationPolicy.body}</T>
      </Sheet>
    </Screen>
  );
}
