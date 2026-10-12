import Link from "next/link";
import { PlusIcon } from "lucide-react";
import type { TeamStats } from "@/lib/db/types";
import { addDaysYmd, formatDate, formatDateOnly, presetRange } from "@/lib/dates";
import { greetingFor } from "@/lib/greeting";
import { Page, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StaggerItem } from "@/components/motion/primitives";
import { StatList, StatTile } from "./stat-tile";
import { DailyBarsChart } from "./charts-lazy";
import { LiveDate, LiveGreeting } from "./live-greeting";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Drop the make when it is the default one, so "4821 · 2024 GLE 450" fits a phone row. */
const shortVehicle = (v: string | null) => v?.replace(/^(\d{4} )?Mercedes-Benz /, "$1") ?? null;

/**
 * What an admin or manager sees: the whole team's day, counts only. No
 * money anywhere; that is the owner's dashboard.
 */
export function TeamDashboard({ stats, today, who }: { stats: TeamStats; today: string; who: { name: string; tz: string } }) {
  const week = presetRange("this_week");
  const month = presetRange("this_month");

  return (
    <Page>
      <PageHeader
        eyebrow={<LiveDate initial={formatDate(new Date(), "EEEE, MMMM d")} />}
        title={<LiveGreeting name={who.name} tz={who.tz} initial={greetingFor(who.name, who.tz).replace(/\.$/, "")} />}
        description="The team's cars. Every number opens the jobs behind it."
        actions={
          <Button asChild>
            <Link href="/jobs/new">
              <PlusIcon /> New job
            </Link>
          </Button>
        }
      />

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Today"
          value={String(stats.today.cars)}
          sub={stats.today.cars === 0 ? "nothing logged yet" : stats.today.by_service.map((s) => `${s.name} ${s.cars}`).join(" · ")}
          tone={stats.today.cars > 0 ? "accent" : undefined}
          href="/jobs?q=today"
        />
        <StatTile label="This week" value={String(stats.week.cars)} sub={`${plural(stats.week.cars, "car", "cars")} · day by day`} href={`/jobs?from=${week.start}&to=${addDaysYmd(week.start, 6)}`} />
        <StatTile label="This month" value={String(stats.month.cars)} sub={`${plural(stats.open_jobs, "job", "jobs")} waiting for the month's invoice`} href={`/jobs?from=${month.start}&to=${month.end}`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Today&apos;s cars</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.today_cars.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing yet today.</p>
            ) : (
              <ul className="divide-y divide-border text-sm" data-testid="today-cars">
                {stats.today_cars.map((c, i) => (
                  <StaggerItem key={c.id} index={i} as="li">
                    <Link href={`/jobs/${c.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent/50">
                      <div className="min-w-0">
                        <span className="font-semibold tracking-wide">{c.tag}</span>
                        {c.vehicle && <span className="text-muted-foreground"> · {shortVehicle(c.vehicle)}</span>}
                        <div className="truncate text-caption text-subtle">{[c.services.join(", "), c.dealership].filter(Boolean).join(" · ")}</div>
                      </div>
                      <div className="shrink-0 text-caption tabular-nums text-subtle">{formatDate(c.performed_at, "h:mm a")}</div>
                    </Link>
                  </StaggerItem>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-3">
          <h2 className="text-label text-subtle">This month by detailer</h2>
          <StatList rows={stats.by_detailer.map((d) => ({ label: d.name, hint: d.today > 0 ? `${plural(d.today, "car", "cars")} today` : "none today", value: String(d.cars), href: `/jobs?detailer=${d.detailer_id}&from=${month.start}&to=${month.end}` }))} />
          {stats.by_detailer.length === 0 && <p className="text-sm text-muted-foreground">No cars logged this month yet.</p>}
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Cars per day · last 30 days</CardTitle>
        </CardHeader>
        <CardContent>
          <DailyBarsChart data={stats.by_day.map((d) => ({ day: d.day, value: d.cars, count: d.cars }))} start={stats.range.start} end={stats.range.end || today} />
        </CardContent>
      </Card>
      <p className="mt-3 px-1 text-caption text-subtle">Best day this month: {bestDay(stats)}</p>
    </Page>
  );
}

function bestDay(stats: TeamStats) {
  const best = stats.by_day.reduce<{ day: string; cars: number } | null>((b, d) => (!b || d.cars > b.cars ? d : b), null);
  return best && best.cars > 0 ? `${formatDateOnly(best.day, "MMM d")} · ${plural(best.cars, "car", "cars")}` : "—";
}
