import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons, MaterialCommunityIcons as MCI } from '@expo/vector-icons';
import { useAuth, useAsync, Loading, ErrorBox, Sheet, T, rupees, fmtTime } from '@astro/mobile-core';
import { astrovedas as c } from '../../lib/theme.js';
import { useWallet, useAppConfig } from '../../lib/stores.js';
import { Txt, AstroAvatar, GradientButton, ChipToggle } from '../../components/brand.js';
import { BackButton } from '../../components/Header.js';

const DURATIONS = [5, 10, 15, 20, 30];

function ModeCard({ icon, title, price, active, disabled, onPress, note }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="radio" accessibilityState={{ selected: active, disabled }}
      style={{ flex: 1, borderRadius: 22, paddingVertical: 18, alignItems: 'center', gap: 6, backgroundColor: active ? '#FDE9D7' : 'transparent', opacity: disabled ? 0.5 : 1, ...(active ? c.shadow : {}) }}>
      {active ? <View style={{ position: 'absolute', top: -10, right: 12, backgroundColor: c.primary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 }}><Txt w="s" size={11} color="#fff">ACTIVE</Txt></View> : null}
      <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: active ? c.primary : '#F2E8DE', alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={24} color={active ? '#fff' : c.text2} />
      </View>
      <Txt w="m" size={16} color={active ? c.primary : c.text}>{title}</Txt>
      <Txt size={13} color={c.text2}>{note || `${rupees(price)}/min`}</Txt>
    </Pressable>
  );
}

const Row = ({ label, value, bold, color, icon }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 6 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>{icon ? <MCI name={icon} size={18} color={color} /> : null}<Txt size={bold ? 19 : 15} w={bold ? 's' : 'r'} color={color || c.text2}>{label}</Txt></View>
    <Txt size={bold ? 24 : 16} w={bold ? 'b' : 'm'} color={color || c.text}>{value}</Txt>
  </View>
);

export default function ConsultSetup() {
  const { astrologerId, mode: initialMode } = useLocalSearchParams();
  const { api } = useAuth();
  const cfg = useAppConfig();
  const [balance, refreshWallet] = useWallet();
  const a = useAsync(() => api.get(`/astrologers/${astrologerId}`), [astrologerId]);
  const profiles = useAsync(() => api.get('/clients/me/birth-profiles'), []);
  const [mode, setMode] = useState(initialMode === 'voice' ? 'voice' : 'chat');
  const [duration, setDuration] = useState(10);
  const [when, setWhen] = useState(null); // 'now' | 'scheduled'
  const [slotId, setSlotId] = useState(null);
  const [bpId, setBpId] = useState(null);
  const [pickBp, setPickBp] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const idempotencyKey = useMemo(() => `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`, []);
  const quote = useAsync(() => api.get(`/bookings/quote?astrologerId=${astrologerId}&mode=${mode}&durationMinutes=${duration}&paymentMethod=wallet`), [astrologerId, mode, duration], { refocus: true });

  if (a.loading || profiles.loading) return <Loading />;
  if (a.error) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, padding: 16 }}><BackButton /><ErrorBox error={a.error} /></SafeAreaView>;
  const x = a.data;
  const canNow = x.isOnline && !x.isBusy;
  const type = when || (canNow ? 'now' : 'scheduled');
  const slot = x.slots.find((s) => s.slotId === slotId);
  const bp = bpId || profiles.data.find((p) => p.isPrimary)?.birthProfileId || profiles.data[0]?.birthProfileId;
  const bpRow = profiles.data.find((p) => p.birthProfileId === bp);
  const q = quote.data;
  const payable = q?.payablePaise ?? 0;
  const wallet = q?.walletBalancePaise ?? balance ?? 0;
  const shortfall = Math.max(0, payable - wallet);
  const callEnabled = cfg.enabledModes.includes('voice') && x.modes.includes('voice');
  const ready = q && bp && (type === 'now' ? canNow : slot);

  const confirm = async () => {
    if (shortfall > 0) { router.push(`/wallet?add=${Math.ceil(shortfall / 100)}`); return; }
    setBusy(true); setErr(null);
    try {
      const b = await api.post('/bookings', {
        astrologerId, birthProfileId: bp, mode, bookingType: type === 'now' ? 'instant' : 'scheduled', slotId: type === 'scheduled' ? slotId : undefined,
        durationMinutes: duration, acceptedCancellationPolicyVersion: q.cancellationPolicy.version, idempotencyKey, paymentMethod: 'wallet',
      });
      refreshWallet();
      const detail = await api.get(`/bookings/${b.bookingId}`);
      router.replace(detail.consultation ? `/consultation/${detail.consultation.consultationId}` : `/booking/${b.bookingId}`);
    } catch (e) {
      setErr(e); setBusy(false);
      if (e.details?.code === 'insufficient_balance' || e.details?.code === 'policy_changed') quote.reload();
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <BackButton fallback={`/astrologer/${astrologerId}`} />
          <AstroAvatar name={x.displayName} size={60} online={x.isOnline} />
          <View style={{ flex: 1 }}>
            <Txt w="s" size={18} numberOfLines={1}>{x.displayName}</Txt>
            <Txt size={13} color={c.text2} numberOfLines={1}>{x.specialties.slice(0, 2).join(', ')} • {x.experienceYears}+ Yrs</Txt>
            <Txt size={13}><Txt color={c.accent}>★ </Txt><Txt w="s" size={13}>{x.ratingCount ? x.ratingAvg.toFixed(1) : 'New'}</Txt><Txt size={13} color={c.text2}> ({x.ratingCount} reviews)</Txt></Txt>
          </View>
        </View>

        <Txt w="s" size={17}>Consultation Mode</Txt>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <ModeCard icon="chatbox" title="Chat" price={x.rates.chat} active={mode === 'chat'} onPress={() => setMode('chat')} />
          <ModeCard icon="call-outline" title="Audio Call" price={x.rates.voice} active={mode === 'voice'} disabled={!callEnabled} note={!callEnabled ? 'Coming soon' : undefined} onPress={() => setMode('voice')} />
        </View>

        {!canNow || x.slots.length ? (
          <View style={{ gap: 10 }}>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <ChipToggle label="Start now" icon="flash-outline" active={type === 'now'} onPress={() => (canNow ? setWhen('now') : null)} />
              <ChipToggle label="Schedule" icon="calendar-outline" active={type === 'scheduled'} onPress={() => setWhen('scheduled')} />
            </View>
            {type === 'now' && !canNow ? <Txt size={13} color={c.warn}>{x.displayName} is {x.isBusy ? 'in another session' : 'offline'} — pick a time below.</Txt> : null}
            {type === 'scheduled' ? (
              x.slots.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {x.slots.slice(0, 40).map((s) => (
                    <ChipToggle key={s.slotId} label={`${new Date(s.startAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })} · ${fmtTime(s.startAt)}`} active={slotId === s.slotId}
                      onPress={() => { setSlotId(s.slotId); setDuration((d) => Math.min(d, (new Date(s.endAt) - new Date(s.startAt)) / 60000)); }} />
                  ))}
                </ScrollView>
              ) : <Txt size={13} color={c.muted}>No open slots in the next 14 days.</Txt>
            ) : null}
          </View>
        ) : null}

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <Txt w="s" size={17}>Select Session Duration</Txt><Txt size={13} color={c.text2}>Extendable anytime</Txt>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {DURATIONS.filter((d) => !slot || d <= (new Date(slot.endAt) - new Date(slot.startAt)) / 60000).slice(0, 4).map((d) => (
            <Pressable key={d} onPress={() => setDuration(d)} accessibilityRole="radio" accessibilityState={{ selected: duration === d }}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 13, borderRadius: 22, backgroundColor: duration === d ? c.primary : c.surface, ...(duration === d ? {} : c.shadow) }}>
              <Txt w="m" size={15} color={duration === d ? '#fff' : c.text}>{d} min</Txt>
            </Pressable>
          ))}
        </View>

        <View style={{ backgroundColor: c.surface, borderRadius: 22, padding: 18, ...c.shadow }}>
          {!q ? <Loading /> : (
            <>
              <Row label="Rate" value={`${rupees(q.ratePaise)} / min`} />
              <Row label="Estimated Duration" value={`${duration} minutes`} />
              <Row label="Initial Gross Subtotal" value={rupees(q.amountPaise)} />
              {q.discountPaise ? (<><View style={{ height: 1, backgroundColor: c.border, marginVertical: 6 }} /><Row icon="gift-outline" label={q.discountLabel} value={`-${rupees(q.discountPaise)}`} color={c.pricePillText} /></>) : null}
              <View style={{ height: 1, backgroundColor: c.border, marginVertical: 6 }} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View><Txt w="s" size={19}>Estimated Payable</Txt><Txt size={12.5} color={c.text2}>Refundable if unused</Txt></View>
                <Txt w="b" size={26} color={c.primary}>{rupees(payable)}</Txt>
              </View>
            </>
          )}
        </View>

        <View style={{ borderRadius: 22, borderWidth: 1, borderColor: '#E9D9C9', padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
          <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#E5F5EC', alignItems: 'center', justifyContent: 'center' }}><MCI name="wallet" size={24} color={c.ok} /></View>
          <View style={{ flex: 1 }}><Txt size={13} color={c.text2}>{cfg.walletName} Balance</Txt><Txt w="b" size={20} color={shortfall ? c.bad : c.ok}>{rupees(wallet)}</Txt></View>
          <Pressable onPress={() => router.push('/wallet')} accessibilityRole="button" accessibilityLabel="Add money" style={{ backgroundColor: '#F2E8DE', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 9 }}><Txt w="m">+ Add</Txt></Pressable>
        </View>

        <Pressable onPress={() => setPickBp(true)} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.surface, borderRadius: 18, padding: 14, ...c.shadow }}>
          <MCI name="dharmachakra" size={22} color={c.primary} />
          <View style={{ flex: 1 }}>
            <Txt size={12.5} color={c.text2}>Kundli shared with the astrologer</Txt>
            <Txt w="m">{bpRow ? `${bpRow.fullName} (${bpRow.label})` : 'Add your birth details'}</Txt>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.muted} />
        </Pressable>

        <ErrorBox error={err} />
        <Txt size={12} color={c.muted} style={{ textAlign: 'center' }}>
          By confirming you agree to the <Txt size={12} w="m" color={c.primary} onPress={() => setPolicyOpen(true)}>Cancellation & Refund Policy{q ? ` (v${q.cancellationPolicy.version})` : ''}</Txt>. Only minutes used are charged.
        </Txt>
      </ScrollView>
      <View style={{ paddingHorizontal: 16, paddingBottom: 10, paddingTop: 6 }}>
        {!bp ? <GradientButton title="Add birth details" onPress={() => router.push('/birth-profile/new')} />
          : <GradientButton icon={shortfall ? 'wallet-plus-outline' : 'message-text-outline'} title={shortfall ? `Add ${rupees(shortfall)} to Wallet` : `Confirm & ${type === 'now' ? `Start ${mode === 'voice' ? 'Call' : 'Chat'}` : 'Book Slot'}`} onPress={confirm} loading={busy} disabled={!ready} />}
      </View>
      <Sheet visible={pickBp} onClose={() => setPickBp(false)} title="Whose kundli?">
        {profiles.data.map((p) => (
          <Pressable key={p.birthProfileId} onPress={() => { setBpId(p.birthProfileId); setPickBp(false); }} style={{ paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between' }}>
            <View><Txt w="m">{p.fullName} <Txt size={13} color={c.muted}>({p.label})</Txt></Txt><Txt size={12.5} color={c.text2}>{p.birthDate} · {p.birthTime?.slice(0, 5) || 'time unknown'} · {p.placeName}</Txt></View>
            {bp === p.birthProfileId ? <Ionicons name="checkmark-circle" size={22} color={c.primary} /> : null}
          </Pressable>
        ))}
        <GradientButton size="sm" title="Add new birth details" trailing="+" onPress={() => { setPickBp(false); router.push('/birth-profile/new'); }} />
        <T tiny muted>Only the astrologer you consult can view this kundli, and only during the consultation. Access is logged.</T>
      </Sheet>
      <Sheet visible={policyOpen} onClose={() => setPolicyOpen(false)} title={q?.cancellationPolicy.title || 'Policy'}><T small>{q?.cancellationPolicy.body}</T></Sheet>
    </SafeAreaView>
  );
}
