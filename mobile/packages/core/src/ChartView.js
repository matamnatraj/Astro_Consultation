import { useState } from 'react';
import { View, useWindowDimensions } from 'react-native';
import Svg, { Polygon, Line, Rect, Text as SvgText, G, Circle, Path } from 'react-native-svg';
import { useTheme } from './theme.js';
import { T, Button, Notice, Badge, Chips, Chip, Tabs } from './ui.js';
import { fmtDate, fmtDateTime } from './format.js';

const ABBR = { Sun: 'Su', Moon: 'Mo', Mars: 'Ma', Mercury: 'Me', Jupiter: 'Ju', Venus: 'Ve', Saturn: 'Sa', Rahu: 'Ra', Ketu: 'Ke' };
const SIGN_ABBR = ['Ar', 'Ta', 'Ge', 'Cn', 'Le', 'Vi', 'Li', 'Sc', 'Sg', 'Cp', 'Aq', 'Pi'];
const isRetro = (p) => p.retrograde && !['Rahu', 'Ketu'].includes(p.name);
const label = (p) => `${ABBR[p.name] || p.name}${isRetro(p) ? 'ᴿ' : ''}`;
const bySign = (o) => { const m = Array.from({ length: 12 }, () => []); for (const p of o.planets) m[p.signIndex].push(p); return m; };

const NI = [
  [[200, 200], [100, 100], [200, 0], [300, 100]], [[0, 0], [200, 0], [100, 100]], [[0, 0], [100, 100], [0, 200]],
  [[0, 200], [100, 100], [200, 200], [100, 300]], [[0, 200], [100, 300], [0, 400]], [[0, 400], [100, 300], [200, 400]],
  [[200, 400], [100, 300], [200, 200], [300, 300]], [[200, 400], [300, 300], [400, 400]], [[400, 400], [300, 300], [400, 200]],
  [[400, 200], [300, 300], [200, 200], [300, 100]], [[400, 200], [300, 100], [400, 0]], [[400, 0], [300, 100], [200, 0]],
];
const centroid = (pts) => [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];

function NorthIndian({ o, c }) {
  const signs = bySign(o);
  const asc = o.ascendant.signIndex;
  return (
    <G>
      {NI.map((poly, i) => {
        const sign = (asc + i) % 12;
        const [cx, cy] = centroid(poly);
        const kite = poly.length === 4;
        const inner = kite ? [200, 200] : poly.find(([x, y]) => x % 400 !== 0 && y % 400 !== 0);
        const sx = inner[0] + (cx - inner[0]) * 0.25; const sy = inner[1] + (cy - inner[1]) * 0.25;
        const planets = signs[sign];
        const cols = planets.length > 3 ? 2 : 1; const rows = Math.ceil(planets.length / cols);
        return (
          <G key={i}>
            <Polygon points={poly.map((p) => p.join(',')).join(' ')} fill={i === 0 ? c.chartAsc : c.surface} stroke={c.chartLine} strokeWidth={1.5} />
            <SvgText x={sx} y={sy + 4} fontSize={13} fill={c.muted} fontWeight="600" textAnchor="middle">{String(sign + 1)}</SvgText>
            {planets.map((p, k) => {
              const row = cols === 2 ? Math.floor(k / 2) : k;
              const x = cx + (cols === 2 ? (k % 2 ? 18 : -18) : 0);
              const y = cy + (kite ? -6 : 0) + (row - (rows - 1) / 2) * 17 + 5;
              return <SvgText key={p.name} x={x} y={y} fontSize={15} fontWeight="700" fill={isRetro(p) ? c.live : c.text} textAnchor="middle">{label(p)}</SvgText>;
            })}
            {i === 0 ? <SvgText x={200} y={36} fontSize={12} fontWeight="800" fill={c.accent} textAnchor="middle">ASC</SvgText> : null}
          </G>
        );
      })}
    </G>
  );
}

const SI = [[1, 0], [2, 0], [3, 0], [3, 1], [3, 2], [3, 3], [2, 3], [1, 3], [0, 3], [0, 2], [0, 1], [0, 0]];
function SouthIndian({ o, c }) {
  const signs = bySign(o);
  const asc = o.ascendant.signIndex;
  return (
    <G>
      {SI.map(([col, row], sign) => {
        const x = col * 100; const y = row * 100;
        return (
          <G key={sign}>
            <Rect x={x} y={y} width={100} height={100} fill={sign === asc ? c.chartAsc : c.surface} stroke={c.chartLine} strokeWidth={1.5} />
            <SvgText x={x + 6} y={y + 16} fontSize={12} fill={c.muted} fontWeight="600">{SIGN_ABBR[sign]}</SvgText>
            {sign === asc ? <><Line x1={x} y1={y + 24} x2={x + 24} y2={y} stroke={c.chartLine} strokeWidth={1.5} /><SvgText x={x + 94} y={y + 16} fontSize={11} fontWeight="800" fill={c.accent} textAnchor="end">ASC</SvgText></> : null}
            {signs[sign].map((p, k) => <SvgText key={p.name} x={x + (k % 2 ? 72 : 30)} y={y + 44 + Math.floor(k / 2) * 19} fontSize={15} fontWeight="700" textAnchor="middle" fill={isRetro(p) ? c.live : c.text}>{label(p)}</SvgText>)}
          </G>
        );
      })}
      <Rect x={100} y={100} width={200} height={200} fill={c.surface2} stroke={c.chartLine} />
      <SvgText x={200} y={196} fontSize={20} fontWeight="700" fill={c.primary} textAnchor="middle">Rasi</SvgText>
      <SvgText x={200} y={218} fontSize={12} fill={c.muted} textAnchor="middle">{o.system === 'vedic' ? 'Sidereal · Lahiri' : 'Tropical'}</SvgText>
    </G>
  );
}

const GLYPH = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'];
function Wheel({ o, c }) {
  const asc = o.ascendant.longitude;
  const pt = (lon, r) => { const a = Math.PI - ((lon - asc) * Math.PI) / 180; return [200 + r * Math.cos(a), 200 - r * Math.sin(a)]; };
  let last = -99; let ring = 0;
  return (
    <G>
      <Circle cx={200} cy={200} r={195} fill={c.surface} stroke={c.chartLine} strokeWidth={2} />
      <Circle cx={200} cy={200} r={160} fill="none" stroke={c.chartLine} />
      <Circle cx={200} cy={200} r={70} fill="none" stroke={c.chartLine} />
      {GLYPH.map((g, i) => {
        const [x1, y1] = pt(i * 30, 160); const [x2, y2] = pt(i * 30, 195); const [tx, ty] = pt(i * 30 + 15, 178);
        return <G key={i}><Line x1={x1} y1={y1} x2={x2} y2={y2} stroke={c.chartLine} /><SvgText x={tx} y={ty + 6} fontSize={16} fill={c.primary} textAnchor="middle">{g}</SvgText></G>;
      })}
      {o.houses.map((h) => { const [x1, y1] = pt(h.cusp, 70); const [x2, y2] = pt(h.cusp, 160); return <Line key={h.house} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c.chartLine} strokeWidth={h.house === 1 || h.house === 10 ? 2.5 : 1} />; })}
      {[...o.planets].sort((a, b) => a.longitude - b.longitude).map((p) => {
        ring = p.longitude - last < 7 ? (ring + 1) % 3 : 0; last = p.longitude;
        const [x, y] = pt(p.longitude, 140 - ring * 20);
        return <SvgText key={p.name} x={x} y={y + 5} fontSize={14} fontWeight="700" fill={isRetro(p) ? c.live : c.text} textAnchor="middle">{label(p)}</SvgText>;
      })}
      <SvgText x={22} y={205} fontSize={12} fontWeight="800" fill={c.accent}>AC</SvgText>
    </G>
  );
}

export function ChartDiagram({ output, style = 'north_indian' }) {
  const c = useTheme();
  const { width } = useWindowDimensions();
  const size = Math.min(width - 48, 440);
  return (
    <View style={{ alignItems: 'center' }} accessible accessibilityLabel={`Birth chart. Lagna ${output.summary.lagna}, Moon sign ${output.summary.moonSign}`}>
      <Svg width={size} height={size} viewBox="-4 -4 408 408">
        {style === 'wheel' ? <Wheel o={output} c={c} /> : style === 'south_indian' ? <SouthIndian o={output} c={c} /> : <NorthIndian o={output} c={c} />}
        {style === 'north_indian' ? <Path d="M0 0H400V400H0Z" fill="none" stroke={c.chartLine} strokeWidth={2.5} /> : null}
      </Svg>
    </View>
  );
}

function SummaryTiles({ o }) {
  const c = useTheme();
  const items = [['Lagna', o.summary.lagna + (o.ascendant.reliable ? '' : ' (uncertain)')], ['Moon sign', o.summary.moonSign], ['Sun sign', o.summary.sunSign], ['Nakshatra', o.summary.janmaNakshatra]];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {items.map(([k, v]) => (
        <View key={k} style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: c.surface, borderRadius: 10, borderWidth: 1, borderColor: c.border, padding: 10 }}>
          <T tiny muted bold>{k.toUpperCase()}</T><T bold>{v}</T>
        </View>
      ))}
    </View>
  );
}

function PlanetRows({ o }) {
  const c = useTheme();
  const rows = [{ name: 'Ascendant', ...o.ascendant, house: 1 }, ...o.planets];
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border }}>
      {rows.map((p, i) => (
        <View key={p.name} style={{ flexDirection: 'row', paddingVertical: 9, paddingHorizontal: 12, borderTopWidth: i ? 1 : 0, borderColor: c.border, gap: 8 }}>
          <T small bold style={{ width: 86 }}>{p.name}{isRetro(p) ? <T small bold color={c.live}> R</T> : null}</T>
          <T small style={{ width: 82 }}>{p.sign}</T>
          <T small style={{ width: 70 }}>{p.dms}</T>
          <T small muted style={{ flex: 1 }}>{p.nakshatra} {p.pada} · H{p.house}</T>
        </View>
      ))}
    </View>
  );
}

function DashaRows({ dasha }) {
  const c = useTheme();
  const now = Date.now();
  return (
    <View style={{ gap: 6 }}>
      <T small muted>Vimshottari mahadasha · balance at birth {dasha.balanceAtBirthYears} years</T>
      <View style={{ backgroundColor: c.surface, borderRadius: 12, borderWidth: 1, borderColor: c.border }}>
        {dasha.mahadashas.map((d, i) => {
          const current = new Date(d.start) <= now && now < new Date(d.end);
          return (
            <View key={d.lord + d.start} style={{ flexDirection: 'row', alignItems: 'center', padding: 10, borderTopWidth: i ? 1 : 0, borderColor: c.border, backgroundColor: current ? c.accentSoft : 'transparent', gap: 8 }}>
              <T small bold style={{ width: 70 }}>{d.lord}</T>
              <T small style={{ flex: 1 }}>{fmtDate(d.start)} – {fmtDate(d.end)}</T>
              {current ? <Badge tone="live" label="Current" /> : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Full chart panel: status, warnings, diagram + style switcher, planets, dasha, calculation details. */
export function ChartView({ chart, birthProfile, availability, onRegenerate, regenerating }) {
  const [tab, setTab] = useState('chart');
  const [style, setStyle] = useState(chart?.config?.chartStyle || 'north_indian');
  const [meta, setMeta] = useState(false);
  const state = availability || (chart ? chart.status : 'missing');
  if (!chart?.output) {
    return (
      <Notice tone="warn" action={onRegenerate && birthProfile ? <Button size="sm" title={regenerating ? 'Generating…' : 'Generate chart'} loading={regenerating} onPress={onRegenerate} style={{ alignSelf: 'flex-start' }} /> : null}>
        {state === 'failed' ? 'The chart could not be calculated.' : `No chart generated yet. ${birthProfile ? 'Birth details are on file.' : 'Birth details are missing.'}`}
      </Notice>
    );
  }
  const o = chart.output; const s = chart.inputSnapshot;
  return (
    <View style={{ gap: 12 }}>
      {state === 'stale' ? (
        <Notice tone="warn" action={onRegenerate ? <Button size="sm" title="Regenerate" loading={regenerating} onPress={onRegenerate} style={{ alignSelf: 'flex-start' }} /> : null}>
          Chart is out of date — birth details changed after it was generated.
        </Notice>
      ) : null}
      {chart.warnings?.map((w) => <Notice key={w.code} tone="info">{`⚠ ${w.message}`}</Notice>)}
      <SummaryTiles o={o} />
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'chart', label: 'Chart' }, { value: 'planets', label: 'Planets' }, ...(o.dasha ? [{ value: 'dasha', label: 'Dasha' }] : [])]} />
      {tab === 'chart' ? (
        <>
          <Chips>{[['north_indian', 'North Indian'], ['south_indian', 'South Indian'], ['wheel', 'Wheel']].map(([v, l]) => <Chip key={v} label={l} active={style === v} onPress={() => setStyle(v)} />)}</Chips>
          <ChartDiagram output={o} style={style} />
        </>
      ) : tab === 'planets' ? <PlanetRows o={o} /> : <DashaRows dasha={o.dasha} />}
      <Button variant="ghost" size="sm" title={meta ? 'Hide calculation details' : 'Calculation details'} onPress={() => setMeta(!meta)} style={{ alignSelf: 'flex-start' }} />
      {meta ? (
        <View style={{ gap: 4 }}>
          <T tiny muted>System: {o.system}{o.ayanamsa ? ` · Ayanamsa ${o.ayanamsa.name} ${o.ayanamsa.degrees}°` : ''} · Houses: {o.houseSystem.replace('_', ' ')}</T>
          <T tiny muted>Input: {s.birthDate} {s.birthTime || '(time unknown)'} · {s.placeName} ({s.latitude.toFixed(3)}, {s.longitude.toFixed(3)}) · {s.tzName}</T>
          <T tiny muted>Engine: {chart.engine.name} v{chart.engine.version} · Generated {fmtDateTime(chart.generatedAt)} · Profile v{chart.birthProfileVersion}</T>
        </View>
      ) : null}
    </View>
  );
}
