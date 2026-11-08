import { useEffect, useRef, useState } from 'react';
import { FlatList, Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from './auth.js';
import { useAsync } from './hooks.js';
import { useRealtimeEvent } from './realtime.js';
import { useTheme } from './theme.js';
import { fmtDateTime, timeAgo, titleCase } from './format.js';
import { T, H2, Screen, Card, Button, Badge, Field, Sheet, ErrorBox, Loading, Empty, ListItem, Chips, Chip, useToast, Check } from './ui.js';

const CATEGORIES = ['booking', 'payment', 'refund', 'consultation_quality', 'technical', 'account', 'complaint', 'other'];

/** Help & support: assistant entry, tickets, FAQs. */
export function SupportScreen({ audience = 'customers', bookingId: initialBookingId }) {
  const { api } = useAuth();
  const c = useTheme();
  const tickets = useAsync(() => api.get('/support/tickets'), []);
  const faqs = useAsync(() => api.get(`/content/faqs?audience=${audience}`), []);
  const [newOpen, setNewOpen] = useState(Boolean(initialBookingId));
  const [openFaq, setOpenFaq] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [toast, show] = useToast();
  return (
    <>
      <Screen onRefresh={() => { tickets.refresh(); faqs.refresh(); }} refreshing={tickets.refreshing}>
        <Card onPress={() => router.push('/assistant')}>
          <T bold>Ask the help assistant</T>
          <T small muted>Automated answers about bookings, payments and the app — or hand over to a human.</T>
        </Card>
        <Card title="Your tickets" right={<Button size="sm" title="New ticket" onPress={() => setNewOpen(true)} />}>
          {tickets.loading ? <Loading /> : !tickets.data?.length ? <T muted small>No tickets yet.</T> : tickets.data.map((t, i) => (
            <ListItem key={t.ticket_id} last={i === tickets.data.length - 1} onPress={() => setTicket(t.ticket_id)}
              title={`#${t.ticket_number} ${t.subject}`} subtitle={`${titleCase(t.category)} · ${fmtDateTime(t.created_at)}`} right={<Badge status={t.status} />} />
          ))}
        </Card>
        <Card title="Frequently asked questions">
          {faqs.data?.map((f) => (
            <Pressable key={f.faq_id} onPress={() => setOpenFaq(openFaq === f.faq_id ? null : f.faq_id)} style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: c.border }} accessibilityRole="button">
              <T bold small>{f.question}</T>
              {openFaq === f.faq_id ? <T small muted style={{ marginTop: 6 }}>{f.answer}</T> : null}
            </Pressable>
          ))}
        </Card>
      </Screen>
      <NewTicketSheet visible={newOpen} bookingId={initialBookingId} onClose={() => setNewOpen(false)} onCreated={(t) => { setNewOpen(false); tickets.reload(); show(`Ticket #${t.ticket_number} created`); }} />
      {ticket ? <TicketSheet id={ticket} onClose={() => setTicket(null)} /> : null}
      {toast}
    </>
  );
}

function NewTicketSheet({ visible, onClose, onCreated, bookingId }) {
  const { api } = useAuth();
  const [f, setF] = useState({ category: bookingId ? 'booking' : 'other', subject: '', description: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const submit = async () => {
    setBusy(true); setErr(null);
    try { onCreated(await api.post('/support/tickets', { ...f, bookingId: bookingId || undefined })); setF({ ...f, subject: '', description: '' }); } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title="New support ticket" footer={<Button title="Submit" loading={busy} disabled={f.subject.length < 3 || f.description.length < 5} onPress={submit} />}>
      <ErrorBox error={err} />
      <T small bold>Category</T>
      <Chips>{CATEGORIES.map((x) => <Chip key={x} label={titleCase(x)} active={f.category === x} onPress={() => setF({ ...f, category: x })} />)}</Chips>
      <Field label="Subject" value={f.subject} onChangeText={(v) => setF({ ...f, subject: v })} />
      <Field label="Describe the issue" value={f.description} onChangeText={(v) => setF({ ...f, description: v })} multiline />
    </Sheet>
  );
}

function TicketSheet({ id, onClose }) {
  const { api } = useAuth();
  const t = useAsync(() => api.get(`/support/tickets/${id}`), [id], { refocus: false });
  const [reply, setReply] = useState('');
  const send = async () => { await api.post(`/support/tickets/${id}/messages`, { body: reply }); setReply(''); t.reload(); };
  return (
    <Sheet visible onClose={onClose} title={t.data ? `#${t.data.ticket_number} ${t.data.subject}` : 'Ticket'}
      footer={t.data ? <View style={{ flexDirection: 'row', gap: 8 }}><Field style={{ flex: 1 }} placeholder="Add a reply" value={reply} onChangeText={setReply} /><Button title="Send" disabled={!reply.trim()} onPress={send} /></View> : null}>
      {!t.data ? <Loading /> : (
        <>
          <Badge status={t.data.status} />
          <T small>{t.data.description}</T>
          {t.data.messages.map((m) => <Card key={m.ticket_message_id}><T tiny muted>{m.author_kind === 'staff' ? 'Support' : 'You'} · {fmtDateTime(m.created_at)}</T><T small>{m.body}</T></Card>)}
          {t.data.resolution ? <Badge tone="ok" label={`Resolved: ${t.data.resolution}`} /> : null}
        </>
      )}
    </Sheet>
  );
}

/** Automated support assistant — labelled as AI, grounded answers, human handoff with consent. */
export function AssistantScreen() {
  const { api } = useAuth();
  const c = useTheme();
  const [intro, setIntro] = useState(null);
  const [log, setLog] = useState([]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [handoff, setHandoff] = useState(false);
  const [share, setShare] = useState(true);
  const listRef = useRef();
  useEffect(() => { api.get('/assistant/intro').then(setIntro).catch(() => {}); }, [api]);
  const ask = async () => {
    const q = text.trim(); if (!q) return;
    setText(''); setBusy(true); setLog((l) => [...l, { from: 'user', text: q }]);
    try { const r = await api.post('/assistant/message', { message: q }); setLog((l) => [...l, { from: 'assistant', text: r.reply, suggestHandoff: r.suggestHandoff }]); } catch (e) { setLog((l) => [...l, { from: 'assistant', text: e.message }]); } finally { setBusy(false); }
  };
  const doHandoff = async () => {
    setBusy(true);
    try {
      const r = await api.post('/assistant/handoff', { summary: (log.find((m) => m.from === 'user')?.text || 'Help requested via assistant').slice(0, 300), transcript: log.map(({ from, text: t }) => ({ from, text: t })), shareTranscript: share });
      setLog((l) => [...l, { from: 'assistant', text: r.reply }]); setHandoff(false);
    } catch (e) { setLog((l) => [...l, { from: 'assistant', text: e.message }]); } finally { setBusy(false); }
  };
  const data = [{ from: 'assistant', text: intro?.disclosure || 'Loading…', key: 'intro' }, ...log.map((m, i) => ({ ...m, key: String(i) }))];
  return (
    <Screen scroll={false} padded={false}>
      <View style={{ padding: 10, backgroundColor: c.infoSoft }}><T tiny center color={c.info}>{intro?.label || 'Automated assistant (AI)'}</T></View>
      <FlatList ref={listRef} data={data} keyExtractor={(m) => m.key} contentContainerStyle={{ padding: 12, gap: 8 }} onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item: m }) => (
          <View style={{ alignSelf: m.from === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%', gap: 4 }}>
            <View style={{ backgroundColor: m.from === 'user' ? c.primary : c.surface, borderRadius: 16, padding: 11, borderWidth: m.from === 'user' ? 0 : 1, borderColor: c.border }}>
              <T color={m.from === 'user' ? c.onPrimary : c.text}>{m.text}</T>
            </View>
            {m.suggestHandoff ? <Button variant="ghost" size="sm" title="Talk to a human" onPress={() => setHandoff(true)} style={{ alignSelf: 'flex-start' }} /> : null}
          </View>
        )}
        ListFooterComponent={handoff ? (
          <Card style={{ marginTop: 8 }}>
            <Check checked={share} onChange={setShare} label="Share this conversation with the support agent" />
            <Button title="Create support ticket" loading={busy} onPress={doHandoff} />
          </Card>
        ) : null}
      />
      <View style={{ flexDirection: 'row', gap: 8, padding: 10, borderTopWidth: 1, borderColor: c.border, backgroundColor: c.surface }}>
        <TextInput value={text} onChangeText={setText} placeholder="Ask about bookings, payments, the app…" placeholderTextColor={c.muted} accessibilityLabel="Ask the assistant" onSubmitEditing={ask} returnKeyType="send" maxLength={500}
          style={{ flex: 1, borderWidth: 1, borderColor: c.border, borderRadius: 22, paddingHorizontal: 16, minHeight: 44, fontSize: 16, color: c.text, backgroundColor: c.bg }} />
        <Button title="Ask" loading={busy} onPress={ask} style={{ borderRadius: 22 }} />
      </View>
      <View style={{ alignItems: 'center', paddingBottom: 6, backgroundColor: c.surface }}><Button variant="ghost" size="sm" title="Talk to a human" onPress={() => setHandoff(true)} /></View>
    </Screen>
  );
}

/** In-app notification inbox; `routeFor(n)` maps a notification to a screen. */
export function NotificationsScreen({ routeFor = () => null }) {
  const { api } = useAuth();
  const c = useTheme();
  const n = useAsync(() => api.get('/notifications'), []);
  useRealtimeEvent((ev) => { if (ev.type === 'notification') n.setData((d) => ({ items: [ev.notification, ...(d?.items || [])], unreadCount: (d?.unreadCount || 0) + 1 })); });
  const open = (item) => {
    if (!item.read_at) api.post(`/notifications/${item.notification_id}/read`).catch(() => {});
    n.setData((d) => ({ ...d, items: d.items.map((x) => (x === item ? { ...x, read_at: new Date().toISOString() } : x)) }));
    const to = routeFor(item); if (to) router.push(to);
  };
  if (n.loading) return <Loading />;
  return (
    <Screen padded={false} scroll={false}>
      <FlatList data={n.data?.items || []} keyExtractor={(x) => x.notification_id} onRefresh={n.refresh} refreshing={n.refreshing}
        ListHeaderComponent={n.data?.unreadCount ? <View style={{ padding: 12, alignItems: 'flex-end' }}><Button variant="ghost" size="sm" title="Mark all read" onPress={async () => { await api.post('/notifications/read-all'); n.reload(); }} /></View> : null}
        ListEmptyComponent={<Empty title="You're all caught up" />}
        renderItem={({ item }) => (
          <Pressable onPress={() => open(item)} style={{ padding: 14, borderBottomWidth: 1, borderColor: c.border, backgroundColor: item.read_at ? c.surface : c.primarySoft }}>
            <T bold>{item.title}</T><T small color={c.text2}>{item.body}</T><T tiny muted>{timeAgo(item.created_at)}</T>
          </Pressable>
        )} />
    </Screen>
  );
}

/** Badge count for the notifications icon. */
export function useUnreadNotifications() {
  const { api } = useAuth();
  const [count, setCount] = useState(0);
  useEffect(() => { api.get('/notifications').then((d) => setCount(d.unreadCount)).catch(() => {}); }, [api]);
  useRealtimeEvent((ev) => { if (ev.type === 'notification') setCount((x) => x + 1); });
  return [count, setCount];
}

export { H2 };
