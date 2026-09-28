import Link from "next/link";
import { PlusIcon } from "lucide-react";
import type { DetailerStats } from "@/lib/db/types";
import { formatDate, formatDateOnly, presetRange } from "@/lib/dates";
import { greetingFor } from "@/lib/greeting";
import { Page, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StaggerItem } from "@/components/motion/primitives";
import { StatTile } from "./stat-tile";
import { DailyBarsChart } from "./charts-lazy";
import { LiveDate, LiveGreeting } from "./live-greeting";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function addDaysYmd(ymd: string, n: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** Drop the make when it is the default one, so "4821 · 2024 GLE 450" fits a phone row. */
const shortVehicle = (v: string | null) => v?.replace(/^(\d{4} )?Mercedes-Benz /, "$1") ?? null;

/**
 * What a detailer sees when they open the app: their own cars, today and
 * lately, and a way to log the next one. No money, no one else's work; every
 * number opens their own invoices behind it.
 */
export function DetailerDashboard({ stats, today, who }: { stats: DetailerStats; today: string; who: { name: string; tz: string } }) {
  const week = presetRange("this_week");
  const month = presetRange("this_month");
  const bestDay = stats.by_day.reduce<{ day: string; cars: number } | null>((best, d) => (!best || d.cars > best.cars ? d : best), null);

  return (
    <Page>
      <PageHeader
        eyebrow={<LiveDate initial={formatDate(new Date(), "EEEE, MMMM d")} />}
        title={<LiveGreeting name={who.name} tz={who.tz} initial={greetingFor(who.name, who.tz).replace(/\.$/, "")} />}
        description="Your cars. Every number opens the invoices behind it."
        actions={
          <Button asChild>
            <Link href="/jobs/new">
              <PlusIcon /> New invoice
            </Link>
          </Button>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Today"
          value={String(stats.today.cars)}
          sub={stats.today.cars === 0 ? "no cars logged yet" : stats.today.by_service.map((s) => `${s.name} ${s.cars}`).join(" · ")}
          tone={stats.today.cars > 0 ? "accent" : undefined}
          href="/invoices?q=today"
        />
        <StatTile label="This week" value={String(stats.week.cars)} sub={`${plural(stats.week.cars, "car", "cars")} · day by day`} href={`/invoices?from=${week.start}&to=${addDaysYmd(week.start, 6)}`} />
        <StatTile label="This month" value={String(stats.month.cars)} sub={bestDay && bestDay.cars > 0 ? `best day ${formatDateOnly(bestDay.day, "MMM d")} · ${plural(bestDay.cars, "car", "cars")}` : plural(stats.month.cars, "car", "cars")} href={`/invoices?from=${month.start}&to=${month.end}`} />
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Today&apos;s cars</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.today_cars.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing yet today. Tap New invoice when the first car is done.</p>
          ) : (
            <ul className="divide-y divide-border text-sm" data-testid="today-cars">
              {stats.today_cars.map((c, i) => {
                const row = (
                  <>
                    <div className="min-w-0">
                      <span className="font-semibold tracking-wide">{c.tag}</span>
                      {c.vehicle && <span className="text-muted-foreground"> · {shortVehicle(c.vehicle)}</span>}
                      <div className="truncate text-caption text-subtle">{[c.services.join(", "), c.dealership, formatDate(c.performed_at, "h:mm a")].filter(Boolean).join(" · ")}</div>
                    </div>
                    <div className="shrink-0 text-caption tabular-nums text-subtle">{c.display_number ?? "no invoice"}</div>
                  </>
                );
                return (
                  <StaggerItem key={c.id} index={i} as="li">
                    {c.invoice_id ? (
                      <Link href={`/invoices/${c.invoice_id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent/50">
                        {row}
                      </Link>
                    ) : (
                      <div className="-mx-2 flex items-center justify-between gap-3 px-2 py-2.5">{row}</div>
                    )}
                  </StaggerItem>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Your cars per day · last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          <DailyBarsChart data={stats.by_day.map((d) => ({ day: d.day, value: d.cars, count: d.cars }))} start={stats.range.start} end={stats.range.end || today} />
        </CardContent>
      </Card>
    </Page>
  );
}
