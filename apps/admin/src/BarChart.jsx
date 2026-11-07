import { useState } from 'react';

/** Single-series bar chart: one axis, thin bars with 4px rounded tops, hover tooltip, table fallback. */
export default function BarChart({ data, x, y, format = (v) => v, label }) {
  const [hover, setHover] = useState(null);
  const W = 560; const H = 140; const pad = { l: 4, r: 4, t: 10, b: 18 };
  const max = Math.max(1, ...data.map((d) => Number(d[y])));
  const slot = (W - pad.l - pad.r) / data.length;
  const bw = Math.max(4, slot - 2); // 2px surface gap between bars
  const h = (v) => ((H - pad.t - pad.b) * Number(v)) / max;
  return (
    <div className="bars">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
        <line x1={pad.l} x2={W - pad.r} y1={H - pad.b} y2={H - pad.b} className="axis" />
        {data.map((d, i) => {
          const bx = pad.l + i * slot + (slot - bw) / 2;
          const bh = h(d[y]);
          const by = H - pad.b - bh;
          const r = Math.min(4, bw / 2, bh);
          const path = bh > 0 ? `M${bx},${H - pad.b}V${by + r}Q${bx},${by} ${bx + r},${by}H${bx + bw - r}Q${bx + bw},${by} ${bx + bw},${by + r}V${H - pad.b}Z` : '';
          return (
            <g key={d[x]} onMouseEnter={() => setHover({ i, left: ((bx + bw / 2) / W) * 100, top: (by / H) * 100 })} onMouseLeave={() => setHover(null)}>
              <rect className="bar-hit" x={pad.l + i * slot} y={pad.t} width={slot} height={H - pad.t - pad.b} />
              {path && <path className="bar" d={path} />}
              {(i === 0 || i === data.length - 1 || i % 7 === 0) && <text className="tick" x={bx + bw / 2} y={H - 4} textAnchor="middle">{String(d[x]).slice(5)}</text>}
            </g>
          );
        })}
      </svg>
      {hover && <div className="bars-tip" style={{ left: `${hover.left}%`, top: `${hover.top}%` }}>{data[hover.i][x]}: <strong>{format(data[hover.i][y])}</strong></div>}
      <details className="tiny muted"><summary>Table view</summary>
        <table className="table compact"><tbody>{data.map((d) => <tr key={d[x]}><td>{d[x]}</td><td className="right">{format(d[y])}</td></tr>)}</tbody></table>
      </details>
    </div>
  );
}
