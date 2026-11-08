import { router } from 'expo-router';
import { useAuth, useAsync, useRealtimeEvent, Screen, H1, H2, T, Card, Button, Badge, Notice, Loading, Empty, ListItem, Avatar, Row, fmtDateTime } from '@astro/mobile-core';
import { AstrologerCard } from '../../components/AstrologerCard.js';

export default function Home() {
  const { api, me } = useAuth();
  const profile = useAsync(() => api.get('/clients/me'), []);
  const astros = useAsync(() => api.get('/astrologers?sort=rating'), []);
  const banners = useAsync(() => api.get('/content/announcements'), []);
  const active = useAsync(() => api.get('/consultations?status=requested,accepted,ready,in_progress'), []);
  useRealtimeEvent((ev) => { if (ev.type === 'notification') active.reload(); });
  const refresh = () => { profile.refresh(); astros.refresh(); banners.refresh(); active.refresh(); };
  const first = (me.user.displayName || '').split(' ')[0];

  return (
    <Screen onRefresh={refresh} refreshing={astros.refreshing}>
      <H1>Namaste{first ? `, ${first}` : ''} 🙏</H1>
      <T muted>Consult verified astrologers with your saved birth chart.</T>
      {banners.data?.filter((b) => b.kind === 'banner').map((b) => <Notice key={b.announcement_id} tone="info">{`${b.title} — ${b.body}`}</Notice>)}
      {profile.data && !profile.data.profileComplete ? (
        <Card>
          <T bold>Complete your profile</T>
          <T small muted>Add your birth details once — astrologers see your chart automatically in every consultation.</T>
          <Button title="Add birth details" onPress={() => router.push('/birth-profile/new')} />
        </Card>
      ) : null}
      {active.data?.length ? (
        <Card title="Active consultations">
          {active.data.map((k, i) => (
            <ListItem key={k.consultationId} last={i === active.data.length - 1} left={<Avatar name={k.astrologer.name} size={40} />}
              title={<Row gap={6}><T bold>{k.astrologer.name}</T><Badge status={k.status} /></Row>}
              subtitle={`${k.bookingType === 'scheduled' ? fmtDateTime(k.scheduledAt) : 'Instant'} · ${k.durationMinutes} min`}
              onPress={() => router.push(['ready', 'in_progress'].includes(k.status) ? `/consultation/${k.consultationId}` : `/booking/${k.bookingId}`)}
              right={<T bold color="#4b3fb5">{k.status === 'in_progress' ? 'Open ›' : k.status === 'ready' ? 'Join ›' : '›'}</T>} />
          ))}
        </Card>
      ) : null}
      <Row style={{ justifyContent: 'space-between' }}><H2>Top astrologers</H2><Button variant="ghost" size="sm" title="See all" onPress={() => router.push('/astrologers')} /></Row>
      {astros.loading ? <Loading /> : !astros.data?.length ? <Empty title="No astrologers yet" /> : astros.data.slice(0, 5).map((a) => <AstrologerCard key={a.astrologerId} a={a} />)}
    </Screen>
  );
}
