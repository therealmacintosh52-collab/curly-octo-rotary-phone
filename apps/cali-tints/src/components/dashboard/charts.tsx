"use client";

import { useRouter } from "next/navigation";
import { useReducedMotion } from "motion/react";
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoney } from "@/lib/money";
import { formatDateOnly } from "@/lib/dates";

/*
  Chart conventions (see dataviz skill):
  - single series per chart → one hue (brand green), no legend
  - thin marks (<= 24px), 4px rounded data-end, square baseline
  - hairline solid gridlines in a one-step-off-surface gray
  - text in text tokens, never the series color
  - hover tooltip on every mark; every mark is a drill-down link
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
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-popover">
      <div className="font-medium text-foreground">{label}</div>
      <div className="text-muted-foreground">
        {money ? formatMoney(p.value) : p.value}
        {jobs !== undefined && money ? ` · ${jobs} job${jobs === 1 ? "" : "s"}` : ""}
      </div>
      <div className="mt-1 text-[11px] text-primary">Tap to see the jobs</div>
    </div>
  );
}

/** Local-time YYYY-MM-DD (toISOString would shift the day east of UTC). */
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const compact = (n: number) => (n >= 1000 ? `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : `$${n}`);

/** The datum behind a clicked bar (`payload` is typed `any` by recharts). */
function barRow<T>(item: unknown): T | undefined {
  return (item as { payload?: T } | null | undefined)?.payload;
}

/** Revenue per day as columns; empty days are filled in so the axis is continuous. Click a day → that day's jobs. */
export function RevenueByDayChart({ data, start, end }: { data: { day: string; jobs: number; revenue: number }[]; start: string; end: string }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const byDay = new Map(data.map((d) => [d.day, d]));
  const last = new Date(end + "T00:00:00");
  let first = new Date(start + "T00:00:00");
  // "All time" starts far in the past: begin at the first day that has data instead of drawing years of empty columns.
  if (Math.round((last.getTime() - first.getTime()) / 86400000) > 730 && data.length > 0) {
    const firstDay = data.map((d) => d.day).sort()[0];
    first = new Date(firstDay + "T00:00:00");
    first.setDate(1);
  }
  const spanDays = Math.round((last.getTime() - first.getTime()) / 86400000) + 1;
  // Cap the number of columns so long ranges stay readable.
  const grouping: "day" | "week" | "month" = spanDays > 400 ? "month" : spanDays > 120 ? "week" : "day";

  const series: { day: string; label: string; revenue: number; jobs: number }[] = [];
  const cursor = new Date(first);
  while (cursor <= last) {
    const bucketStart = new Date(cursor);
    let revenue = 0;
    let jobs = 0;
    const inBucket = () => (grouping === "day" ? cursor.getTime() === bucketStart.getTime() : grouping === "week" ? cursor.getTime() - bucketStart.getTime() < 7 * 86400000 : cursor.getMonth() === bucketStart.getMonth() && cursor.getFullYear() === bucketStart.getFullYear());
    do {
      const d = byDay.get(ymd(cursor));
      revenue += Number(d?.revenue ?? 0);
      jobs += d?.jobs ?? 0;
      cursor.setDate(cursor.getDate() + 1);
    } while (cursor <= last && inBucket());
    const bucketEnd = new Date(cursor);
    bucketEnd.setDate(bucketEnd.getDate() - 1);
    const from = ymd(bucketStart);
    const to = ymd(bucketEnd);
    series.push({ day: from === to ? from : `${from}|${to}`, label: formatDateOnly(from, grouping === "month" ? "MMM yy" : "MMM d"), revenue, jobs });
  }
  const step = series.length > 20 ? Math.ceil(series.length / 8) : series.length > 10 ? 2 : 1;

  function open(day: string) {
    const [from, to] = day.includes("|") ? day.split("|") : [day, day];
    router.push(`/jobs?from=${from}&to=${to}`);
  }

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={series} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap={series.length > 20 ? 2 : 6}>
          <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
          <XAxis dataKey="label" tick={{ fill: TICK, fontSize: 11 }} axisLine={{ stroke: GRID }} tickLine={false} interval={step - 1} />
          <YAxis tick={{ fill: TICK, fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={compact} width={44} />
          <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<ChartTooltip money />} />
          <Bar dataKey="revenue" fill={ACCENT} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={!reduce} animationDuration={400} animationEasing="ease-out" style={{ cursor: "pointer" }} onClick={(item) => { const row = barRow<{ day: string }>(item); if (row) open(row.day); }} />
        </BarChart>
      </ResponsiveContainer>
      {grouping !== "day" && <p className="mt-1 text-center text-[11px] text-muted-foreground">Grouped by {grouping} for this range</p>}
    </div>
  );
}

/** Horizontal magnitude comparison with the value at the bar tip; the top item is emphasised. Click a bar → jobs filtered to it. */
export function HorizontalBars({
  data,
  money,
  linkParam,
  range,
}: {
  data: { id: string; name: string; revenue: number; jobs: number }[];
  money?: boolean;
  /** Query param used for the drill-down (`service` or `detailer`). */
  linkParam: "service" | "detailer";
  /** Date window for the drill-down; null means no date filter ("All time"). */
  range: { start: string; end: string } | null;
}) {
  const router = useRouter();
  const reduce = useReducedMotion();
  if (data.length === 0) return <p className="py-8 text-center text-sm text-muted-foreground">No data for this range.</p>;
  const rows = data.slice(0, 8).map((d) => ({ ...d, revenue: Number(d.revenue), value: money ? Number(d.revenue) : d.jobs }));
  const height = Math.max(120, rows.length * 34 + 16);
  const open = (id: string) => router.push(`/jobs?${linkParam}=${encodeURIComponent(id)}${range ? `&from=${range.start}&to=${range.end}` : ""}`);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 4, right: 64, left: 4, bottom: 4 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} stroke={GRID} strokeWidth={1} />
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="name" width={140} tick={{ fill: TICK, fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<ChartTooltip money={money} />} />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20} isAnimationActive={!reduce} animationDuration={400} animationEasing="ease-out" style={{ cursor: "pointer" }} onClick={(item) => { const row = barRow<{ id: string }>(item); if (row) open(row.id); }}>
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
