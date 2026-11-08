import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Platform, Pressable, TextInput, View } from 'react-native';
import { useAuth } from './auth.js';
import { useRealtimeClient, useRealtimeEvent, useRealtimeStatus } from './realtime.js';
import { useTheme } from './theme.js';
import { mmss, fmtTime, rupees } from './format.js';
import { T, Badge, Button } from './ui.js';

/**
 * Single source of truth for a live consultation (state, messages, timer, connection).
 * Mounted once per consultation screen, so switching between Chat and Birth Chart
 * never resets the session, the realtime connection, unread state, timer or billing.
 */
export function useConsultation(consultationId) {
  const { api, me } = useAuth();
  const rt = useRealtimeClient();
  const connection = useRealtimeStatus();
  const [consultation, setConsultation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pending, setPending] = useState([]);
  const [error, setError] = useState(null);
  const [typing, setTyping] = useState(false);
  const [presence, setPresence] = useState([]);
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(Date.now());
  const lastSeq = useRef(0);
  const typingTimer = useRef();
  const myId = me.user.userId;

  const merge = useCallback((incoming) => {
    setMessages((prev) => {
      const map = new Map(prev.map((m) => [m.messageId, m]));
      for (const m of incoming) map.set(m.messageId, { ...map.get(m.messageId), ...m });
      const list = [...map.values()].sort((a, b) => a.seq - b.seq);
      if (list.length) lastSeq.current = list[list.length - 1].seq;
      return list;
    });
    const ids = new Set(incoming.map((m) => m.clientMsgId).filter(Boolean));
    if (ids.size) setPending((p) => p.filter((x) => !ids.has(x.clientMsgId)));
  }, []);
  const apply = useCallback((c) => {
    setConsultation(c);
    if (c.serverTime) setClockOffset(new Date(c.serverTime).getTime() - Date.now());
  }, []);
  const refresh = useCallback(async () => {
    try {
      const [c, msgs] = await Promise.all([api.get(`/consultations/${consultationId}`), api.get(`/consultations/${consultationId}/messages?afterSeq=0`)]);
      apply(c); merge(msgs);
    } catch (e) { setError(e); }
  }, [api, consultationId, apply, merge]);

  useEffect(() => { refresh(); rt.join(consultationId, 0); return () => rt.leave(consultationId); }, [consultationId, rt, refresh]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  useRealtimeEvent((ev) => {
    if (ev.type === 'joined' && ev.consultation.consultationId === consultationId) { apply(ev.consultation); merge(ev.messages); }
    if ((ev.type === 'message' || ev.type === 'ack') && ev.message?.consultationId === consultationId) merge([ev.message]);
    if (ev.type === 'consultation.state' && ev.consultation.consultationId === consultationId) apply(ev.consultation);
    if (ev.type === 'typing' && ev.consultationId === consultationId) {
      setTyping(true); clearTimeout(typingTimer.current); typingTimer.current = setTimeout(() => setTyping(false), 3000);
    }
    if (ev.type === 'presence' && ev.consultationId === consultationId) setPresence(ev.online);
    if (ev.type === 'read' && ev.consultationId === consultationId && ev.userId !== myId) {
      setMessages((ms) => ms.map((m) => (m.seq <= ev.upToSeq && m.senderUserId === myId && !m.readAt ? { ...m, readAt: new Date().toISOString() } : m)));
    }
    if (ev.type === 'error' && ev.clientMsgId) setPending((p) => p.map((x) => (x.clientMsgId === ev.clientMsgId ? { ...x, failed: ev.message } : x)));
  });

  const send = useCallback(async (content) => {
    const clientMsgId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    setPending((p) => [...p, { clientMsgId, content, createdAt: new Date().toISOString() }]);
    if (!rt.send({ type: 'message', consultationId, content, clientMsgId })) {
      try { merge([await api.post(`/consultations/${consultationId}/messages`, { content, clientMsgId })]); } catch (e) {
        setPending((p) => p.map((x) => (x.clientMsgId === clientMsgId ? { ...x, failed: e.message } : x)));
      }
    }
  }, [rt, api, consultationId, merge]);
  const retry = useCallback((p) => { setPending((ps) => ps.filter((x) => x !== p)); send(p.content); }, [send]);
  const notifyTyping = useCallback(() => rt.send({ type: 'typing', consultationId }), [rt, consultationId]);
  const markRead = useCallback(() => {
    const unread = messages.some((m) => !m.readAt && m.senderUserId && m.senderUserId !== myId);
    if (!unread || !lastSeq.current) return;
    if (!rt.send({ type: 'read', consultationId, upToSeq: lastSeq.current })) api.post(`/consultations/${consultationId}/read`, { upToSeq: lastSeq.current }).catch(() => {});
    setMessages((ms) => ms.map((m) => (m.senderUserId !== myId ? { ...m, readAt: m.readAt || new Date().toISOString() } : m)));
  }, [messages, rt, api, consultationId, myId]);

  const timer = useMemo(() => {
    if (!consultation?.startedAt) return null;
    const end = consultation.endedAt ? new Date(consultation.endedAt).getTime() : now + clockOffset;
    const elapsed = Math.max(0, Math.floor((end - new Date(consultation.startedAt).getTime()) / 1000));
    const billedMinutes = Math.min(Math.ceil(Math.max(1, elapsed) / 60), consultation.maxBillableSeconds / 60);
    return { elapsed, remaining: Math.max(0, consultation.maxBillableSeconds - elapsed), billedMinutes, runningAmount: billedMinutes * consultation.ratePaise };
  }, [consultation, now, clockOffset]);
  const unread = messages.filter((m) => m.kind === 'text' && !m.readAt && m.senderUserId !== myId).length;

  return { consultation, messages, pending, error, typing, presence, connection, timer, unread, send, retry, notifyTyping, markRead, refresh, setConsultation: apply, myUserId: myId };
}

export function SessionTimer({ session }) {
  const c = useTheme();
  const { consultation: k, timer } = session;
  if (!k) return null;
  if (!['in_progress', 'completed'].includes(k.status)) return <Badge status={k.status} />;
  const low = k.status === 'in_progress' && timer.remaining <= 120;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: low ? c.liveSoft : c.surface2, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 }} accessibilityLabel={`Elapsed ${mmss(timer.elapsed)}`}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: k.status === 'in_progress' ? c.live : c.muted }} />
      <T bold color={low ? c.live : c.text} style={{ fontVariant: ['tabular-nums'] }}>{mmss(timer.elapsed)}</T>
      <T tiny muted>{k.status === 'in_progress' ? `${mmss(timer.remaining)} left · ${rupees(timer.runningAmount)}` : `Billed ${rupees(k.finalAmountPaise)}`}</T>
    </View>
  );
}

/** Chat pane. Keep it mounted while hidden (pass visible=false) so state and the connection persist. */
export function ChatPane({ session, visible = true, placeholder = 'Type a message…', disabledReason }) {
  const c = useTheme();
  const { consultation: k, messages, pending, typing, send, retry, notifyTyping, markRead, myUserId, connection } = session;
  const [text, setText] = useState('');
  const listRef = useRef();
  const lastTyping = useRef(0);
  useEffect(() => { if (visible) markRead(); }, [visible, messages.length, markRead]);
  const items = useMemo(() => [...messages.map((m) => ({ ...m, key: m.messageId })), ...pending.map((p) => ({ ...p, key: p.clientMsgId, pending: true, senderUserId: myUserId, kind: 'text' }))], [messages, pending, myUserId]);
  const canSend = k?.status === 'in_progress';
  const submit = () => { const t = text.trim(); if (!t || !canSend) return; send(t); setText(''); };

  return (
    <View style={{ flex: 1, display: visible ? 'flex' : 'none', backgroundColor: c.bg }}>
      {connection !== 'online' ? <View style={{ backgroundColor: c.warnSoft, padding: 6 }}><T tiny center color={c.warn}>Reconnecting… messages will sync automatically.</T></View> : null}
      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(m) => m.key}
        contentContainerStyle={{ padding: 12, gap: 8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item: m }) => {
          if (m.kind === 'system') return <View style={{ alignSelf: 'center', backgroundColor: c.accentSoft, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 4, maxWidth: '92%' }}><T tiny center color={c.text2}>{m.content}</T></View>;
          const mine = m.senderUserId === myUserId;
          return (
            <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%', alignItems: mine ? 'flex-end' : 'flex-start' }}>
              <View style={{ backgroundColor: mine ? c.primary : c.surface, borderRadius: 18, borderBottomRightRadius: mine ? 4 : 18, borderBottomLeftRadius: mine ? 18 : 4, paddingHorizontal: 13, paddingVertical: 9, opacity: m.pending ? 0.6 : 1, borderWidth: mine ? 0 : 1, borderColor: c.border }}>
                <T color={mine ? c.onPrimary : c.text}>{m.content}</T>
              </View>
              {m.failed ? <Pressable onPress={() => retry(m)} hitSlop={8}><T tiny color={c.bad}>Failed — tap to retry</T></Pressable>
                : <T tiny muted>{m.pending ? 'Sending…' : fmtTime(m.createdAt)}{mine && !m.pending ? (m.readAt ? '  ✓✓' : '  ✓') : ''}</T>}
            </View>
          );
        }}
        ListFooterComponent={typing ? <T small muted style={{ padding: 6 }}>typing…</T> : null}
      />
      <View style={{ flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.surface, alignItems: 'flex-end' }}>
        <TextInput
          value={text}
          onChangeText={(v) => { setText(v); if (Date.now() - lastTyping.current > 2000) { lastTyping.current = Date.now(); notifyTyping(); } }}
          placeholder={canSend ? placeholder : (disabledReason || 'Chat opens when the session starts')}
          placeholderTextColor={c.muted}
          editable={canSend}
          multiline
          maxLength={4000}
          accessibilityLabel="Message"
          onSubmitEditing={Platform.OS === 'web' ? submit : undefined}
          style={{ flex: 1, maxHeight: 120, minHeight: 44, borderRadius: 22, borderWidth: 1, borderColor: c.border, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 16, color: c.text, backgroundColor: c.bg }}
        />
        <Button title="Send" onPress={submit} disabled={!canSend || !text.trim()} style={{ borderRadius: 22 }} />
      </View>
    </View>
  );
}
