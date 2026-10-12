"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import type { CalendarItem, CalendarRange, RetailCatalog } from "@/lib/db/types";
import type { PickedCustomer } from "./customer-picker";
import { useSession } from "@/components/app/session-provider";
import { formatMoney } from "@/lib/money";
import { addDays, dayKeyIn, dayLabelIn, durationLabel, holdSecondsLeft, mmss, timeIn, weekStart } from "@/lib/retail/slots";
import { Page, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { AppointmentStatusBadge } from "./appointment-status-badge";
import { AppointmentSheet } from "./appointment-sheet";

/**
 * The shop's calendar. A day is a time-ordered list of appointments with
 * the bay, lift and tech on each; a week is seven of those. Built for a
 * phone first: no grid to pinch, every row opens the appointment.
 */
export function CalendarView({ data, day, view, tz, catalog, recent }: { data: CalendarRange; day: string; view: "day" | "week"; tz: string; catalog: RetailCatalog | null; recent: PickedCustomer[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAdmin, canPrices } = useSession();
  const [pending, start] = useTransition();
  const [booking, setBooking] = useState(false);
  const today = dayKeyIn(new Date(), tz);
  const resourceName = (id: string) => data.resources.find((r) => r.id === id)?.name ?? "";

  function go(patch: { day?: string; view?: "day" | "week" }) {
    const sp = new URLSearchParams();
    const d = patch.day ?? day;
    const v = patch.view ?? view;
    if (d !== today) sp.set("date", d);
    if (v !== "day") sp.set("view", v);
    start(() => router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`));
  }
  const step = view === "day" ? 1 : 7;
  const days = view === "day" ? [day] : Array.from({ length: 7 }, (_, i) => addDays(weekStart(day), i));
  const byDay = (d: string) => data.items.filter((i) => dayKeyIn(i.starts_at, tz) === d);
  const closed = (d: string) => {
    const dow = new Date(`${d}T12:00:00Z`).getUTCDay();
    return data.hours.find((h) => h.dow === dow)?.closed ?? false;
  };
  const blackout = (d: string) => data.blackouts.find((b) => b.day === d) ?? null;
  const bays = data.resources.filter((r) => r.kind === "bay").length;
  const lifts = data.resources.filter((r) => r.kind === "lift").length;
  const techs = data.resources.filter((r) => r.kind === "tech").length;

  return (
    <Page>
      <PageHeader
        title="Calendar"
        description={`${bays} bays · ${lifts} lifts · ${techs} techs`}
        actions={isAdmin ? (
          <Button onClick={() => setBooking(true)} data-testid="calendar-new">
            <PlusIcon /> New appointment
          </Button>
        ) : undefined}
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" aria-label="Earlier" onClick={() => go({ day: addDays(day, -step) })} disabled={pending}><ChevronLeftIcon /></Button>
          <Button variant="outline" size="sm" onClick={() => go({ day: today })} disabled={day === today || pending}>Today</Button>
          <Button variant="outline" size="icon-sm" aria-label="Later" onClick={() => go({ day: addDays(day, step) })} disabled={pending}><ChevronRightIcon /></Button>
          <span className="ml-2 text-sm font-medium" data-testid="calendar-range">{view === "day" ? dayLabelIn(`${day}T12:00:00Z`, "UTC", true) : `${dayLabelIn(`${days[0]}T12:00:00Z`, "UTC")} – ${dayLabelIn(`${days[6]}T12:00:00Z`, "UTC")}`}</span>
        </div>
        <Segmented aria-label="Calendar view" size="sm" items={[{ value: "day", label: "Day" }, { value: "week", label: "Week" }]} value={view} onValueChange={(v) => go({ view: v as "day" | "week" })} />
      </div>

      <div className="mt-4 flex flex-col gap-5" data-testid="calendar-days">
        {days.map((d) => {
          const items = byDay(d);
          const b = blackout(d);
          return (
            <section key={d} data-testid="calendar-day">
              {view === "week" && (
                <h2 className={cn("mb-2 flex items-center gap-2 text-sm font-semibold", d === today && "text-primary")}>
                  {dayLabelIn(`${d}T12:00:00Z`, "UTC")}
                  {d === today && <Badge variant="outline">Today</Badge>}
                  {closed(d) && <Badge variant="muted">Closed</Badge>}
                  {b && <Badge variant="warning">{b.reason ?? "Day off"}</Badge>}
                </h2>
              )}
              {view === "day" && (closed(d) || !!b) && (
                <p className="mb-2 text-sm text-muted-foreground">{b ? `Day off${b.reason ? ` · ${b.reason}` : ""}` : "The shop is closed this day."}</p>
              )}
              {items.length === 0 ? (
                view === "day" ? <EmptyState icon={CalendarDaysIcon} title="Nothing booked" description={isAdmin ? "Book one from here, or share the booking link with a customer." : "No appointments this day."} /> : <p className="text-sm text-muted-foreground">—</p>
              ) : (
                <ul className="flex flex-col gap-2" data-testid="calendar-items">
                  {items.map((i) => (
                    <li key={i.id}>
                      <CalendarRow item={i} tz={tz} showMoney={!!canPrices} resourceName={resourceName} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      {isAdmin && catalog && <AppointmentSheet open={booking} onOpenChange={setBooking} catalog={catalog} recent={recent} tz={tz} />}
    </Page>
  );
}

export function CalendarRow({ item: i, tz, showMoney, resourceName }: { item: CalendarItem; tz: string; showMoney: boolean; resourceName: (id: string) => string }) {
  const held = i.status === "hold" ? holdSecondsLeft(i.hold_expires_at) : 0;
  return (
    <Link href={`/retail/appointments/${i.id}`} className={cn("block rounded-xl border bg-card p-3 surface-raised transition-colors hover:border-border-strong", i.status === "lead" ? "border-warning/50" : i.status === "cancelled" || i.status === "no_show" ? "border-border opacity-60" : "border-border")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-semibold tabular-nums">{timeIn(i.starts_at, tz)} – {timeIn(i.ends_at, tz)}</span>
            <AppointmentStatusBadge status={i.status} />
            {held > 0 && <span className="text-caption tabular-nums text-muted-foreground">{mmss(held)} left</span>}
          </div>
          <div className="mt-1 truncate font-medium">{i.customer ?? "Online customer"}{i.vehicle ? <span className="text-muted-foreground"> · {i.vehicle}</span> : null}</div>
          <div className="truncate text-caption text-subtle">{i.services.join(", ") || "No services"} · {durationLabel(i.duration_minutes)}</div>
        </div>
        <div className="shrink-0 text-right">
          {showMoney && i.total !== null && <div className="text-sm font-semibold tabular-nums">{formatMoney(i.total)}</div>}
          <div className="mt-1 flex flex-wrap justify-end gap-1">
            {i.resource_ids.map((r) => resourceName(r)).filter(Boolean).map((n) => (
              <Badge key={n} variant="outline">{n}</Badge>
            ))}
          </div>
        </div>
      </div>
    </Link>
  );
}
