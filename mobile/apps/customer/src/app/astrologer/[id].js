import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth, useAsync, Screen, Card, T, H1, Row, Avatar, Stars, Chips, Chip, Badge, Button, Loading, ErrorBox, rupees, fmtDate, useTheme } from '@astro/mobile-core';

export default function AstrologerDetail() {
  const { id } = useLocalSearchParams();
  const { api } = useAuth();
  const c = useTheme();
  const { data: a, loading, error, reload, refresh, refreshing } = useAsync(() => api.get(`/astrologers/${id}`), [id]);
  if (loading) return <Loading />;
  if (error) return <Screen><ErrorBox error={error} onRetry={reload} /></Screen>;
  return (
    <Screen onRefresh={refresh} refreshing={refreshing}
      footer={<View style={{ padding: 16, gap: 8, backgroundColor: c.surface, borderTopWidth: 1, borderColor: c.border }}>
        {a.isOnline && !a.isBusy ? <Button size="lg" title={`Chat now · ${rupees(a.rates.chat)}/min`} onPress={() => router.push(`/book/${a.astrologerId}?type=instant`)} /> : null}
        <Button size="lg" variant={a.isOnline && !a.isBusy ? 'secondary' : 'primary'} title="Schedule a session" onPress={() => router.push(`/book/${a.astrologerId}?type=scheduled`)} />
      </View>}>
      <Row style={{ alignItems: 'flex-start' }}>
        <Avatar name={a.displayName} size={72} />
        <View style={{ flex: 1, gap: 4 }}>
          <H1>{a.displayName}</H1>
          <T muted small>{a.experienceYears} years · {a.languages.join(', ')}</T>
          <Row gap={6}><Stars value={a.ratingAvg} /><T small muted>{a.ratingCount ? `${a.ratingAvg.toFixed(1)} (${a.ratingCount})` : 'No reviews yet'}</T></Row>
          {a.isOnline ? (a.isBusy ? <Badge tone="warn" label="In a session" /> : <Badge tone="ok" label="Online now" />) : <Badge tone="muted" label="Offline" />}
        </View>
      </Row>
      <Card><T>{a.bio}</T></Card>
      <Card title="Specialties"><Chips>{a.specialties.map((s) => <Chip key={s} label={s} />)}</Chips>
        {a.services.length ? <><T small bold>Services</T><Chips>{a.services.map((s) => <Chip key={s} label={s} />)}</Chips></> : null}
      </Card>
      <Card title="Rates">{a.modes.map((m) => <Row key={m} style={{ justifyContent: 'space-between' }}><T>{m[0].toUpperCase() + m.slice(1)}</T><T bold>{rupees(a.rates[m])}/min</T></Row>)}
        <T tiny muted>You pay only for minutes used, up to the duration you book. {a.slots.length} open slots in the next 14 days.</T>
      </Card>
      <Card title={`Reviews (${a.reviews.length})`}>
        {!a.reviews.length ? <T small muted>No reviews yet.</T> : a.reviews.map((r, i) => (
          <View key={i} style={{ gap: 3, paddingVertical: 6 }}>
            <Row gap={6}><Stars value={r.rating} size={13} /><T small bold>{r.reviewer}</T><T tiny muted>{fmtDate(r.created_at)}</T></Row>
            {r.comment ? <T small>{r.comment}</T> : null}
          </View>
        ))}
      </Card>
    </Screen>
  );
}
