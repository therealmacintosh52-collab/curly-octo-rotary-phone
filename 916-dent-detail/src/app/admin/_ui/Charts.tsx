// Dependency-free SVG charts (server-renderable). Gold = the measure, steel = a secondary/neutral series. Text always
// wears the ivory/steel text tokens, never the series colour. Every chart is role="img" with a title + description, has
// per-mark <title> hover text, direct value labels (selective) and a real data table in a <details> for screen readers.
import type { ReactNode } from 'react';

const GOLD = '#C9A24A';
const STEEL = '#8C8F96';
const INK = '#F3EEE3';
const MUTED = '#A9ACB3';
const GRID = '#2A2C31';

export type BarRow = { label: string; value: number; display: string; note?: string };

function DataTable({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <details className="mt-2">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm text-gold-light">View as table</summary>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Chart data table">
        <table className="adm-table">
          <thead><tr>{head.map((h, i) => <th key={h} className={i > 0 ? 'num' : ''}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j > 0 ? 'num' : ''}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
  );
}

let uid = 0;

/** Horizontal bars: magnitude by category. Negative values draw leftwards in steel. */
export function HBarChart({ title, desc, rows, valueHeader = 'Value', empty = 'No data in this range.' }: { title: string; desc: string; rows: BarRow[]; valueHeader?: string; empty?: string }) {
  const id = `hb${++uid}`;
  if (!rows.length) return <p className="text-sm text-[#a9acb3]">{empty}</p>;
  const W = 340, labelW = 112, valW = 64, rowH = 34, barH = 14, pad = 4;
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);
  const plotW = W - labelW - valW;
  const H = rows.length * rowH + pad * 2;
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t ${id}-d`} className="h-auto w-full">
        <title id={`${id}-t`}>{title}</title><desc id={`${id}-d`}>{desc}</desc>
        {rows.map((r, i) => {
          const y = pad + i * rowH;
          const w = Math.max(2, (Math.abs(r.value) / max) * plotW);
          return (
            <g key={r.label}>
              <title>{`${r.label}: ${r.display}${r.note ? ` (${r.note})` : ''}`}</title>
              <text x={0} y={y + rowH / 2 + 4} fontSize="12" fill={INK}>{r.label.length > 17 ? `${r.label.slice(0, 16)}…` : r.label}</text>
              <rect x={labelW} y={y + (rowH - barH) / 2} width={w} height={barH} rx={4} fill={r.value < 0 ? STEEL : GOLD} />
              <text x={W} y={y + rowH / 2 + 4} fontSize="12" textAnchor="end" fill={INK} style={{ fontVariantNumeric: 'tabular-nums' }}>{r.display}</text>
            </g>
          );
        })}
      </svg>
      <DataTable head={['Name', valueHeader]} rows={rows.map((r) => [r.label, r.display])} />
    </figure>
  );
}

export type ColSeries = { name: string; color: 'gold' | 'steel'; values: number[]; format: (n: number) => string };

/** Columns over time (weeks). Up to two series, grouped; 2px gap between marks; light gridlines; selective labels. */
export function ColumnChart({ title, desc, labels, series }: { title: string; desc: string; labels: string[]; series: ColSeries[] }) {
  const id = `cc${++uid}`;
  const W = 340, H = 170, left = 34, bottom = 22, top = 12;
  const n = labels.length;
  const max = Math.max(...series.flatMap((s) => s.values), 1);
  const nice = (() => { const p = 10 ** Math.floor(Math.log10(max)); const m = Math.ceil(max / p); return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; })();
  const plotW = W - left - 4, plotH = H - top - bottom;
  const group = plotW / Math.max(n, 1);
  const bw = Math.max(3, Math.min(26, (group - 6) / series.length - 2));
  const ticks = [0, nice / 2, nice];
  const showEvery = n > 10 ? Math.ceil(n / 8) : 1;
  const fmtTick = (v: number) => (series[0]?.format(v) ?? String(v));
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${id}-t ${id}-d`} className="h-auto w-full">
        <title id={`${id}-t`}>{title}</title><desc id={`${id}-d`}>{desc}</desc>
        {ticks.map((t) => { const y = top + plotH - (t / nice) * plotH; return (<g key={t}><line x1={left} x2={W - 4} y1={y} y2={y} stroke={GRID} strokeWidth="1" /><text x={left - 6} y={y + 4} fontSize="10" textAnchor="end" fill={MUTED}>{fmtTick(t)}</text></g>); })}
        {labels.map((lab, i) => {
          const gx = left + i * group + (group - (bw * series.length + 2 * (series.length - 1))) / 2;
          return (
            <g key={lab}>
              {series.map((s, k) => {
                const v = s.values[i] ?? 0; const h = (v / nice) * plotH;
                return (
                  <g key={s.name}>
                    <title>{`${lab} · ${s.name}: ${s.format(v)}`}</title>
                    {v > 0 && <rect x={gx + k * (bw + 2)} y={top + plotH - h} width={bw} height={h} rx={3} fill={s.color === 'gold' ? GOLD : STEEL} />}
                    {v === 0 && <rect x={gx + k * (bw + 2)} y={top + plotH - 1.5} width={bw} height={1.5} fill={GRID} />}
                  </g>
                );
              })}
              {i % showEvery === 0 && <text x={left + i * group + group / 2} y={H - 6} fontSize="10" textAnchor="middle" fill={MUTED}>{lab}</text>}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <ul className="mt-1 flex flex-wrap gap-4 text-xs text-[#d6d8dd]" aria-label="Legend">
          {series.map((s) => <li key={s.name} className="flex items-center gap-1.5"><span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color === 'gold' ? GOLD : STEEL }} />{s.name}</li>)}
        </ul>
      )}
      <DataTable head={['Week of', ...series.map((s) => s.name)]} rows={labels.map((l, i) => [l, ...series.map((s) => s.format(s.values[i] ?? 0))])} />
    </figure>
  );
}

export function ChartCard({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="adm-card p-4" aria-label={title}>
      <div className="mb-3 flex items-center justify-between gap-3"><h3 className="text-sm font-semibold text-ivory">{title}</h3>{action}</div>
      {children}
    </section>
  );
}
