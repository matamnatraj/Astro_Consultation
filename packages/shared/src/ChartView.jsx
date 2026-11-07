import { useState } from 'react';
import { Tabs, Badge } from './ui.jsx';
import { fmtDate, fmtDateTime } from './format.js';

const ABBR = { Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke' };
const SIGN_ABBR = ['Ar', 'Ta', 'Ge', 'Cn', 'Le', 'Vi', 'Li', 'Sc', 'Sg', 'Cp', 'Aq', 'Pi'];
const SIGN_GLYPH = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];

function planetsBySign(output) {
  const map = Array.from({ length: 12 }, () => []);
  for (const p of output.planets) map[p.signIndex].push(p);
  return map;
}

const label = (p) => `${ABBR[p.name] || p.name}${p.retrograde && !['Rahu', 'Ketu'].includes(p.name) ? 'ᴿ' : ''}`;

// ───────── North Indian (houses fixed, signs rotate) ─────────
const NI_HOUSES = [
  [[200, 200], [100, 100], [200, 0], [300, 100]],
  [[0, 0], [200, 0], [100, 100]],
  [[0, 0], [100, 100], [0, 200]],
  [[0, 200], [100, 100], [200, 200], [100, 300]],
  [[0, 200], [100, 300], [0, 400]],
  [[0, 400], [100, 300], [200, 400]],
  [[200, 400], [100, 300], [200, 200], [300, 300]],
  [[200, 400], [300, 300], [400, 400]],
  [[400, 400], [300, 300], [400, 200]],
  [[400, 200], [300, 300], [200, 200], [300, 100]],
  [[400, 200], [300, 100], [400, 0]],
  [[400, 0], [300, 100], [200, 0]],
];
const centroid = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

function NorthIndian({ output }) {
  const bySign = planetsBySign(output);
  const asc = output.ascendant.signIndex;
  return (
    <svg viewBox="-4 -4 408 408" className="chart-svg" role="img" aria-label="North Indian birth chart">
      <rect x="0" y="0" width="400" height="400" className="chart-frame" />
      <path d="M0 0L400 400M400 0L0 400M200 0L400 200L200 400L0 200Z" className="chart-line" />
      {NI_HOUSES.map((poly, i) => {
        const sign = (asc + i) % 12;
        const [cx, cy] = centroid(poly);
        const planets = bySign[sign];
        const kite = poly.length === 4;
        // Sign number sits near the house's inner vertex (centre for kites, interior point for triangles).
        const inner = kite ? [200, 200] : poly.find(([x, y]) => x % 400 !== 0 && y % 400 !== 0);
        const sx = inner[0] + (cx - inner[0]) * 0.25;
        const sy = inner[1] + (cy - inner[1]) * 0.25;
        return (
          <g key={i}>
            <polygon points={poly.map((p) => p.join(',')).join(' ')} className={`chart-house ${i === 0 ? 'asc' : ''}`}><title>{`House ${i + 1}: ${output.houses[i].sign}`}</title></polygon>
            <text x={sx} y={sy} className="chart-sign" textAnchor="middle" dominantBaseline="middle">{sign + 1}</text>
            {planets.map((p, k) => {
              const cols = planets.length > 3 ? 2 : 1;
              const row = cols === 2 ? Math.floor(k / 2) : k;
              const col = cols === 2 ? k % 2 : 0;
              const rows = Math.ceil(planets.length / cols);
              const x = cx + (cols === 2 ? (col ? 17 : -17) : 0);
              const y = cy + (kite ? -6 : 0) + (row - (rows - 1) / 2) * 15;
              return <text key={p.name} x={x} y={y} className={`chart-planet ${p.retrograde && !['Rahu', 'Ketu'].includes(p.name) ? 'retro' : ''}`} textAnchor="middle" dominantBaseline="middle">{label(p)}<title>{`${p.name} ${p.dms} ${p.sign}${p.retrograde ? ' (retrograde)' : ''}`}</title></text>;
            })}
            {i === 0 && <text x={200} y={34} className="chart-asc" textAnchor="middle">Asc</text>}
          </g>
        );
      })}
    </svg>
  );
}

// ───────── South Indian (signs fixed, ascendant marked) ─────────
const SI_CELLS = [[1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3], [0, 2], [0, 1], [0, 0]]; // Aries..Pisces
function SouthIndian({ output }) {
  const bySign = planetsBySign(output);
  const asc = output.ascendant.signIndex;
  return (
    <svg viewBox="-4 -4 408 408" className="chart-svg" role="img" aria-label="South Indian birth chart">
      {SI_CELLS.map(([c, r], sign) => {
        const x = c * 100; const y = r * 100;
        return (
          <g key={sign}>
            <rect x={x} y={y} width="100" height="100" className={`chart-house ${sign === asc ? 'asc' : ''}`}><title>{output.houses.find((h) => h.signIndex === sign) ? `${SIGN_ABBR[sign]} — house ${((sign - asc + 12) % 12) + 1}` : ''}</title></rect>
            <text x={x + 6} y={y + 14} className="chart-sign">{SIGN_ABBR[sign]}</text>
            {sign === asc && <><line x1={x} y1={y + 22} x2={x + 22} y2={y} className="chart-line" /><text x={x + 94} y={y + 14} textAnchor="end" className="chart-asc">Asc</text></>}
            {bySign[sign].map((p, k) => (
              <text key={p.name} x={x + (k % 2 ? 72 : 30)} y={y + 40 + Math.floor(k / 2) * 18} textAnchor="middle"
                className={`chart-planet ${p.retrograde && !['Rahu', 'Ketu'].includes(p.name) ? 'retro' : ''}`}>{label(p)}<title>{`${p.name} ${p.dms}`}</title></text>
            ))}
          </g>
        );
      })}
      <rect x="100" y="100" width="200" height="200" className="chart-center" />
      <text x="200" y="195" textAnchor="middle" className="chart-center-text">Rasi</text>
      <text x="200" y="215" textAnchor="middle" className="chart-center-sub">{output.system === 'vedic' ? 'Sidereal · Lahiri' : 'Tropical'}</text>
    </svg>
  );
}

// ───────── Western wheel ─────────
function Wheel({ output }) {
  const asc = output.ascendant.longitude;
  const pt = (lon, r) => { const a = Math.PI - ((lon - asc) * Math.PI) / 180; return [200 + r * Math.cos(a), 200 - r * Math.sin(a)]; };
  const placed = [...output.planets].sort((a, b) => a.longitude - b.longitude);
  let lastLon = -99; let ring = 0;
  return (
    <svg viewBox="0 0 400 400" className="chart-svg" role="img" aria-label="Zodiac wheel">
      <circle cx="200" cy="200" r="195" className="chart-frame" /><circle cx="200" cy="200" r="160" className="chart-line" /><circle cx="200" cy="200" r="70" className="chart-line" />
      {Array.from({ length: 12 }, (_, i) => {
        const [x1, y1] = pt(i * 30, 160); const [x2, y2] = pt(i * 30, 195); const [tx, ty] = pt(i * 30 + 15, 178);
        return <g key={i}><line x1={x1} y1={y1} x2={x2} y2={y2} className="chart-line" /><text x={tx} y={ty} className="chart-glyph" textAnchor="middle" dominantBaseline="middle">{SIGN_GLYPH[i]}</text></g>;
      })}
      {output.houses.map((h) => { const [x1, y1] = pt(h.cusp, 70); const [x2, y2] = pt(h.cusp, 160); return <line key={h.house} x1={x1} y1={y1} x2={x2} y2={y2} className={`chart-line ${h.house === 1 || h.house === 10 ? 'strong' : ''}`} />; })}
      {placed.map((p) => {
        ring = p.longitude - lastLon < 7 ? (ring + 1) % 3 : 0; lastLon = p.longitude;
        const [x, y] = pt(p.longitude, 140 - ring * 20);
        return <text key={p.name} x={x} y={y} textAnchor="middle" dominantBaseline="middle" className={`chart-planet ${p.retrograde && !['Rahu', 'Ketu'].includes(p.name) ? 'retro' : ''}`}>{label(p)}<title>{`${p.name} ${p.dms} ${p.sign}`}</title></text>;
      })}
      <text x="22" y="204" className="chart-asc">AC</text>
    </svg>
  );
}

export function ChartDiagram({ output, style }) {
  if (style === 'wheel') return <Wheel output={output} />;
  if (style === 'south_indian') return <SouthIndian output={output} />;
  return <NorthIndian output={output} />;
}

function PlanetTable({ output }) {
  return (
    <div className="table-wrap">
      <table className="table compact">
        <thead><tr><th>Body</th><th>Sign</th><th>Degree</th><th>Nakshatra</th><th>House</th></tr></thead>
        <tbody>
          <tr><td><strong>Ascendant</strong></td><td>{output.ascendant.sign}</td><td>{output.ascendant.dms}</td><td>{output.ascendant.nakshatra} {output.ascendant.pada}</td><td>1</td></tr>
          {output.planets.map((p) => (
            <tr key={p.name}><td>{p.name}{p.retrograde && !['Rahu', 'Ketu'].includes(p.name) && <span className="retro-tag" title="Retrograde"> R</span>}</td>
              <td>{p.sign}</td><td>{p.dms}</td><td>{p.nakshatra} {p.pada}</td><td>{p.house}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DashaTable({ dasha }) {
  if (!dasha) return <p className="muted">Dasha periods are available for Vedic charts.</p>;
  const now = Date.now();
  return (
    <div className="table-wrap">
      <p className="small muted">Vimshottari mahadasha · balance at birth {dasha.balanceAtBirthYears} years</p>
      <table className="table compact">
        <thead><tr><th>Lord</th><th>From</th><th>To</th></tr></thead>
        <tbody>
          {dasha.mahadashas.map((d) => {
            const current = new Date(d.start) <= now && now < new Date(d.end);
            return <tr key={d.lord + d.start} className={current ? 'row-current' : ''}><td>{d.lord}{current && <Badge tone="live">Current</Badge>}</td><td>{fmtDate(d.start)}</td><td>{fmtDate(d.end)}</td></tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Full chart panel: status (missing / stale / warnings), diagram with style
 * switcher, planet positions, dasha periods and calculation metadata.
 */
export function ChartView({ chart, birthProfile, availability, onRegenerate, regenerating, compact }) {
  const [tab, setTab] = useState('chart');
  const [style, setStyle] = useState(chart?.config?.chartStyle || 'north_indian');
  const state = availability || (chart ? chart.status : 'missing');

  if (!chart || !chart.output) {
    return (
      <div className="chart-panel">
        <div className="alert alert-warn">
          <div><strong>{state === 'failed' ? 'Chart could not be calculated' : 'No chart generated yet'}</strong>
            <div className="small">{birthProfile ? 'Birth details are on file.' : 'Birth details are missing.'}</div></div>
          {onRegenerate && birthProfile && <button className="btn btn-primary btn-sm" onClick={onRegenerate} disabled={regenerating}>{regenerating ? 'Generating…' : 'Generate chart'}</button>}
        </div>
      </div>
    );
  }
  const o = chart.output;
  return (
    <div className={`chart-panel ${compact ? 'compact' : ''}`}>
      {state === 'stale' && (
        <div className="alert alert-warn">
          <div><strong>Chart is out of date</strong><div className="small">Birth details changed after this chart was generated.</div></div>
          {onRegenerate && <button className="btn btn-primary btn-sm" onClick={onRegenerate} disabled={regenerating}>{regenerating ? 'Generating…' : 'Regenerate'}</button>}
        </div>
      )}
      {chart.warnings?.map((w) => <div key={w.code} className="alert alert-info small">⚠ {w.message}</div>)}
      <div className="chart-summary">
        <div><span>Lagna</span><strong>{o.summary.lagna}</strong>{!o.ascendant.reliable && <em className="small"> (uncertain)</em>}</div>
        <div><span>Moon sign</span><strong>{o.summary.moonSign}</strong></div>
        <div><span>Sun sign</span><strong>{o.summary.sunSign}</strong></div>
        <div><span>Nakshatra</span><strong>{o.summary.janmaNakshatra}</strong></div>
      </div>
      <div className="row between wrap gap-s">
        <Tabs value={tab} onChange={setTab} tabs={[{ value: 'chart', label: 'Chart' }, { value: 'planets', label: 'Planets' }, ...(o.dasha ? [{ value: 'dasha', label: 'Dasha' }] : [])]} />
        {tab === 'chart' && (
          <select value={style} onChange={(e) => setStyle(e.target.value)} aria-label="Chart style" className="select-sm">
            <option value="north_indian">North Indian</option><option value="south_indian">South Indian</option><option value="wheel">Wheel</option>
          </select>
        )}
      </div>
      {tab === 'chart' && <div className="chart-diagram"><ChartDiagram output={o} style={style} /></div>}
      {tab === 'planets' && <PlanetTable output={o} />}
      {tab === 'dasha' && <DashaTable dasha={o.dasha} />}
      <details className="chart-meta small muted">
        <summary>Calculation details</summary>
        <div>System: {o.system}{o.ayanamsa ? ` · Ayanamsa ${o.ayanamsa.name} ${o.ayanamsa.degrees}°` : ''} · Houses: {o.houseSystem.replace('_', ' ')}</div>
        <div>Input: {chart.inputSnapshot.birthDate} {chart.inputSnapshot.birthTime || '(time unknown)'} · {chart.inputSnapshot.placeName} ({chart.inputSnapshot.latitude.toFixed(3)}, {chart.inputSnapshot.longitude.toFixed(3)}) · {chart.inputSnapshot.tzName} (UTC{chart.inputSnapshot.utcOffsetMinutes >= 0 ? '+' : '−'}{Math.floor(Math.abs(chart.inputSnapshot.utcOffsetMinutes) / 60)}:{String(Math.abs(chart.inputSnapshot.utcOffsetMinutes) % 60).padStart(2, '0')})</div>
        <div>Engine: {chart.engine.name} v{chart.engine.version} · Generated {fmtDateTime(chart.generatedAt)} · Profile v{chart.birthProfileVersion}</div>
      </details>
    </div>
  );
}
