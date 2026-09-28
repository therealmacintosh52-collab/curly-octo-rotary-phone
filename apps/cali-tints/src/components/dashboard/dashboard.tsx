import Link from "next/link";
import { AlertTriangleIcon, PlusIcon, WalletIcon } from "lucide-react";
import type { DashboardStats } from "@/lib/db/types";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateOnly, presetRange, RANGE_PRESETS, type RangePreset } from "@/lib/dates";
import { Page, PageHeader, SectionHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StaggerItem } from "@/components/motion/primitives";
import { StatList, StatTile } from "./stat-tile";
import { DailyBarsChart, HorizontalBars } from "./charts-lazy";
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

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * Owner dashboard. All numbers come from one dashboard_stats() call; every
 * tile and bar links to the filtered invoice list behind it (a car is an
 * invoice, so there is one list).
 *
 * Hierarchy: the primary row is what the owner checks daily (this week, this
 * month, what is unpaid, what is coming in). The second row is context.
 */
export function Dashboard({ stats, range, companyName, cloverUnmatched = 0 }: { stats: DashboardStats; range: DashboardRange; companyName: string; cloverUnmatched?: number }) {
  const rangeLabel = range.preset === "all" ? "All time" : `${formatDateOnly(range.start, "MMM d")} – ${formatDateOnly(range.end, "MMM d, yyyy")}`;
  const week = presetRange("this_week");
  const month = presetRange("this_month");
  // "All time" links to the unfiltered list instead of a from=2000 filter.
  const rangeQ = range.preset === "all" ? "" : `from=${range.start}&to=${range.end}`;
  const drill = range.preset === "all" ? null : { start: range.start, end: range.end };

  return (
    <Page>
      <PageHeader
        eyebrow={formatDate(new Date(), "EEEE, MMMM d")}
        title={companyName}
        description="Tap any number to see the cars behind it."
        actions={
          <Button asChild>
            <Link href="/jobs/new">
              <PlusIcon /> New car
            </Link>
          </Button>
        }
      />

      {/* Three groups: what was done, what is unpaid, what is being paid. One headline number each; the rest in compact rows. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3 lg:gap-5">
        <section className="flex flex-col gap-3">
          <h2 className="text-label text-subtle">Cars detailed</h2>
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="This week" value={String(stats.week.jobs)} sub={`${plural(stats.week.jobs, "car", "cars")} · ${formatMoney(stats.week.revenue)}`} href={`/invoices?from=${week.start}&to=${week.end}`} />
            <StatTile label="This month" value={String(stats.month.jobs)} sub={`${plural(stats.month.jobs, "car", "cars")} · ${formatMoney(stats.month.revenue)}`} href={`/invoices?from=${month.start}&to=${month.end}`} />
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-label text-subtle">Unpaid</h2>
          <StatTile label="Still to collect" value={formatMoney(stats.unpaid_total)} sub={`${plural(stats.unpaid_invoices, "car", "cars")} not paid yet`} tone={stats.unpaid_total > 0 ? "accent" : undefined} href="/invoices?status=unpaid" />
          <StatList
            rows={[
              { label: "Not sent yet", hint: `${plural(stats.draft_invoices, "car", "cars")} logged, invoice not sent`, value: formatMoney(stats.draft_total), href: "/invoices?status=draft" },
              { label: "Sent, unpaid", hint: plural(stats.outstanding_invoices, "invoice", "invoices"), value: formatMoney(stats.outstanding_total), tone: stats.outstanding_total > 0 ? ("warning" as const) : undefined, href: "/invoices?status=outstanding" },
              ...(stats.uninvoiced_jobs > 0 ? [{ label: "Cars with no invoice", hint: "logged before auto-invoicing", value: String(stats.uninvoiced_jobs), tone: "warning" as const, href: "/invoices/new" }] : []),
            ]}
          />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-label text-subtle">Getting paid</h2>
          <StatTile label="Collected" value={formatMoney(stats.paid_last_90)} sub="last 90 days" tone="accent" href="/invoices?status=paid" />
          <StatList
            rows={[
              ...(cloverUnmatched > 0 ? [{ label: "Clover payments to match", hint: "card payments not yet on an invoice", value: String(cloverUnmatched), tone: "warning" as const, href: "/invoices" }] : []),
              { label: "Overdue", hint: `unpaid > ${stats.reminder_days} days`, value: String(stats.overdue.length), tone: stats.overdue.length ? "warning" : undefined, href: "/invoices?status=overdue" },
              { label: "Avg days to payment", hint: "submitted → paid", value: stats.avg_days_to_pay === null ? "—" : `${stats.avg_days_to_pay}`, href: "/invoices?status=paid" },
            ]}
          />
        </section>
      </div>

      {/* Overdue reminders */}
      {stats.overdue.length > 0 && (
        <Card className="mt-6 border-warning/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangleIcon className="size-4 text-warning" /> Unpaid for more than {stats.reminder_days} days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm">
              {stats.overdue.map((o, i) => (
                <StaggerItem key={o.id} index={i} as="li">
                  <Link href={`/invoices/${o.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent/50">
                    <div className="min-w-0">
                      <span className="font-semibold">{o.display_number}</span>
                      <span className="text-muted-foreground"> · {o.dealership}</span>
                      <div className="text-caption text-subtle">
                        Submitted {formatDate(o.submitted_at)} · {o.days_outstanding} days
                      </div>
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      <div className="font-semibold">{formatMoney(Number(o.total) - Number(o.amount_paid))}</div>
                      <div className="text-caption text-subtle">of {formatMoney(o.total)}</div>
                    </div>
                  </Link>
                </StaggerItem>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Income for the selected range: what was logged vs what actually came in, with the range picker. */}
      <SectionHeader
        className="mt-8"
        title={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="flex items-center gap-2 whitespace-nowrap">
              <WalletIcon className="size-4 text-primary" /> Income
            </span>
            <Link href={rangeQ ? `/invoices?${rangeQ}` : "/invoices"} className="whitespace-nowrap text-primary underline-offset-4 hover:underline">
              {rangeLabel}
            </Link>
          </span>
        }
        aside={<RangePicker preset={range.preset} start={range.start} end={range.end} />}
      />
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total income" value={formatMoney(stats.income.collected)} sub={`${plural(stats.income.payments, "payment", "payments")} received`} tone="accent" href="/invoices?status=paid" />
        <StatTile label="Revenue logged" value={formatMoney(stats.income.revenue)} sub={`${plural(stats.income.jobs, "car", "cars")} detailed`} href={rangeQ ? `/invoices?${rangeQ}` : "/invoices"} />
        <StatTile label="Avg per car" value={formatMoney(stats.income.avg_per_car)} sub="revenue ÷ cars" size="sm" href={rangeQ ? `/invoices?${rangeQ}` : "/invoices"} />
        <StatTile
          label="Still to collect"
          value={formatMoney(Math.max(0, stats.income.revenue - stats.income.collected))}
          sub={stats.income.collected > stats.income.revenue ? "collected more than logged (older invoices paid)" : "logged, not yet received"}
          size="sm"
          tone={stats.income.revenue - stats.income.collected > 0 ? "warning" : undefined}
          href="/invoices?status=unpaid"
        />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Income received per day</CardTitle>
          </CardHeader>
          <CardContent>
            <DailyBarsChart data={stats.collected_by_day.map((d) => ({ day: d.day, value: Number(d.amount), count: d.payments }))} start={range.start} end={range.end} drill="paid" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Revenue logged per day</CardTitle>
          </CardHeader>
          <CardContent>
            <DailyBarsChart data={stats.by_day.map((d) => ({ day: d.day, value: Number(d.revenue), count: d.jobs }))} start={range.start} end={range.end} />
          </CardContent>
        </Card>
      </div>

      {/* Breakdowns */}
      <SectionHeader className="mt-8" title="Breakdown" />
      <div className="mt-4 grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by service</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBars data={stats.by_service.map((s) => ({ id: s.service_id, name: s.name, jobs: s.jobs, revenue: s.revenue }))} money linkParam="service" range={drill} />
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
