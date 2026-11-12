import { useState } from 'react';
import { Alert, Platform, Switch, View } from 'react-native';
import { router } from 'expo-router';
import { useAuth, useAsync, useNow, useRealtimeEvent, useRealtimeStatus, Screen, Card, T, H1, Row, Button, Badge, Notice, Stat, Avatar, ListItem, Empty, Loading, useToast, rupees, fmtDateTime, mmss, useTheme, useT } from '@astro/mobile-core';

export default function Dashboard() {
  const { api } = useAuth();
  const c = useTheme();
  const t = useT();
  const me = useAsync(() => api.get('/astrologer/me'), []);
  const queue = useAsync(() => api.get('/consultations?status=requested,accepted,ready,in_progress'), []);
  const earnings = useAsync(() => api.get('/astrologer/me/earnings'), []);
  const news = useAsync(() => api.get('/content/announcements'), []);
  const conn = useRealtimeStatus();
  const now = useNow();
  const [busy, setBusy] = useState(null);
  const [toast, show] = useToast();
  useRealtimeEvent((ev) => {
    if (ev.type === 'consultation.request') { queue.reload(); show(t('dash.newRequest'), 'info'); }
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
    if (action === 'reject' && Platform.OS !== 'web') Alert.alert(t('dash.declineQ'), t('dash.notCharged'), [{ text: t('common.cancel'), style: 'cancel' }, { text: t('common.decline'), style: 'destructive', onPress: go }]);
    else go();
  };

  return (
    <>
      <Screen onRefresh={() => { me.refresh(); queue.refresh(); earnings.refresh(); }} refreshing={queue.refreshing}>
        <H1>{t('dash.welcome', { name: a.displayName.split(' ')[0] })}</H1>
        {approved ? (
          <Card>
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <T bold>{a.isOnline ? t('dash.online') : t('dash.offline')}</T>
                <T small muted>{conn === 'online' ? t('dash.keepOpen') : t('dash.connecting')}</T>
              </View>
              <Switch value={a.isOnline} onValueChange={toggleOnline} trackColor={{ true: c.ok, false: c.border }} accessibilityLabel={t('dash.onlineStatus')} />
            </Row>
          </Card>
        ) : (
          <Notice tone={['rejected', 'suspended'].includes(a.verificationStatus) ? 'bad' : 'warn'} action={<Button size="sm" title={t('dash.goProfile')} onPress={() => router.push('/profile')} style={{ alignSelf: 'flex-start' }} />}>
            {`${t('dash.verification', { status: a.verificationStatus })} ${a.verificationStatus === 'submitted' ? t('dash.reviewing') : t('dash.complete')}${a.verificationNotes ? `\n${t('dash.reviewer', { notes: a.verificationNotes })}` : ''}`}
          </Notice>
        )}
        {news.data?.map((n) => <Notice key={n.announcement_id} tone="info">{`${n.title}: ${n.body}`}</Notice>)}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <Stat label={t('dash.requests')} value={requests.length} tone={requests.length ? 'warn' : undefined} />
          <Stat label={t('dash.upcoming')} value={upcoming.length} />
          <Stat label={t('dash.rating')} value={a.ratingCount ? a.ratingAvg.toFixed(1) : '—'} sub={t('dash.reviews', { n: a.ratingCount })} />
          <Stat label={t('dash.eligible')} value={rupees(earnings.data?.summary.eligible)} sub={t('dash.onHold', { amt: rupees(earnings.data?.summary.on_hold) })} />
        </View>
        <Card title={<Row gap={6}><T bold size={16}>{t('dash.incoming')}</T>{requests.length ? <Badge tone="live" label={String(requests.length)} /> : null}</Row>}>
          {queue.loading ? <Loading /> : !requests.length ? <Empty icon="☾" title={t('dash.noPending')}>{a.isOnline ? t('dash.notified') : t('dash.goOnline')}</Empty> : requests.map((k) => {
            const left = Math.max(0, Math.floor((new Date(k.acceptDeadline) - now) / 1000));
            return (
              <View key={k.consultationId} style={{ gap: 8, paddingVertical: 8, borderBottomWidth: 1, borderColor: c.border }}>
                <Row style={{ alignItems: 'flex-start' }}>
                  <Avatar name={k.client.name || t('common.client')} size={40} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Row gap={6}><T bold>{k.client.name || t('common.client')}</T><Badge tone={k.bookingType === 'instant' ? 'live' : 'info'} label={t(`type.${k.bookingType}`)} /></Row>
                    <T small muted>{k.bookingType === 'scheduled' ? fmtDateTime(k.scheduledAt) : t('dash.now')} · {t('common.upTo', { n: k.durationMinutes })} · {rupees(k.ratePaise)}/min</T>
                    {k.topic ? <T small>“{k.topic}”</T> : null}
                    <T tiny color={left < 60 ? c.bad : c.muted}>{t('dash.respond', { t: mmss(left) })}</T>
                  </View>
                </Row>
                <Row>
                  <Button style={{ flex: 1 }} variant="secondary" title={t('common.decline')} loading={busy === k.consultationId + 'reject'} onPress={() => act(k, 'reject')} />
                  <Button style={{ flex: 1 }} title={t('common.accept')} loading={busy === k.consultationId + 'accept'} onPress={() => act(k, 'accept')} />
                </Row>
              </View>
            );
          })}
        </Card>
        <Card title={t('dash.live')}>
          {!upcoming.length ? <T small muted>{t('dash.nothing')}</T> : upcoming.map((k, i) => (
            <ListItem key={k.consultationId} last={i === upcoming.length - 1} left={<Avatar name={k.client.name || t('common.client')} size={40} />}
              title={<Row gap={6}><T bold>{k.client.name}</T><Badge status={k.status} /></Row>}
              subtitle={`${k.bookingType === 'scheduled' ? fmtDateTime(k.scheduledAt) : t('type.instant')} · ${t('common.upTo', { n: k.durationMinutes })}`}
              onPress={() => router.push(`/consultation/${k.consultationId}`)} right={<T bold color={c.primary}>{k.status === 'in_progress' ? t('dash.resume') : t('dash.open')}</T>} />
          ))}
        </Card>
        <Button variant="ghost" title={t('nav.support')} onPress={() => router.push('/support')} />
      </Screen>
      {toast}
    </>
  );
}
