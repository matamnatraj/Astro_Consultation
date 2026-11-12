import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import {
  useAuth, useConsultation, ChatPane, SessionTimer, ChartView, Tabs, Button, Badge, Card, Row, T, Notice, KV, Sheet, Field,
  Loading, ErrorBox, Screen, useToast, fmtDateTime, fmtTime, rupees, titleCase, useTheme, useT,
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
  const t = useT();
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

  const confirm = (title, msg, go) => (Platform.OS === 'web' ? go() : Alert.alert(title, msg, [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.ok'), style: 'destructive', onPress: go }]));
  const action = async (name, body) => {
    setBusy(name);
    try { session.setConsultation(await api.post(`/consultations/${id}/${name}`, body)); } catch (e) { show(e.message, 'bad'); } finally { setBusy(null); }
  };
  const generate = async () => {
    setGenerating(true);
    try { await api.post(`/consultations/${id}/client-chart/generate`); await loadChart(); show(t('ws.regenerated')); } catch (e) { show(e.message, 'bad'); } finally { setGenerating(false); }
  };
  const bp = chartState.data?.birthProfile;

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{
        title: k.client.name || t('common.client'),
        headerRight: () => (
          <Pressable onPress={() => canAccessChart && setView(view === 'chart' ? 'chat' : 'chart')} disabled={!canAccessChart} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('ws.birthChart')} accessibilityState={{ selected: view === 'chart', disabled: !canAccessChart }}
            style={{ backgroundColor: view === 'chart' ? c.primary : c.primarySoft, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, opacity: canAccessChart ? 1 : 0.4 }}>
            <Text style={{ color: view === 'chart' ? c.onPrimary : c.primary, fontWeight: '700' }}>☉ {t('ws.birthChart')}</Text>
          </Pressable>
        ),
      }} />
      <View style={{ padding: 10, gap: 8, backgroundColor: c.surface, borderBottomWidth: 1, borderColor: c.border }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <SessionTimer session={session} />
          <Button size="sm" variant="ghost" title={t('ws.notes')} disabled={!canAccessChart} onPress={() => setNotesOpen(true)} />
        </Row>
        <T tiny muted>{t(`type.${k.bookingType}`)} · {rupees(k.ratePaise)}/min · {t('common.upTo', { n: k.durationMinutes })}{k.scheduledAt ? ` · ${fmtDateTime(k.scheduledAt)}` : ''}</T>
        {k.status === 'requested' ? (
          <Row>
            <Button style={{ flex: 1 }} variant="secondary" title={t('common.decline')} loading={busy === 'reject'} onPress={() => confirm(t('ws.declineQ'), t('dash.notCharged'), () => action('reject', { reason: 'The astrologer is unavailable' }))} />
            <Button style={{ flex: 1 }} title={t('common.accept')} loading={busy === 'accept'} onPress={() => action('accept')} />
          </Row>
        ) : null}
        {k.status === 'accepted' ? <Badge status="accepted" label={t('ws.acceptedStarts', { time: fmtTime(k.scheduledAt) })} /> : null}
        {k.status === 'ready' ? <Button title={t('ws.start')} loading={busy === 'start'} onPress={() => action('start')} /> : null}
        {k.status === 'in_progress' ? <Button variant="danger" title={t('ws.end')} loading={busy === 'end'} onPress={() => confirm(t('ws.endQ'), t('ws.billed', { n: session.timer?.billedMinutes || 1 }), () => action('end'))} /> : null}
      </View>
      <Tabs value={view} onChange={setView} tabs={[{ value: 'chat', label: `${t('ws.chat')}${view !== 'chat' && session.unread ? ` • ${t('common.new', { n: session.unread })}` : ''}` }, { value: 'chart', label: t('ws.birthChart') }]} />
      {view === 'chat' && k.status === 'ready' ? <View style={{ padding: 10 }}><Notice tone="info">{t('ws.ready')}</Notice></View> : null}

      <ChatPane session={session} visible={view === 'chat'} placeholder={t('ws.reply')} disabledReason={k.status === 'ready' ? t('ws.startToChat') : k.status === 'completed' ? t('ws.ended') : undefined} />
      <ScrollView style={{ flex: 1, display: view === 'chart' ? 'flex' : 'none' }} contentContainerStyle={{ padding: 14, gap: 12 }}>
        {!canAccessChart ? <Notice tone="info">{t('ws.chartAfterAccept')}</Notice>
          : chartState.loading && !chartState.data ? <Loading label={t('ws.loadingChart')} />
            : chartState.error ? <ErrorBox error={chartState.error} onRetry={loadChart} />
              : (
                <>
                  {summary ? (
                    <Card title={t('ws.summary')} right={<Button size="sm" variant="ghost" title={summaryOpen ? t('ws.hide') : t('ws.show')} onPress={() => setSummaryOpen(!summaryOpen)} />}>
                      {summaryOpen ? (
                        <KV rows={[
                          [t('ws.name'), `${bp.fullName}${summary.gender ? ` · ${titleCase(summary.gender)}` : ''}`],
                          [t('ws.born'), <Row key="b" gap={6} wrap><T small>{bp.birthDate} {bp.birthTime?.slice(0, 5) || t('ws.timeUnknown')}</T><Badge tone={bp.timeAccuracy === 'exact' ? 'ok' : 'warn'} label={bp.timeAccuracy} /></Row>],
                          [t('ws.place'), bp.placeName],
                          summary.topic && [t('ws.topic'), summary.topic],
                          [t('ws.language'), summary.preferredLanguage],
                          [t('ws.history'), summary.previousConsultationsWithYou.length ? t('ws.prev', { n: summary.previousConsultationsWithYou.length }) : t('ws.first')],
                        ]} />
                      ) : null}
                    </Card>
                  ) : null}
                  <ChartView chart={chartState.data.chart} birthProfile={bp} availability={chartState.data.availability} onRegenerate={chartState.data.canGenerate ? generate : undefined} regenerating={generating} />
                  <T tiny muted>{t('ws.logged')}</T>
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
  const t = useT();
  const [notes, setNotes] = useState(null);
  const [body, setBody] = useState('');
  const [err, setErr] = useState(null);
  useEffect(() => { api.get(`/consultations/${id}/notes`).then(setNotes).catch(setErr); }, [api, id]);
  const add = async () => { try { const n = await api.post(`/consultations/${id}/notes`, { body }); setNotes([...(notes || []), n]); setBody(''); } catch (e) { setErr(e); } };
  return (
    <Sheet visible onClose={onClose} title={t('ws.privateNotes')} footer={<><Field placeholder={t('ws.addNote')} value={body} onChangeText={setBody} multiline /><Button title={t('ws.saveNote')} disabled={!body.trim()} onPress={add} /></>}>
      <T tiny muted>{t('ws.notesNote')}</T>
      <ErrorBox error={err} />
      {notes?.map((n) => <Card key={n.note_id}><T small>{n.body}</T><T tiny muted>{fmtDateTime(n.created_at)}</T></Card>)}
    </Sheet>
  );
}
