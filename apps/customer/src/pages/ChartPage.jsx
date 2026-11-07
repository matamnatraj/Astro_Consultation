import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth, useAsync, Card, ChartView, Spinner, ErrorBox, Badge, Button, fmtDateTime, useToast } from '@astro/shared';

export default function ChartPage() {
  const { birthProfileId } = useParams();
  const { api } = useAuth();
  const profile = useAsync(() => api.get(`/clients/me/birth-profiles/${birthProfileId}`), [birthProfileId]);
  const charts = useAsync(() => api.get(`/clients/me/charts?birthProfileId=${birthProfileId}`), [birthProfileId]);
  const [selected, setSelected] = useState(null);
  const [system, setSystem] = useState('vedic');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [toast, showToast] = useToast();

  if (profile.loading || charts.loading) return <Spinner />;
  if (profile.error) return <ErrorBox error={profile.error} />;
  const latest = charts.data.find((c) => c.status !== 'failed');
  const chart = selected ? charts.data.find((c) => c.chartId === selected) : latest;

  const regenerate = async () => {
    setBusy(true); setErr(null);
    try {
      const c = await api.post('/clients/me/charts/generate', { birthProfileId, config: { system } });
      await charts.reload(); setSelected(null); showToast('New chart generated');
      if (c.status === 'failed') setErr(new Error('Calculation failed. Please check the birth details.'));
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  return (
    <div className="layout-side">
      <div className="full"><Link to="/profile" className="small">← Profile</Link></div>
      <div className="stack" style={{ minWidth: 0 }}>
        <div className="page-head"><div><h1>{profile.data.fullName}'s chart</h1><p>{profile.data.birthDate} · {profile.data.birthTime?.slice(0, 5) || 'time unknown'} · {profile.data.placeName}</p></div></div>
        <ErrorBox error={err} />
        <Card><ChartView chart={chart} birthProfile={profile.data} availability={chart?.status} onRegenerate={regenerate} regenerating={busy} /></Card>
      </div>
      <div className="stack">
        <Card title="Generate">
          <div className="stack-s">
            <select value={system} onChange={(e) => setSystem(e.target.value)} aria-label="Astrology system">
              <option value="vedic">Vedic (sidereal, Lahiri)</option><option value="western">Western (tropical)</option>
            </select>
            <Button onClick={regenerate} loading={busy}>Generate new version</Button>
            <p className="tiny muted">Each version stores the exact inputs and engine version used. Older versions are kept.</p>
          </div>
        </Card>
        <Card title="Chart history">
          <div className="list">
            {charts.data.map((c) => (
              <button key={c.chartId} className="list-item link" style={{ color: 'inherit', textAlign: 'left', width: '100%' }} onClick={() => setSelected(c.chartId)}>
                <div className="grow"><div className="small"><strong>{c.config.system === 'vedic' ? 'Vedic' : 'Western'}</strong> · profile v{c.birthProfileVersion}</div><div className="tiny muted">{fmtDateTime(c.generatedAt)}</div></div>
                <Badge status={c.status} />{(selected || latest?.chartId) === c.chartId && <span className="tiny">●</span>}
              </button>
            ))}
          </div>
        </Card>
      </div>
      {toast}
    </div>
  );
}
