"use client";

import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/money";
import { formatDateOnly } from "@/lib/dates";

/*
  Chart conventions (see dataviz skill):
  - single series per chart → one hue (brand green), no legend
  - thin marks (<= 24px), 4px rounded data-end, square baseline
  - hairline solid gridlines in a one-step-off-surface gray
  - text in text tokens, never the series color
  - hover tooltip on every mark
*/
const ACCENT = "#82d955";
const ACCENT_DIM = "#4d7f34";
const GRID = "#232a2f";
const TICK = "#8a939b";

function ChartTooltip({ active, payload, label, money }: { active?: boolean; payload?: { value: number; name: string; payload: Record<string, unknown> }[]; label?: string; money?: boolean }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  const jobs = p.payload.jobs as number | undefined;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-xl">
      <div className="font-medium text-foreground">{label}</div>
      <div className="text-muted-foreground">
        {money ? formatMoney(p.value) : p.value}
        {jobs !== undefined && money ? ` · ${jobs} job${jobs === 1 ? "" : "s"}` : ""}
      </div>
    </div>
  );
}

const compact = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${n}`);

/** Revenue per day as columns; empty days are filled in so the axis is continuous. */
export function RevenueByDayChart({ data, start, end }: { data: { day: string; jobs: number; revenue: number }[]; start: string; end: string }) {
  const byDay = new Map(data.map((d) => [d.day, d]));
  const series: { day: string; label: string; revenue: number; jobs: number }[] = [];
  const cursor = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (cursor <= last) {
    const key = cursor.toISOString().slice(0, 10);
    const d = byDay.get(key);
    series.push({ day: key, label: formatDateOnly(key, "MMM d"), revenue: Number(d?.revenue ?? 0), jobs: d?.jobs ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }
  const step = series.length > 20 ? Math.ceil(series.length / 8) : series.length > 10 ? 2 : 1;

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap={series.length > 20 ? 2 : 6}>
          <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
          <XAxis dataKey="label" tick={{ fill: TICK, fontSize: 11 }} axisLine={{ stroke: GRID }} tickLine={false} interval={step - 1} />
          <YAxis tick={{ fill: TICK, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={compact} width={44} />
          <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<ChartTooltip money />} />
          <Bar dataKey="revenue" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={24} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal magnitude comparison with the value at the bar tip; the top item is emphasised. */
export function HorizontalBars({ data, money }: { data: { name: string; revenue: number; jobs: number }[]; money?: boolean }) {
  if (data.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No data for this range.</p>;
  const rows = data.slice(0, 8).map((d) => ({ ...d, revenue: Number(d.revenue), value: money ? Number(d.revenue) : d.jobs }));
  const height = Math.max(120, rows.length * 34 + 16);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 64, left: 4, bottom: 4 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} stroke={GRID} strokeWidth={1} />
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={140} tick={{ fill: TICK, fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<ChartTooltip money={money} />} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {rows.map((_, i) => (
              <Cell key={i} fill={i === 0 ? ACCENT : ACCENT_DIM} />
            ))}
            <LabelList dataKey="value" position="right" formatter={(v: unknown) => (money ? formatMoney(Number(v)) : String(v))} style={{ fill: "#e6e9eb", fontSize: 12 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
