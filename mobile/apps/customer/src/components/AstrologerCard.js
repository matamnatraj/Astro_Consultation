import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Card, T, Row, Avatar, Stars, Chips, Chip, Button, Badge, rupees, useTheme } from '@astro/mobile-core';

export function AstrologerCard({ a }) {
  const c = useTheme();
  return (
    <Card>
      <Pressable onPress={() => router.push(`/astrologer/${a.astrologerId}`)} accessibilityRole="link" accessibilityLabel={`${a.displayName} profile`}>
      <Row style={{ alignItems: 'flex-start' }}>
        <View>
          <Avatar name={a.displayName} size={54} />
          {a.isOnline ? <View style={{ position: 'absolute', right: 0, bottom: 0, width: 14, height: 14, borderRadius: 7, backgroundColor: c.ok, borderWidth: 2, borderColor: c.surface }} /> : null}
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <T bold size={16}>{a.displayName}</T>
          <T small muted>{a.experienceYears} yrs · {a.languages.join(', ')}</T>
          <Row gap={6}><Stars value={a.ratingAvg} size={13} /><T tiny muted>{a.ratingCount ? `${a.ratingAvg.toFixed(1)} (${a.ratingCount})` : 'New'}</T></Row>
        </View>
      </Row>
      </Pressable>
      <Chips>{a.specialties.slice(0, 4).map((s) => <Chip key={s} label={s} />)}</Chips>
      <Row style={{ justifyContent: 'space-between' }}>
        <T><T bold>{rupees(a.rates.chat)}</T><T small muted>/min</T></T>
        <Row gap={8}>
          {a.isBusy ? <Badge tone="warn" label="In session" /> : null}
          {a.isOnline && !a.isBusy ? <Button size="sm" title="Chat now" onPress={() => router.push(`/book/${a.astrologerId}?type=instant`)} /> : null}
          <Button size="sm" variant="secondary" title="Schedule" onPress={() => router.push(`/book/${a.astrologerId}?type=scheduled`)} />
        </Row>
      </Row>
    </Card>
  );
}
