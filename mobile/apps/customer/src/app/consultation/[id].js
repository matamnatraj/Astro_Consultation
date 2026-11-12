import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons, MaterialCommunityIcons as MCI } from '@expo/vector-icons';
import { useAuth, useAsync, useConsultation, ChartView, Sheet, Loading, ErrorBox, useToast, absoluteUrl, mmss, fmtTime, rupees } from '@astro/mobile-core';
import { astrovedas as c } from '../../lib/theme.js';
import { useWallet, useAppConfig } from '../../lib/stores.js';
import { F, Txt, AstroAvatar, GradientButton, ChipToggle } from '../../components/brand.js';
import { BackButton } from '../../components/Header.js';

async function fileToBase64(uri) {
  const blob = await (await fetch(uri)).blob();
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result).split(',')[1]); r.onerror = reject; r.readAsDataURL(blob); });
}
const kb = (n) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function Bubble({ m, mine, astroName, showAvatar }) {
  if (m.kind === 'system') return <View style={{ alignSelf: 'center', backgroundColor: c.accentSoft, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 6, maxWidth: '90%' }}><Txt size={12} color={c.text2} style={{ textAlign: 'center' }}>{m.content}</Txt></View>;
  const file = m.kind === 'file' && m.attachment;
  return (
    <View style={{ flexDirection: 'row', alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '86%', gap: 8, alignItems: 'flex-end' }}>
      {!mine ? <View style={{ width: 34 }}>{showAvatar ? <AstroAvatar name={astroName} size={28} /> : null}</View> : null}
      <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', flexShrink: 1 }}>
        <Pressable disabled={!file} onPress={() => file && Linking.openURL(absoluteUrl(file.url))} accessibilityRole={file ? 'link' : undefined}
          style={{ backgroundColor: mine ? c.bubbleMine : c.bubbleTheirs, borderRadius: 20, borderBottomRightRadius: mine ? 6 : 20, borderBottomLeftRadius: mine ? 20 : 6, paddingHorizontal: 16, paddingVertical: file ? 12 : 11, opacity: m.pending ? 0.6 : 1, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          {file ? (
            <>
              <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name={file.mimeType === 'application/pdf' ? 'document-text-outline' : 'image-outline'} size={22} color={mine ? '#fff' : c.primary} /></View>
              <View style={{ flexShrink: 1 }}><Txt w="s" size={15} color={mine ? '#fff' : c.text} numberOfLines={1}>{file.fileName}</Txt><Txt size={12} color={mine ? 'rgba(255,255,255,0.85)' : c.text2}>{kb(file.sizeBytes)}</Txt></View>
            </>
          ) : <Txt size={15.5} color={mine ? '#fff' : c.text} style={{ lineHeight: 23 }}>{m.content}</Txt>}
        </Pressable>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4, marginHorizontal: 4 }}>
          {m.failed ? <Txt size={11.5} color={c.bad}>Failed — tap to retry</Txt> : <Txt size={11.5} color={c.muted}>{m.pending ? 'Sending…' : fmtTime(m.createdAt)}</Txt>}
          {mine && !m.pending && !m.failed ? <Ionicons name={m.readAt ? 'checkmark-done' : 'checkmark'} size={15} color={c.primary} /> : null}
        </View>
      </View>
    </View>
  );
}

export default function ChatRoom() {
  const { id } = useLocalSearchParams();
  const { api } = useAuth();
  const cfg = useAppConfig();
  const [balance, refreshWallet] = useWallet();
  const s = useConsultation(id);
  const k = s.consultation;
  const [text, setText] = useState('');
  const [menu, setMenu] = useState(false);
  const [chartOpen, setChartOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [extendMin, setExtendMin] = useState(10);
  const [busy, setBusy] = useState(null);
  const [toast, show] = useToast();
  const listRef = useRef();
  const lastTyping = useRef(0);
  const chart = useAsync(() => api.get(`/consultations/${id}/client-chart`), [id], { refocus: false });
  const review = useAsync(() => api.get(`/bookings`).then((bs) => bs.find((b) => b.consultation?.consultationId === id)), [id, k?.status]);
  useEffect(() => { s.markRead(); }, [s.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = useMemo(() => [...s.messages.map((m) => ({ ...m, key: m.messageId })), ...s.pending.map((p) => ({ ...p, key: p.clientMsgId, pending: true, senderUserId: s.myUserId, kind: 'text' }))], [s.messages, s.pending, s.myUserId]);
  if (s.error) return <SafeAreaView style={{ flex: 1, backgroundColor: c.bg, padding: 16 }}><BackButton fallback="/sessions" /><ErrorBox error={s.error} /></SafeAreaView>;
  if (!k) return <Loading />;
  const live = k.status === 'in_progress';
  const ended = ['completed', 'cancelled', 'rejected', 'expired', 'failed'].includes(k.status);
  const callEnabled = cfg.enabledModes.includes('voice');

  const send = () => { const t = text.trim(); if (!t || !live) return; s.send(t); setText(''); };
  const attach = async () => {
    if (!live) return;
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'], copyToCacheDirectory: true });
    if (res.canceled) return;
    const f = res.assets[0];
    if (f.size && f.size > 5 * 1024 * 1024) { show('File must be 5 MB or smaller', 'bad'); return; }
    setBusy('attach');
    try { await api.post(`/consultations/${id}/attachments`, { fileName: f.name, mimeType: f.mimeType || 'application/pdf', contentBase64: await fileToBase64(f.uri) }); } catch (e) { show(e.message, 'bad'); } finally { setBusy(null); }
  };
  const end = () => {
    setMenu(false);
    const go = async () => { setBusy('end'); try { s.setConsultation(await api.post(`/consultations/${id}/end`)); refreshWallet(); } catch (e) { show(e.message, 'bad'); } finally { setBusy(null); } };
    const msg = `You'll be charged for ${s.timer?.billedMinutes || 1} minute(s). Any unused amount returns to your wallet.`;
    if (Platform.OS === 'web') go(); else Alert.alert('End consultation?', msg, [{ text: 'Keep chatting', style: 'cancel' }, { text: 'End', style: 'destructive', onPress: go }]);
  };
  const extend = async () => {
    setBusy('extend');
    try { s.setConsultation(await api.post(`/consultations/${id}/extend`, { minutes: extendMin })); setExtendOpen(false); refreshWallet(); show(`Extended by ${extendMin} minutes`); }
    catch (e) { if (e.details?.code === 'insufficient_balance') { setExtendOpen(false); router.push(`/wallet?add=${Math.ceil((e.details.requiredPaise - e.details.balancePaise) / 100)}`); } else show(e.message, 'bad'); }
    finally { setBusy(null); }
  };
  const waiting = { requested: `Waiting for ${k.astrologer.name} to accept…`, accepted: 'Accepted — the session opens at the scheduled time.', ready: `${k.astrologer.name} will start the session shortly. Stay here.` }[k.status];
  const astroOnline = s.presence.length > 1 || live;
  const runningAmount = s.timer ? Math.max(0, s.timer.runningAmount - (k.discountPaise || 0)) : 0;

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: 1, borderColor: c.border }}>
        <BackButton icon="chevron-back" fallback="/sessions" />
        <AstroAvatar name={k.astrologer.name} size={42} online={astroOnline} />
        <View style={{ flex: 1 }}>
          <Txt w="s" size={16.5} numberOfLines={1}>{k.astrologer.name}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: astroOnline ? c.ok : c.muted }} /><Txt size={13} color={astroOnline ? c.ok : c.muted}>{s.typing ? 'typing…' : astroOnline ? 'Online' : 'Offline'}</Txt></View>
        </View>
        <Pressable onPress={() => (callEnabled ? router.push(`/call/${id}`) : show('Audio calls are coming soon.', 'info'))} hitSlop={10} accessibilityRole="button" accessibilityLabel="Call" style={{ padding: 8, opacity: callEnabled ? 1 : 0.5 }}><Ionicons name="call-outline" size={23} color={c.primary} /></Pressable>
        <Pressable onPress={() => setMenu(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel="More options" style={{ padding: 8 }}><Ionicons name="ellipsis-vertical" size={22} color={c.text} /></Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={8}>
        {s.connection !== 'online' ? <View style={{ backgroundColor: c.warnSoft, padding: 6 }}><Txt size={12} color={c.warn} style={{ textAlign: 'center' }}>Reconnecting… messages will sync automatically.</Txt></View> : null}
        <FlatList ref={listRef} data={items} keyExtractor={(m) => m.key} contentContainerStyle={{ padding: 14, gap: 14 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListHeaderComponent={waiting ? <View style={{ backgroundColor: c.surface, borderRadius: 18, padding: 16, alignItems: 'center', gap: 8, ...c.shadow }}><MCI name="timer-sand" size={28} color={c.primary} /><Txt w="m" style={{ textAlign: 'center' }}>{waiting}</Txt><Txt size={12.5} color={c.text2} style={{ textAlign: 'center' }}>If they don't accept, the full amount returns to your wallet.</Txt></View> : null}
          renderItem={({ item, index }) => {
            const mine = item.senderUserId === s.myUserId;
            const prev = items[index - 1];
            return <Bubble m={item} mine={mine} astroName={k.astrologer.name} showAvatar={!mine && (!prev || prev.senderUserId !== item.senderUserId)} />;
          }}
          ListFooterComponent={(
            <>
              {s.typing ? <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 12 }}><AstroAvatar name={k.astrologer.name} size={28} /><View style={{ backgroundColor: c.bubbleTheirs, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10 }}><Txt w="b" size={18} color={c.text2}>• • •</Txt></View></View> : null}
              {ended ? (
                <View style={{ backgroundColor: c.surface, borderRadius: 20, padding: 18, gap: 10, marginTop: 16, alignItems: 'center', ...c.shadow }}>
                  <MCI name="check-circle-outline" size={32} color={c.ok} />
                  <Txt w="s" size={16}>{k.status === 'completed' ? 'Consultation completed' : `Consultation ${k.status}`}</Txt>
                  {k.status === 'completed' ? <Txt size={13.5} color={c.text2} style={{ textAlign: 'center' }}>{Math.ceil((k.billableSeconds || 0) / 60)} min · Charged {rupees(k.chargedPaise ?? k.finalAmountPaise)}{k.discountPaise ? ` (incl. ${k.discountLabel})` : ''}</Txt> : null}
                  {k.status === 'completed' && review.data && !review.data.consultation?.reviewed ? <GradientButton size="sm" title="Rate Your Consultation" onPress={() => router.push(`/rate/${id}`)} /> : null}
                  <Txt w="m" color={c.primary} onPress={() => router.push(`/astrologer/${k.astrologer.astrologerId}`)}>Chat again with {k.astrologer.name.split(' ')[0]}</Txt>
                </View>
              ) : null}
            </>
          )} />

        {live || k.status === 'completed' ? (
          <View style={{ marginHorizontal: 14, marginBottom: 8, borderRadius: 18, borderWidth: 1, borderColor: '#F0D9C4', backgroundColor: '#FFF8F1', paddingHorizontal: 14, paddingVertical: 11, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="time-outline" size={19} color={c.primary} />
            <Txt w="m" size={15}>Consultation Time: <Txt w="s" size={15} color={s.timer?.remaining <= 120 && live ? c.bad : c.primary}>{mmss(s.timer?.elapsed || 0)}</Txt></Txt>
            <View style={{ flex: 1 }} />
            <Txt w="b" size={16}>{rupees(live ? runningAmount : (k.chargedPaise ?? 0))}</Txt><Txt size={12.5} color={c.text2}> ({rupees(k.ratePaise)}/min)</Txt>
          </View>
        ) : null}
        {live && s.timer?.remaining <= 120 ? (
          <Pressable onPress={() => setExtendOpen(true)} style={{ marginHorizontal: 14, marginBottom: 8, backgroundColor: c.primarySoft, borderRadius: 14, padding: 10, alignItems: 'center' }}>
            <Txt w="m" size={13.5} color={c.pricePillText}>{mmss(s.timer.remaining)} left — tap to extend from wallet</Txt>
          </Pressable>
        ) : null}

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingBottom: 10, paddingTop: 4 }}>
          <Pressable onPress={attach} disabled={!live || busy === 'attach'} hitSlop={8} accessibilityRole="button" accessibilityLabel="Attach file" style={{ opacity: live ? 1 : 0.4 }}>
            <MCI name={busy === 'attach' ? 'progress-upload' : 'paperclip'} size={26} color={c.text2} />
          </Pressable>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F4ECE4', borderRadius: 26, paddingHorizontal: 16, minHeight: 50 }}>
            <TextInput value={text} editable={live} multiline maxLength={4000} accessibilityLabel="Message"
              onChangeText={(v) => { setText(v); if (Date.now() - lastTyping.current > 2000) { lastTyping.current = Date.now(); s.notifyTyping(); } }}
              placeholder={live ? 'Type a message…' : ended ? 'This consultation has ended' : 'Chat opens when the session starts'} placeholderTextColor={c.muted}
              onSubmitEditing={Platform.OS === 'web' ? send : undefined}
              style={[F.r, { flex: 1, fontSize: 15.5, color: c.text, maxHeight: 110, paddingVertical: 12 }]} />
            <Ionicons name="happy-outline" size={22} color={c.muted} />
          </View>
          <Pressable onPress={send} disabled={!live || !text.trim()} accessibilityRole="button" accessibilityLabel="Send"
            style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', opacity: !live || !text.trim() ? 0.5 : 1, ...c.shadow, shadowOpacity: 0.25 }}>
            <Ionicons name="send" size={22} color="#fff" style={{ marginLeft: 3 }} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      <Sheet visible={menu} onClose={() => setMenu(false)} title="Consultation">
        {[
          ['dharmachakra', 'View my Kundli', () => { setMenu(false); setChartOpen(true); }, true],
          ['timer-plus-outline', 'Extend session', () => { setMenu(false); setExtendOpen(true); }, live && k.paymentMethod === 'wallet'],
          ['receipt', 'Booking & receipt', () => { setMenu(false); router.push(`/booking/${k.bookingId}`); }, true],
          ['lifebuoy', 'Report a problem', () => { setMenu(false); router.push('/support'); }, true],
          ['phone-hangup-outline', 'End consultation', end, live],
        ].filter((x) => x[3]).map(([icon, label, onPress]) => (
          <Pressable key={label} onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13 }} accessibilityRole="button">
            <MCI name={icon} size={22} color={label === 'End consultation' ? c.bad : c.primary} /><Txt w="m" size={15.5} color={label === 'End consultation' ? c.bad : c.text}>{label}</Txt>
          </Pressable>
        ))}
      </Sheet>
      <Sheet visible={chartOpen} onClose={() => setChartOpen(false)} title="My Kundli">
        {chart.loading ? <Loading /> : chart.error ? <ErrorBox error={chart.error} /> : <ChartView chart={chart.data.chart} birthProfile={chart.data.birthProfile} availability={chart.data.availability} />}
      </Sheet>
      <Sheet visible={extendOpen} onClose={() => setExtendOpen(false)} title="Extend session"
        footer={<GradientButton title={`Extend · ${rupees(k.ratePaise * extendMin)}`} onPress={extend} loading={busy === 'extend'} trailing="" />}>
        <Txt size={14} color={c.text2}>Add minutes now — charged only if used. Wallet balance: {rupees(balance ?? 0)}</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>{[5, 10, 15, 20].map((m) => <ChipToggle key={m} label={`${m} min`} active={extendMin === m} onPress={() => setExtendMin(m)} />)}</View>
      </Sheet>
      {toast}
      {busy === 'end' ? <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', backgroundColor: 'rgba(253,245,236,0.6)' }}><Loading /></View> : null}
      {review.loading ? null : null}
    </SafeAreaView>
  );
}

void ScrollView;
