import { useState } from 'react';
import { Alert, Platform, ScrollView, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useAuth, useAsync, useConsultation, ChatPane, SessionTimer, ChartView, Tabs, Button, Row, T, Notice, Loading, ErrorBox, Screen, useTheme } from '@astro/mobile-core';

export default function ConsultationRoom() {
  const { id } = useLocalSearchParams();
  const { api } = useAuth();
  const c = useTheme();
  const session = useConsultation(id);
  const chart = useAsync(() => api.get(`/consultations/${id}/client-chart`), [id], { refocus: false });
  const [view, setView] = useState('chat');
  const [busy, setBusy] = useState(false);
  const k = session.consultation;
  if (session.error) return <Screen><ErrorBox error={session.error} /></Screen>;
  if (!k) return <Loading />;

  const end = () => {
    const go = async () => { setBusy(true); try { session.setConsultation(await api.post(`/consultations/${id}/end`)); } catch (e) { Alert.alert('Could not end', e.message); } finally { setBusy(false); } };
    const msg = `You'll be charged for ${session.timer?.billedMinutes || 1} started minute(s). Unused amount is released.`;
    if (Platform.OS === 'web') go(); else Alert.alert('End consultation?', msg, [{ text: 'Keep chatting', style: 'cancel' }, { text: 'End session', style: 'destructive', onPress: go }]);
  };
  const waiting = { requested: 'Waiting for the astrologer to accept…', accepted: 'Accepted. The session opens at the scheduled time.', ready: 'The astrologer will start the session shortly. Stay on this screen.' }[k.status];

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ title: k.astrologer.name }} />
      <Row style={{ padding: 10, backgroundColor: c.surface, borderBottomWidth: 1, borderColor: c.border, justifyContent: 'space-between' }}>
        <SessionTimer session={session} />
        {k.status === 'in_progress' ? <Button size="sm" variant="danger" title="End" loading={busy} onPress={end} /> : null}
      </Row>
      <Tabs value={view} onChange={setView} tabs={[{ value: 'chat', label: `Chat${view !== 'chat' && session.unread ? ` • ${session.unread}` : ''}` }, { value: 'chart', label: 'My chart' }]} />
      {waiting ? <View style={{ padding: 10 }}><Notice tone="info">{waiting}</Notice></View> : null}
      {/* Both panes stay mounted: switching tabs never resets the chat, timer or connection. */}
      <ChatPane session={session} visible={view === 'chat'} disabledReason={k.status === 'completed' ? 'This consultation has ended' : undefined} />
      <ScrollView style={{ flex: 1, display: view === 'chart' ? 'flex' : 'none' }} contentContainerStyle={{ padding: 16 }}>
        {chart.loading ? <Loading /> : chart.error ? <ErrorBox error={chart.error} /> : <ChartView chart={chart.data.chart} birthProfile={chart.data.birthProfile} availability={chart.data.availability} />}
      </ScrollView>
    </View>
  );
}
