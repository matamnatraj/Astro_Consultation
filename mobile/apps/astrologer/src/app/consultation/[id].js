import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  useAuth, useConsultation, ChatPane, SessionTimer, ChartView, Tabs, Button, Badge, Card, Row, T, Notice, KV, Sheet, Field,
  Loading, ErrorBox, Screen, useToast, fmtDateTime, fmtTime, rupees, titleCase, useTheme,
} from '@astro/mobile-core';

/**
 * Astrologer consultation workspace (DPR §6, U4–U6):
 *  - Dedicated "Birth Chart" button in the header plus Chat / Birth Chart tabs.
 *  - Both panes stay mounted, so switching never resets the consultation, the realtime
 *    connection, unread state, the timer or billing.
 *  - The client's chart loads automatically by consultation ID; the API checks the
 *    assignment and logs every access.
 */
export default function Workspace() {
  const { id } = useLocalSearchParams();
  const { api } = useAuth();
  const c = useTheme();
  const session = useConsultation(id);
  const k = session.consultation;
  const [view, setView] = useState('chat');
  const [chartState, setChartState] = useState({ loading: true });
  const [summary, setSummary] = useState(null);
  const [summaryOpen, setSummaryOpen] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [busy, setBusy] = useState(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [toast, show] = useToast();

  const canAccessChart = k && ['accepted', 'ready', 'in_progress', 'completed'].includes(k.status);
  const loadChart = useCallback(async () => {
    setChartState((s) => ({ ...s, loading: true }));
    try {
      const [chart, sum] = await Promise.all([api.get(`/consultations/${id}/client-chart`), api.get(`/consultations/${id}/client-summary`)]);
      setChartState({ loading: false, data: chart }); setSummary(sum);
    } catch (e) { setChartState({ loading: false, error: e }); }
  }, [api, id]);
  useEffect(() => { if (canAccessChart) loadChart(); }, [canAccessChart, loadChart]);

  if (session.error) return <Screen><ErrorBox error={session.error} /></Screen>;
  if (!k) return <Loading />;

  const confirm = (title, msg, go) => (Platform.OS === 'web' ? go() : Alert.alert(title, msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'OK', style: 'destructive', onPress: go }]));
  const action = async (name, body) => {
    setBusy(name);
    try { session.setConsultation(await api.post(`/consultations/${id}/${name}`, body)); } catch (e) { show(e.message, 'bad'); } finally { setBusy(null); }
  };
  const generate = async () => {
    setGenerating(true);
    try { await api.post(`/consultations/${id}/client-chart/generate`); await loadChart(); show('Chart regenerated from current birth details'); } catch (e) { show(e.message, 'bad'); } finally { setGenerating(false); }
  };
  const bp = chartState.data?.birthProfile;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{
        title: k.client.name || 'Client',
        headerRight: () => (
          <Pressable onPress={() => canAccessChart && setView(view === 'chart' ? 'chat' : 'chart')} disabled={!canAccessChart} hitSlop={8} accessibilityRole="button" accessibilityLabel="Birth Chart" accessibilityState={{ selected: view === 'chart', disabled: !canAccessChart }}
            style={{ backgroundColor: view === 'chart' ? c.primary : c.primarySoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, opacity: canAccessChart ? 1 : 0.4 }}>
            <Text style={{ color: view === 'chart' ? c.onPrimary : c.primary, fontWeight: '700' }}>☉ Birth Chart</Text>
          </Pressable>
        ),
      }} />
      <View style={{ padding: 10, gap: 8, backgroundColor: c.surface, borderBottomWidth: 1, borderColor: c.border }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <SessionTimer session={session} />
          <Button size="sm" variant="ghost" title="Notes" disabled={!canAccessChart} onPress={() => setNotesOpen(true)} />
        </Row>
        <T tiny muted>{titleCase(k.bookingType)} · {rupees(k.ratePaise)}/min · up to {k.durationMinutes} min{k.scheduledAt ? ` · ${fmtDateTime(k.scheduledAt)}` : ''}</T>
        {k.status === 'requested' ? (
          <Row>
            <Button style={{ flex: 1 }} variant="secondary" title="Decline" loading={busy === 'reject'} onPress={() => confirm('Decline?', 'The client is not charged.', () => action('reject', { reason: 'The astrologer is unavailable' }))} />
            <Button style={{ flex: 1 }} title="Accept" loading={busy === 'accept'} onPress={() => action('accept')} />
          </Row>
        ) : null}
        {k.status === 'accepted' ? <Badge status="accepted" label={`Accepted · starts ${fmtTime(k.scheduledAt)}`} /> : null}
        {k.status === 'ready' ? <Button title="Start session" loading={busy === 'start'} onPress={() => action('start')} /> : null}
        {k.status === 'in_progress' ? <Button variant="danger" title="End session" loading={busy === 'end'} onPress={() => confirm('End this session?', `The client will be billed ${session.timer?.billedMinutes || 1} minute(s).`, () => action('end'))} /> : null}
      </View>
      <Tabs value={view} onChange={setView} tabs={[{ value: 'chat', label: `Chat${view !== 'chat' && session.unread ? ` • ${session.unread} new` : ''}` }, { value: 'chart', label: 'Birth Chart' }]} />
      {view === 'chat' && k.status === 'ready' ? <View style={{ padding: 10 }}><Notice tone="info">The client has been notified. Review the chart, then start the session — billing begins when you start.</Notice></View> : null}

      <ChatPane session={session} visible={view === 'chat'} placeholder="Reply to your client…" disabledReason={k.status === 'ready' ? 'Start the session to begin chatting' : k.status === 'completed' ? 'This consultation has ended' : undefined} />
      <ScrollView style={{ flex: 1, display: view === 'chart' ? 'flex' : 'none' }} contentContainerStyle={{ padding: 14, gap: 12 }}>
        {!canAccessChart ? <Notice tone="info">The client's birth chart becomes available once you accept this consultation.</Notice>
          : chartState.loading && !chartState.data ? <Loading label="Loading client chart…" />
            : chartState.error ? <ErrorBox error={chartState.error} onRetry={loadChart} />
              : (
                <>
                  {summary ? (
                    <Card title="Client summary" right={<Button size="sm" variant="ghost" title={summaryOpen ? 'Hide' : 'Show'} onPress={() => setSummaryOpen(!summaryOpen)} />}>
                      {summaryOpen ? (
                        <KV rows={[
                          ['Name', `${bp.fullName}${summary.gender ? ` · ${titleCase(summary.gender)}` : ''}`],
                          ['Born', <Row key="b" gap={6} wrap><T small>{bp.birthDate} {bp.birthTime?.slice(0, 5) || '(time unknown)'}</T><Badge tone={bp.timeAccuracy === 'exact' ? 'ok' : 'warn'} label={bp.timeAccuracy} /></Row>],
                          ['Place', bp.placeName],
                          summary.topic && ['Topic', summary.topic],
                          ['Language', summary.preferredLanguage],
                          ['History', summary.previousConsultationsWithYou.length ? `${summary.previousConsultationsWithYou.length} previous session(s) with you` : 'First session with you'],
                        ]} />
                      ) : null}
                    </Card>
                  ) : null}
                  <ChartView chart={chartState.data.chart} birthProfile={bp} availability={chartState.data.availability} onRegenerate={chartState.data.canGenerate ? generate : undefined} regenerating={generating} />
                  <T tiny muted>Access to this chart is limited to this consultation and is logged.</T>
                </>
              )}
      </ScrollView>
      {notesOpen ? <NotesSheet id={id} onClose={() => setNotesOpen(false)} /> : null}
      {toast}
    </View>
  );
}

function NotesSheet({ id, onClose }) {
  const { api } = useAuth();
  const [notes, setNotes] = useState(null);
  const [body, setBody] = useState('');
  const [err, setErr] = useState(null);
  useEffect(() => { api.get(`/consultations/${id}/notes`).then(setNotes).catch(setErr); }, [api, id]);
  const add = async () => { try { const n = await api.post(`/consultations/${id}/notes`, { body }); setNotes([...(notes || []), n]); setBody(''); } catch (e) { setErr(e); } };
  return (
    <Sheet visible onClose={onClose} title="Private notes" footer={<><Field placeholder="Add a note" value={body} onChangeText={setBody} multiline /><Button title="Save note" disabled={!body.trim()} onPress={add} /></>}>
      <T tiny muted>Visible only to you. Kept with the consultation record per the retention policy.</T>
      <ErrorBox error={err} />
      {notes?.map((n) => <Card key={n.note_id}><T small>{n.body}</T><T tiny muted>{fmtDateTime(n.created_at)}</T></Card>)}
    </Sheet>
  );
}
