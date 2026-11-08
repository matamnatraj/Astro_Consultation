import { useState } from 'react';
import { Alert, Platform, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth, useAsync, useNow, useRealtimeEvent, useRealtimeStatus, Screen, Card, T, H1, Row, Button, Badge, Notice, Stat, Avatar, ListItem, Empty, Loading, useToast, rupees, fmtDateTime, mmss, useTheme } from '@astro/mobile-core';

export default function Dashboard() {
  const { api } = useAuth();
  const c = useTheme();
  const me = useAsync(() => api.get('/astrologer/me'), []);
  const queue = useAsync(() => api.get('/consultations?status=requested,accepted,ready,in_progress'), []);
  const earnings = useAsync(() => api.get('/astrologer/me/earnings'), []);
  const news = useAsync(() => api.get('/content/announcements'), []);
  const conn = useRealtimeStatus();
  const now = useNow();
  const [busy, setBusy] = useState(null);
  const [toast, show] = useToast();
  useRealtimeEvent((ev) => {
    if (ev.type === 'consultation.request') { queue.reload(); show('New consultation request!', 'info'); }
    if (ev.type === 'notification' && ev.notification.data?.consultationId) queue.reload();
  });
  if (me.loading) return <Loading />;
  const a = me.data;
  const approved = a.verificationStatus === 'approved';
  const requests = (queue.data || []).filter((k) => k.status === 'requested');
  const upcoming = (queue.data || []).filter((k) => k.status !== 'requested');

  const toggleOnline = async (v) => {
    try { const r = await api.put('/astrologer/me/online', { isOnline: v }); me.setData({ ...a, isOnline: r.isOnline }); } catch (e) { show(e.message, 'bad'); }
  };
  const act = async (k, action) => {
    const go = async () => {
      setBusy(k.consultationId + action);
      try {
        const r = await api.post(`/consultations/${k.consultationId}/${action}`, action === 'reject' ? { reason: 'The astrologer is unavailable right now' } : undefined);
        queue.reload();
        if (action === 'accept' && r.status === 'ready') router.push(`/consultation/${k.consultationId}`);
      } catch (e) { show(e.message, 'bad'); queue.reload(); } finally { setBusy(null); }
    };
    if (action === 'reject' && Platform.OS !== 'web') Alert.alert('Decline this request?', 'The client is not charged.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Decline', style: 'destructive', onPress: go }]);
    else go();
  };

  return (
    <>
      <Screen onRefresh={() => { me.refresh(); queue.refresh(); earnings.refresh(); }} refreshing={queue.refreshing}>
        <H1>Welcome, {a.displayName.split(' ')[0]}</H1>
        {approved ? (
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <T bold>{a.isOnline ? 'Online — accepting requests' : 'Offline'}</T>
                <T small muted>{conn === 'online' ? 'Keep the app open to receive instant requests.' : 'Connecting…'}</T>
              </View>
              <Switch value={a.isOnline} onValueChange={toggleOnline} trackColor={{ true: c.ok, false: c.border }} accessibilityLabel="Online status" />
            </Row>
          </Card>
        ) : (
          <Notice tone={['rejected', 'suspended'].includes(a.verificationStatus) ? 'bad' : 'warn'} action={<Button size="sm" title="Go to profile" onPress={() => router.push('/profile')} style={{ alignSelf: 'flex-start' }} />}>
            {`Verification: ${a.verificationStatus}. ${a.verificationStatus === 'submitted' ? 'Our team is reviewing your profile.' : 'Complete your profile, upload ID and submit for verification.'}${a.verificationNotes ? `\nReviewer: ${a.verificationNotes}` : ''}`}
          </Notice>
        )}
        {news.data?.map((n) => <Notice key={n.announcement_id} tone="info">{`${n.title}: ${n.body}`}</Notice>)}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Stat label="Requests" value={requests.length} tone={requests.length ? 'warn' : undefined} />
          <Stat label="Upcoming" value={upcoming.length} />
          <Stat label="Rating" value={a.ratingCount ? a.ratingAvg.toFixed(1) : '—'} sub={`${a.ratingCount} reviews`} />
          <Stat label="Eligible payout" value={rupees(earnings.data?.summary.eligible)} sub={`${rupees(earnings.data?.summary.on_hold)} on hold`} />
        </View>
        <Card title={<Row gap={6}><T bold size={16}>Incoming requests</T>{requests.length ? <Badge tone="live" label={String(requests.length)} /> : null}</Row>}>
          {queue.loading ? <Loading /> : !requests.length ? <Empty icon="☾" title="No pending requests">{a.isOnline ? 'You will be notified instantly.' : 'Go online to receive instant requests.'}</Empty> : requests.map((k) => {
            const left = Math.max(0, Math.floor((new Date(k.acceptDeadline) - now) / 1000));
            return (
              <View key={k.consultationId} style={{ gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderColor: c.border }}>
                <Row style={{ alignItems: 'flex-start' }}>
                  <Avatar name={k.client.name || 'Client'} size={40} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Row gap={6}><T bold>{k.client.name || 'Client'}</T><Badge tone={k.bookingType === 'instant' ? 'live' : 'info'} label={k.bookingType} /></Row>
                    <T small muted>{k.bookingType === 'scheduled' ? fmtDateTime(k.scheduledAt) : 'Now'} · up to {k.durationMinutes} min · {rupees(k.ratePaise)}/min</T>
                    {k.topic ? <T small>“{k.topic}”</T> : null}
                    <T tiny color={left < 60 ? c.bad : c.muted}>Respond within {mmss(left)}</T>
                  </View>
                </Row>
                <Row>
                  <Button style={{ flex: 1 }} variant="secondary" title="Decline" loading={busy === k.consultationId + 'reject'} onPress={() => act(k, 'reject')} />
                  <Button style={{ flex: 1 }} title="Accept" loading={busy === k.consultationId + 'accept'} onPress={() => act(k, 'accept')} />
                </Row>
              </View>
            );
          })}
        </Card>
        <Card title="Accepted & live">
          {!upcoming.length ? <T small muted>Nothing scheduled.</T> : upcoming.map((k, i) => (
            <ListItem key={k.consultationId} last={i === upcoming.length - 1} left={<Avatar name={k.client.name || 'Client'} size={40} />}
              title={<Row gap={6}><T bold>{k.client.name}</T><Badge status={k.status} /></Row>}
              subtitle={`${k.bookingType === 'scheduled' ? fmtDateTime(k.scheduledAt) : 'Instant'} · up to ${k.durationMinutes} min`}
              onPress={() => router.push(`/consultation/${k.consultationId}`)} right={<T bold color={c.primary}>{k.status === 'in_progress' ? 'Resume ›' : 'Open ›'}</T>} />
          ))}
        </Card>
        <Button variant="ghost" title="Help & support" onPress={() => router.push('/support')} />
      </Screen>
      {toast}
    </>
  );
}
