"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarDaysIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import type { CalendarItem, CalendarRange, RetailCatalog } from "@/lib/db/types";
import type { PickedCustomer } from "./customer-picker";
import { useSession } from "@/components/app/session-provider";
import { formatMoney } from "@/lib/money";
import { addDays, addMonths, dayKeyIn, dayLabelIn, durationLabel, holdSecondsLeft, mmss, monthGrid, monthLabel, timeIn, weekStart } from "@/lib/retail/slots";
import { Page, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { AppointmentStatusBadge } from "./appointment-status-badge";
import { AppointmentSheet } from "./appointment-sheet";

export type CalendarMode = "month" | "week" | "day";

/**
 * The shop's calendar. It opens on the month of today: the month grid with each
 * day's appointments on it, and below it the list of every appointment that
 * month. A week is seven day lists; a day is one time-ordered list with the
 * bay, lift and tech on each row. Every appointment opens its page.
 */
export function CalendarView({ data, day, view, tz, catalog, recent }: { data: CalendarRange; day: string; view: CalendarMode; tz: string; catalog: RetailCatalog | null; recent: PickedCustomer[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAdmin, canPrices } = useSession();
  const [pending, start] = useTransition();
  const [booking, setBooking] = useState(false);
  const today = dayKeyIn(new Date(), tz);
  const resourceName = (id: string) => data.resources.find((r) => r.id === id)?.name ?? "";

  function go(patch: { day?: string; view?: CalendarMode }) {
    const sp = new URLSearchParams();
    const d = patch.day ?? day;
    const v = patch.view ?? view;
    if (v === "month" ? d.slice(0, 7) !== today.slice(0, 7) : d !== today) sp.set("date", d);
    if (v !== "month") sp.set("view", v);
    start(() => router.replace(`${pathname}${sp.size ? `?${sp}` : ""}`));
  }
  const earlier = () => go({ day: view === "month" ? addMonths(day, -1) : addDays(day, view === "day" ? -1 : -7) });
  const later = () => go({ day: view === "month" ? addMonths(day, 1) : addDays(day, view === "day" ? 1 : 7) });
  const atToday = view === "month" ? day.slice(0, 7) === today.slice(0, 7) : day === today;
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
          <Button variant="outline" size="icon-sm" aria-label="Earlier" onClick={earlier} disabled={pending}><ChevronLeftIcon /></Button>
          <Button variant="outline" size="sm" onClick={() => go({ day: today })} disabled={atToday || pending}>Today</Button>
          <Button variant="outline" size="icon-sm" aria-label="Later" onClick={later} disabled={pending}><ChevronRightIcon /></Button>
          <span className="ml-2 text-sm font-medium" data-testid="calendar-range">{view === "month" ? monthLabel(day) : view === "day" ? dayLabelIn(`${day}T12:00:00Z`, "UTC", true) : `${dayLabelIn(`${days[0]}T12:00:00Z`, "UTC")} – ${dayLabelIn(`${days[6]}T12:00:00Z`, "UTC")}`}</span>
        </div>
        <Segmented aria-label="Calendar view" size="sm" items={[{ value: "month", label: "Month" }, { value: "week", label: "Week" }, { value: "day", label: "Day" }]} value={view} onValueChange={(v) => go({ view: v as CalendarMode })} />
      </div>

      {view === "month" && <MonthBody day={day} today={today} tz={tz} items={data.items} closed={closed} blackout={blackout} resourceName={resourceName} showMoney={!!canPrices} isAdmin={isAdmin} onPick={(d) => go({ day: d, view: "day" })} />}

      <div className={cn("mt-4 flex flex-col gap-5", view === "month" && "hidden")} data-testid="calendar-days">
        {view !== "month" && days.map((d) => {
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


/** The month grid and, under it, every appointment of the month, day by day. */
function MonthBody({ day, today, tz, items, closed, blackout, resourceName, showMoney, isAdmin, onPick }: { day: string; today: string; tz: string; items: CalendarItem[]; closed: (d: string) => boolean; blackout: (d: string) => { reason: string | null } | null; resourceName: (id: string) => string; showMoney: boolean; isAdmin: boolean; onPick: (d: string) => void }) {
  const weeks = monthGrid(day);
  const month = day.slice(0, 7);
  const live = (i: CalendarItem) => i.status !== "cancelled" && i.status !== "no_show";
  const byDay = (d: string) => items.filter((i) => dayKeyIn(i.starts_at, tz) === d).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const inMonth = weeks.flat().filter((d) => d.startsWith(month)).map((d) => ({ d, list: byDay(d) })).filter((x) => x.list.length > 0);
  const total = inMonth.reduce((n, x) => n + x.list.length, 0);
  const dow = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return (
    <div className="mt-4" data-testid="calendar-month">
      <div className="overflow-hidden rounded-xl border border-border bg-card surface-raised">
        <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center text-caption text-muted-foreground">
          {dow.map((n) => (
            <div key={n} className="py-1.5">{n}</div>
          ))}
        </div>
        {weeks.map((w) => (
          <div key={w[0]} className="grid grid-cols-7 border-b border-border last:border-b-0">
            {w.map((d) => {
              const list = byDay(d).filter(live);
              const here = d.startsWith(month);
              const off = closed(d) || !!blackout(d);
              return (
                <div key={d} className={cn("min-h-16 border-r border-border p-1 last:border-r-0 sm:min-h-24 sm:p-1.5", !here && "bg-muted/20 text-subtle", here && off && "bg-muted/30")} data-testid="calendar-cell" data-day={d} data-count={list.length}>
                  <button type="button" onClick={() => onPick(d)} aria-label={`Open ${dayLabelIn(`${d}T12:00:00Z`, "UTC", true)}`} className={cn("inline-flex size-6 items-center justify-center rounded-full text-xs font-medium tabular-nums hover:bg-muted sm:size-7 sm:text-sm", d === today && "bg-primary text-primary-foreground hover:bg-primary")}>
                    {Number(d.slice(8))}
                  </button>
                  {list.length > 0 && (
                    <>
                      <span className="mt-1 flex justify-center rounded-full bg-accent-soft px-1.5 text-[11px] font-semibold text-primary sm:hidden" data-testid="cell-count">{list.length}</span>
                      <ul className="mt-1 hidden gap-0.5 sm:grid">
                        {list.slice(0, 3).map((i) => (
                          <li key={i.id}>
                            <Link href={`/retail/appointments/${i.id}`} className={cn("block truncate rounded px-1 py-0.5 text-[11px] leading-tight hover:bg-muted", i.status === "lead" ? "bg-warning/15 text-warning" : i.status === "hold" ? "border border-dashed border-border text-muted-foreground" : "bg-accent-soft text-foreground")} data-testid="cell-appt">
                              <span className="tabular-nums">{timeIn(i.starts_at, tz).replace(" AM", "a").replace(" PM", "p")}</span> {i.customer ?? "Online"}
                            </Link>
                          </li>
                        ))}
                        {list.length > 3 && <li className="px-1 text-[11px] text-muted-foreground">+{list.length - 3} more</li>}
                      </ul>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <h2 className="mt-6 flex items-center gap-2 text-sm font-semibold" data-testid="month-list-heading">
        Appointments in {monthLabel(day)} <Badge variant="muted">{total}</Badge>
      </h2>
      {inMonth.length === 0 ? (
        <div className="mt-3"><EmptyState icon={CalendarDaysIcon} title="Nothing booked this month" description={isAdmin ? "Book one from here, or share the booking link with a customer." : "No appointments this month."} /></div>
      ) : (
        <div className="mt-3 flex flex-col gap-5" data-testid="month-list">
          {inMonth.map(({ d, list }) => (
            <section key={d} data-testid="month-list-day" data-day={d}>
              <h3 className={cn("mb-2 flex items-center gap-2 text-sm font-semibold", d === today && "text-primary")}>
                {dayLabelIn(`${d}T12:00:00Z`, "UTC")}
                {d === today && <Badge variant="outline">Today</Badge>}
              </h3>
              <ul className="flex flex-col gap-2">
                {list.map((i) => (
                  <li key={i.id}>
                    <CalendarRow item={i} tz={tz} showMoney={showMoney} resourceName={resourceName} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
