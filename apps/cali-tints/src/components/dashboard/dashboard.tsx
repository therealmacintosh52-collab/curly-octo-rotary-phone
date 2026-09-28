import Link from "next/link";
import { AlertTriangleIcon, PlusIcon, WalletIcon } from "lucide-react";
import type { DashboardStats } from "@/lib/db/types";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateOnly, presetRange, RANGE_PRESETS, type RangePreset } from "@/lib/dates";
import { MonthPicker } from "./month-picker";
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

function addDaysYmd(ymd: string, n: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** "Good morning, Mike." from the hour in the company timezone and the signed-in person's first name. */
export function greetingFor(fullName: string, tz: string, now: Date = new Date()): string {
  let hour = now.getHours();
  try {
    hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(now)) % 24;
  } catch {
    /* unknown timezone: local hour */
  }
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = fullName.trim().split(/\s+/)[0] ?? "";
  return first ? `${part}, ${first}.` : `${part}.`;
}

/** The breakdown month (`?bm=YYYY-MM`), defaulting to the current month; `months` lists the last six for the picker. */
export function resolveBreakdownMonth(sp: Record<string, string | string[] | undefined>, today: string): { month: string; start: string; end: string; label: string; months: { value: string; label: string }[] } {
  const bm = typeof sp.bm === "string" && /^\d{4}-\d{2}$/.test(sp.bm) ? sp.bm : today.slice(0, 7);
  const [ty, tm] = today.split("-").map(Number);
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(ty, tm - 1 - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { value, label: i === 0 ? "This month" : formatDateOnly(`${value}-01`, d.getFullYear() === ty ? "MMM" : "MMM yy") };
  });
  const [y, m] = bm.split("-").map(Number);
  const last = new Date(y, m, 0).getDate();
  return { month: bm, start: `${bm}-01`, end: `${bm}-${String(last).padStart(2, "0")}`, label: formatDateOnly(`${bm}-01`, "MMMM yyyy"), months: months.some((x) => x.value === bm) ? months : [{ value: bm, label: formatDateOnly(`${bm}-01`, "MMM yy") }, ...months] };
}

/** The weeks of a month (Mon–Sun, clipped to the month) with the cars and revenue logged in each. */
export function weeksOfMonth(start: string, end: string, byDay: { day: string; jobs: number; revenue: number }[]) {
  const [y, m] = start.split("-").map(Number);
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const weeks: { from: string; to: string; jobs: number; revenue: number }[] = [];
  const cursor = new Date(y, m - 1, 1);
  const last = new Date(end + "T00:00:00");
  while (cursor <= last) {
    const from = ymd(cursor);
    const dow = (cursor.getDay() + 6) % 7; // Monday = 0
    const to = new Date(cursor);
    to.setDate(to.getDate() + (6 - dow));
    const toYmd = to > last ? end : ymd(to);
    const inWeek = byDay.filter((d) => d.day >= from && d.day <= toYmd);
    weeks.push({ from, to: toYmd, jobs: inWeek.reduce((s, d) => s + Number(d.jobs), 0), revenue: inWeek.reduce((s, d) => s + Number(d.revenue), 0) });
    cursor.setTime(to.getTime());
    cursor.setDate(cursor.getDate() + 1);
  }
  return weeks;
}

/**
 * Owner dashboard. All numbers come from one dashboard_stats() call; every
 * tile and bar links to the filtered invoice list behind it (a car is an
 * invoice, so there is one list).
 *
 * Hierarchy: the primary row is what the owner checks daily (this week, this
 * month, what is unpaid, what is coming in). The second row is context.
 */
export function Dashboard({
  stats,
  range,
  companyName,
  cloverUnmatched = 0,
  today,
  greeting,
  breakdown,
}: {
  stats: DashboardStats;
  range: DashboardRange;
  companyName: string;
  cloverUnmatched?: number;
  /** Today in the company timezone (yyyy-mm-dd). */
  today: string;
  /** "Good afternoon, Mike." — built by the page from the clock and the signed-in name. */
  greeting: string;
  /** The month the breakdown shows, with its own stats (by service, by day). */
  breakdown: ReturnType<typeof resolveBreakdownMonth> & { stats: Pick<DashboardStats, "by_service" | "by_day"> };
}) {
  const rangeLabel = range.preset === "all" ? "All time" : `${formatDateOnly(range.start, "MMM d")} – ${formatDateOnly(range.end, "MMM d, yyyy")}`;
  const week = presetRange("this_week");
  const month = presetRange("this_month");
  // "All time" links to the unfiltered list instead of a from=2000 filter.
  const rangeQ = range.preset === "all" ? "" : `from=${range.start}&to=${range.end}`;
  const pageQ = range.preset === "all" ? "preset=all" : `${rangeQ}${range.preset !== "custom" ? `&preset=${range.preset}` : ""}`;
  const weeks = weeksOfMonth(breakdown.start, breakdown.end, breakdown.stats.by_day);

  return (
    <Page>
      <PageHeader
        eyebrow={formatDate(new Date(), "EEEE, MMMM d")}
        title={companyName}
        description={greeting}
        actions={
          <Button asChild>
            <Link href="/jobs/new">
              <PlusIcon /> New invoice
            </Link>
          </Button>
        }
      />

      {/* Three groups: what was done, what is unpaid, what is being paid. One headline number each; the rest in compact rows. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3 lg:gap-5">
        <section className="flex flex-col gap-3">
          <h2 className="text-label text-subtle">Cars detailed</h2>
          <StatTile
            label="Today"
            value={String(stats.today.jobs)}
            sub={stats.today.jobs === 0 ? "nothing logged yet · a normal day is about 3 Used, 2 PDI, 4 Sold" : `${formatMoney(stats.today.revenue)} · ${stats.today.by_service.map((s) => `${s.name} ${s.jobs}`).join(" · ")}`}
            tone={stats.today.jobs > 0 ? "accent" : undefined}
            href="/invoices?q=today"
          />
          {/* The whole week (Mon–Sun), day by day, on the Invoices list. */}
          <StatTile label="This week" value={String(stats.week.jobs)} sub={`${plural(stats.week.jobs, "car", "cars")} · ${formatMoney(stats.week.revenue)} · day by day`} href={`/invoices?from=${week.start}&to=${addDaysYmd(week.start, 6)}`} />
          <StatTile label="This month" value={String(stats.month.jobs)} sub={`${plural(stats.month.jobs, "car", "cars")} · ${formatMoney(stats.month.revenue)}`} href={`/invoices?from=${month.start}&to=${month.end}`} />
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
          <h2 className="text-label text-subtle">Paid</h2>
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
      <div className="mt-4 grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Invoices received per day</CardTitle>
          </CardHeader>
          <CardContent>
            <DailyBarsChart data={stats.collected_by_day.map((d) => ({ day: d.day, value: Number(d.amount), count: d.payments }))} start={range.start} end={range.end} drill="paid" />
          </CardContent>
        </Card>
      </div>

      {/* Breakdown: one month at a time, by service and by week */}
      <SectionHeader className="mt-8" title={<span>Breakdown · {breakdown.label}</span>} aside={<MonthPicker months={breakdown.months} value={breakdown.month} baseQuery={pageQ} />} />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue by service</CardTitle>
          </CardHeader>
          <CardContent>
            <HorizontalBars data={breakdown.stats.by_service.map((s) => ({ id: s.service_id, name: s.name, jobs: s.jobs, revenue: s.revenue }))} money linkParam="service" range={{ start: breakdown.start, end: breakdown.end }} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>By week</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0 sm:px-0">
            <StatList
              className="rounded-none border-0 bg-transparent shadow-none"
              rows={weeks.map((w, i) => ({
                label: `Week ${i + 1} · ${formatDateOnly(w.from, "MMM d")} – ${formatDateOnly(w.to, "MMM d")}`,
                hint: w.jobs === 0 ? (w.from > today ? "still to come" : "no cars") : plural(w.jobs, "car", "cars"),
                value: w.jobs === 0 ? "—" : formatMoney(w.revenue),
                href: `/invoices?from=${w.from}&to=${w.to}`,
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}
