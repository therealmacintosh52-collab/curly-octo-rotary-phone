import Link from "next/link";
import { AlertTriangleIcon, PlusIcon } from "lucide-react";
import type { DashboardStats } from "@/lib/db/types";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateOnly, presetRange, RANGE_PRESETS, type RangePreset } from "@/lib/dates";
import { Page, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatTile } from "./stat-tile";
import { HorizontalBars, RevenueByDayChart } from "./charts";
import { RangePicker } from "./range-picker";

export interface DashboardRange {
  preset: RangePreset | "custom";
  start: string;
  end: string;
}

/** Resolve ?from&to&preset into a range (defaults: month to date). */
export function resolveRange(sp: Record<string, string | string[] | undefined>): DashboardRange {
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);
  const valid = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);
  const preset = s("preset") as RangePreset | undefined;
  const from = valid(s("from"));
  const to = valid(s("to"));
  if (from && to) return { preset: preset ?? "custom", start: from, end: to };
  const known: RangePreset = preset && RANGE_PRESETS.some((p) => p.value === preset) ? preset : "this_month";
  const r = presetRange(known);
  return { preset: known, start: r.start, end: r.end };
}

/**
 * Owner dashboard. All numbers come from one dashboard_stats() call; every
 * tile and bar links to the filtered job or invoice list behind it.
 */
export function Dashboard({ stats, range, companyName }: { stats: DashboardStats; range: DashboardRange; companyName: string }) {
  const rangeLabel = range.preset === "all" ? "All time" : `${formatDateOnly(range.start, "MMM d")} – ${formatDateOnly(range.end, "MMM d, yyyy")}`;
  const week = presetRange("this_week");
  const month = presetRange("this_month");
  // "All time" links to the unfiltered list instead of a from=2000 filter.
  const rangeQ = range.preset === "all" ? "" : `from=${range.start}&to=${range.end}`;
  const drill = range.preset === "all" ? null : { start: range.start, end: range.end };
  return (
    <Page>
      <PageHeader
        title={companyName}
        description={`Today is ${formatDate(new Date(), "EEEE, MMM d")}. Tap any number to see the jobs or invoices behind it.`}
        actions={
          <Button asChild>
            <Link href="/jobs/new">
              <PlusIcon /> Log job
            </Link>
          </Button>
        }
      />

      {/* KPI row */}
      <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="This week" value={String(stats.week.jobs)} sub={`${stats.week.jobs === 1 ? "car" : "cars"} · ${formatMoney(stats.week.revenue)}`} href={`/jobs?from=${week.start}&to=${week.end}`} />
        <StatTile label="This month" value={String(stats.month.jobs)} sub={`${stats.month.jobs === 1 ? "car" : "cars"} · ${formatMoney(stats.month.revenue)}`} href={`/jobs?from=${month.start}&to=${month.end}`} />
        <StatTile label="Uninvoiced" value={formatMoney(stats.uninvoiced_total)} sub={`${stats.uninvoiced_jobs} job${stats.uninvoiced_jobs === 1 ? "" : "s"} ready to bill`} tone="accent" href="/jobs?status=uninvoiced" />
        <StatTile
          label="Outstanding"
          value={formatMoney(stats.outstanding_total)}
          sub={`${stats.outstanding_invoices} invoice${stats.outstanding_invoices === 1 ? "" : "s"} submitted, unpaid`}
          tone={stats.outstanding_total > 0 ? "warning" : undefined}
          href="/invoices?status=outstanding"
        />
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Avg days to payment" value={stats.avg_days_to_pay === null ? "—" : `${stats.avg_days_to_pay}`} sub="submitted → paid, all time" href="/invoices?status=paid" />
        <StatTile label="Collected, last 90 days" value={formatMoney(stats.paid_last_90)} href="/invoices?status=paid" />
        <StatTile label="Draft invoices" value={formatMoney(stats.draft_total)} sub="generated, not yet sent" href="/invoices?status=draft" />
        <StatTile label="Overdue" value={String(stats.overdue.length)} sub={`unpaid > ${stats.reminder_days} days`} tone={stats.overdue.length ? "warning" : undefined} href="/invoices?status=overdue" />
      </div>

      {/* Overdue reminders */}
      {stats.overdue.length > 0 && (
        <Card className="mt-5 border-warning/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangleIcon className="size-4 text-warning" /> Submitted but unpaid for more than {stats.reminder_days} days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {stats.overdue.map((o) => (
                <li key={o.id}>
                  <Link href={`/invoices/${o.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2 hover:bg-accent/50">
                    <div className="min-w-0">
                      <span className="font-semibold">{o.display_number}</span>
                      <span className="text-muted-foreground"> · {o.dealership}</span>
                      <div className="text-xs text-muted-foreground">
                        Submitted {formatDate(o.submitted_at)} · {o.days_outstanding} days
                      </div>
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      <div className="font-semibold">{formatMoney(Number(o.total) - Number(o.amount_paid))}</div>
                      <div className="text-xs text-muted-foreground">of {formatMoney(o.total)}</div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Breakdowns */}
      <div className="mt-8 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <h2 className="text-lg font-semibold">
          Breakdown ·{" "}
          <Link href={rangeQ ? `/jobs?${rangeQ}` : "/jobs"} className="text-primary hover:underline">
            {rangeLabel}
          </Link>
        </h2>
        <RangePicker preset={range.preset} start={range.start} end={range.end} />
      </div>
      <div className="mt-4 grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Revenue logged per day</CardTitle>
          </CardHeader>
          <CardContent>
            <RevenueByDayChart data={stats.by_day} start={range.start} end={range.end} />
          </CardContent>
        </Card>
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Revenue by service</CardTitle>
            </CardHeader>
            <CardContent>
              <HorizontalBars data={stats.by_service.map((s) => ({ id: s.service_id, name: s.name, jobs: s.jobs, revenue: s.revenue }))} money linkParam="service" range={drill} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Cars by detailer</CardTitle>
            </CardHeader>
            <CardContent>
              <HorizontalBars data={stats.by_detailer.map((d) => ({ id: d.detailer_id, name: d.name, jobs: d.jobs, revenue: d.revenue }))} linkParam="detailer" range={drill} />
            </CardContent>
          </Card>
        </div>
      </div>
    </Page>
  );
}
