import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useAuth, useAsync, Screen, Card, T, Button, Chips, Chip, Badge, ListItem, ChartView, Loading, ErrorBox, useToast, fmtDateTime, KV } from '@astro/mobile-core';

export default function ChartScreen() {
  const { birthProfileId } = useLocalSearchParams();
  const { api } = useAuth();
  const profile = useAsync(() => api.get(`/clients/me/birth-profiles/${birthProfileId}`), [birthProfileId]);
  const charts = useAsync(() => api.get(`/clients/me/charts?birthProfileId=${birthProfileId}`), [birthProfileId]);
  const [selected, setSelected] = useState(null);
  const [system, setSystem] = useState('vedic');
  const [busy, setBusy] = useState(false);
  const [toast, show] = useToast();
  if (profile.loading || charts.loading) return <Loading />;
  if (profile.error) return <Screen><ErrorBox error={profile.error} /></Screen>;
  const latest = charts.data.find((x) => x.status !== 'failed');
  const chart = selected ? charts.data.find((x) => x.chartId === selected) : latest;
  const regenerate = async () => {
    setBusy(true);
    try { await api.post('/clients/me/charts/generate', { birthProfileId, config: { system } }); await charts.reload(); setSelected(null); show('New chart generated'); } catch (e) { show(e.message, 'bad'); } finally { setBusy(false); }
  };
  const p = profile.data;
  return (
    <>
      <Screen onRefresh={charts.refresh} refreshing={charts.refreshing}>
        <T bold size={20}>{p.fullName}</T>
        <T muted small>{p.birthDate} · {p.birthTime?.slice(0, 5) || 'time unknown'} · {p.placeName}</T>
        {chart?.output ? (
          <Card title="Basic Details">
            <KV rows={[
              ['Name', p.fullName], ['Date', p.birthDate], ['Time', p.birthTime ? p.birthTime.slice(0, 5) : 'Unknown'], ['Place', p.placeName],
              ['Latitude', p.latitude.toFixed(4)], ['Longitude', p.longitude.toFixed(4)], ['Timezone', `${p.tzName} (GMT${p.tzOffsetMinutes >= 0 ? '+' : '-'}${Math.abs(p.tzOffsetMinutes) / 60})`],
              chart.output.ayanamsa && ['Ayanamsa', `${chart.output.ayanamsa.name} ${chart.output.ayanamsa.degrees}°`],
              ['Ascendant', chart.output.summary.lagna], ['Moon sign', chart.output.summary.moonSign], ['Sun sign', chart.output.summary.sunSign], ['Nakshatra', chart.output.summary.janmaNakshatra],
            ]} />
          </Card>
        ) : null}
        <ChartView chart={chart} birthProfile={p} availability={chart?.status} onRegenerate={regenerate} regenerating={busy} />
        <Card title="Generate a new version">
          <Chips>{[['vedic', 'Vedic (Lahiri)'], ['western', 'Western']].map(([v, l]) => <Chip key={v} label={l} active={system === v} onPress={() => setSystem(v)} />)}</Chips>
          <Button title="Generate" loading={busy} onPress={regenerate} />
          <T tiny muted>Each version stores the exact inputs and engine version. Older versions are kept.</T>
        </Card>
        <Card title="Chart history">
          {charts.data.map((x, i) => (
            <ListItem key={x.chartId} last={i === charts.data.length - 1} onPress={() => setSelected(x.chartId)}
              title={`${x.config.system === 'vedic' ? 'Vedic' : 'Western'} · profile v${x.birthProfileVersion}`} subtitle={fmtDateTime(x.generatedAt)}
              right={<Badge status={x.status} label={(selected || latest?.chartId) === x.chartId ? `● ${x.status}` : undefined} />} />
          ))}
        </Card>
      </Screen>
      {toast}
    </>
  );
}
