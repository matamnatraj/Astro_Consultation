import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAuth, useAsync, Screen, Card, T, Row, Chips, Chip, Button, Badge, ErrorBox, Loading, useToast, fmtTime, useTheme, useT } from '@astro/mobile-core';

const TIMES = Array.from({ length: 33 }, (_, i) => { const m = 6 * 60 + i * 30; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }); // 06:00–22:00

export default function Availability() {
  const { api } = useAuth();
  const c = useTheme();
  const t = useT();
  const slots = useAsync(() => api.get('/astrologer/me/availability'), []);
  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d; }), []);
  const [day, setDay] = useState(1);
  const [start, setStart] = useState('10:00');
  const [end, setEnd] = useState('13:00');
  const [len, setLen] = useState(30);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [toast, show] = useToast();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const grouped = useMemo(() => {
    const m = new Map();
    for (const s of slots.data || []) {
      const d = new Date(s.startAt).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
      if (!m.has(d)) m.set(d, []);
      m.get(d).push(s);
    }
    return [...m.entries()];
  }, [slots.data]);

  const add = async () => {
    setBusy(true); setErr(null);
    try {
      const at = (hhmm) => { const d = new Date(days[day]); const [h, m] = hhmm.split(':').map(Number); d.setHours(h, m, 0, 0); return d.toISOString(); };
      const created = await api.post('/astrologer/me/availability', { startAt: at(start), endAt: at(end), slotMinutes: len });
      show(t('av.added', { n: created.length })); slots.reload();
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const remove = async (s) => { try { await api.del(`/astrologer/me/availability/${s.slotId}`); slots.reload(); } catch (e) { show(e.message, 'bad'); } };

  return (
    <>
      <Screen onRefresh={slots.refresh} refreshing={slots.refreshing}>
        <Card title={t('av.add')}>
          <T tiny muted>{t('av.tz', { tz })}</T>
          <ErrorBox error={err} />
          <T small bold>{t('av.day')}</T>
          <Chips>{days.map((d, i) => <Chip key={i} label={i === 0 ? t('av.today') : i === 1 ? t('av.tomorrow') : d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' })} active={day === i} onPress={() => setDay(i)} />)}</Chips>
          <T small bold>{t('av.from')}</T>
          <Chips>{TIMES.slice(0, -1).map((tm) => <Chip key={tm} label={tm} active={start === tm} onPress={() => { setStart(tm); if (end <= tm) setEnd(TIMES[TIMES.indexOf(tm) + 2] || TIMES.at(-1)); }} />)}</Chips>
          <T small bold>{t('av.to')}</T>
          <Chips>{TIMES.filter((tm) => tm > start).map((tm) => <Chip key={tm} label={tm} active={end === tm} onPress={() => setEnd(tm)} />)}</Chips>
          <T small bold>{t('av.length')}</T>
          <Chips>{[15, 30, 45, 60].map((m) => <Chip key={m} label={t('common.min', { n: m })} active={len === m} onPress={() => setLen(m)} />)}</Chips>
          <Button title={t('av.addSlots', { from: start, to: end })} loading={busy} onPress={add} />
        </Card>
        {slots.loading ? <Loading /> : grouped.map(([d, list]) => (
          <Card key={d} title={d}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {list.map((s) => (
                <View key={s.slotId} style={{ borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 8, gap: 4, minWidth: 104 }}>
                  <T small bold>{fmtTime(s.startAt)}–{fmtTime(s.endAt)}</T>
                  <Row gap={6}><Badge status={s.status === 'open' ? 'draft' : s.status === 'booked' ? 'confirmed' : 'pending_payment'} label={s.status} />
                    {s.status === 'open' ? <Pressable onPress={() => remove(s)} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove slot"><T tiny color={c.bad}>{t('av.remove')}</T></Pressable> : null}</Row>
                </View>
              ))}
            </View>
          </Card>
        ))}
      </Screen>
      {toast}
    </>
  );
}
