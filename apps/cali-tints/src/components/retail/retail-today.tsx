import Link from "next/link";
import { CalendarDaysIcon, CarFrontIcon, ClockIcon, FileTextIcon, UsersIcon, WalletIcon, WrenchIcon } from "lucide-react";
import type { CalendarItem, RetailMoneySummary, TextQueueRow } from "@/lib/db/types";
import { TextQueue } from "./text-queue";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { durationLabel, holdSecondsLeft, mmss, timeIn } from "@/lib/retail/slots";
import { AppointmentStatusBadge } from "./appointment-status-badge";
import { Page, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export interface RetailTodayCar {
  id: string;
  tag: string;
  /** The repair order number (0043). */
  ro_number?: string | null;
  vehicle: string | null;
  customer: string | null;
  performed_at: string;
  paid_at: string | null;
  /** Set once the repair order is converted to the invoice (0052); null = still work in progress. */
  invoiced_at?: string | null;
  services: string[];
}

export interface RetailTodayData {
  customers: number;
  /** Retail cars logged today, newest first. */
  today: RetailTodayCar[];
  /** Retail jobs still to collect (any day). */
  unpaid: RetailTodayCar[];
  /** Repair orders in the shop, approved but not invoiced yet (0052). */
  inProgress?: RetailTodayCar[];
  /** Online bookings waiting for a confirmation. */
  leads: CalendarItem[];
  /** Spots held right now by someone booking online. */
  holds: CalendarItem[];
  /** Today's appointments, in order. */
  appointments: CalendarItem[];
  /** Owner/admin only: deposits and what came in this week. */
  money?: RetailMoneySummary | null;
  /** Texts the automations queued for the phone: one tap each. */
  texts?: TextQueueRow[];
}

/**
 * The shop's day: online bookings waiting on a confirmation, today's
 * appointments, walk-in cars logged today, what is still to collect at the
 * counter. No money here: amounts live on the job and appointment pages.
 */
export function RetailToday({ data, shopName, tz }: { data: RetailTodayData; shopName: string; tz: string }) {
  return (
    <Page>
      <PageHeader
        eyebrow={shopName}
        title="Today at the shop"
        description={`${data.appointments.length} ${data.appointments.length === 1 ? "appointment" : "appointments"} · ${data.today.length} ${data.today.length === 1 ? "car" : "cars"} logged · ${data.unpaid.length} to collect · ${data.customers.toLocaleString()} ${data.customers === 1 ? "customer" : "customers"}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/retail/customers/new">
                <UsersIcon /> New customer
              </Link>
            </Button>
            {data.money && (
              <Button asChild>
                <Link href="/retail/estimates/new" data-testid="retail-new-estimate">
                  <FileTextIcon /> New estimate
                </Link>
              </Button>
            )}
          </>
        }
      />

      {data.money && (
        <div className="mt-6 grid gap-3 sm:grid-cols-3" data-testid="retail-money">
          <MoneyTile label="Deposits still due" value={formatMoney(data.money.deposits_outstanding.amount)} hint={`${data.money.deposits_outstanding.count} ${data.money.deposits_outstanding.count === 1 ? "booking" : "bookings"}`} />
          <MoneyTile label="Deposits this week" value={formatMoney(data.money.deposits_week)} hint={data.money.pending_links ? `${data.money.pending_links} pay ${data.money.pending_links === 1 ? "link" : "links"} out` : "all settled"} />
          <MoneyTile label="Collected this week" value={formatMoney(data.money.collected_week)} hint="deposits and counter payments" />
        </div>
      )}

      {(data.texts?.length ?? 0) > 0 && <TextQueue rows={data.texts ?? []} />}

      {(data.leads.length > 0 || data.holds.length > 0) && (
        <Card className="mt-6 border-warning/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClockIcon className="size-4 text-warning" /> Needs a hand
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border text-sm" data-testid="retail-leads">
              {data.leads.map((a) => (
                <li key={a.id}><ApptRow a={a} tz={tz} hint="Booked online · confirm it or call them" /></li>
              ))}
              {data.holds.map((a) => (
                <li key={a.id}><ApptRow a={a} tz={tz} hint={`Someone is booking · ${mmss(holdSecondsLeft(a.hold_expires_at))} left on the hold`} /></li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarDaysIcon className="size-4 text-primary" /> Appointments today
            </CardTitle>
            <Button asChild size="sm" variant="outline">
              <Link href="/retail/calendar">Calendar</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {data.appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing booked today. Share the booking link or book one from the calendar.</p>
            ) : (
              <ul className="divide-y divide-border text-sm" data-testid="retail-appointments">
                {data.appointments.map((a) => (
                  <li key={a.id}><ApptRow a={a} tz={tz} /></li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {(data.inProgress ?? []).length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <WrenchIcon className="size-4 text-primary" /> In the shop
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="divide-y divide-border text-sm" data-testid="retail-in-progress">
                {(data.inProgress ?? []).map((j) => (
                  <li key={j.id}>
                    <CarRow job={j} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WalletIcon className="size-4 text-warning" /> To collect
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.unpaid.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing outstanding. Every walk-in is paid up.</p>
            ) : (
              <ul className="divide-y divide-border text-sm" data-testid="retail-unpaid">
                {data.unpaid.map((j) => (
                  <li key={j.id}>
                    <CarRow job={j} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CarFrontIcon className="size-4 text-primary" /> Logged today
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.today.length === 0 ? (
              <p className="text-sm text-muted-foreground">No walk-ins logged yet today. Check a car in from its appointment, or New job → the shop.</p>
            ) : (
              <ul className="divide-y divide-border text-sm" data-testid="retail-today">
                {data.today.map((j) => (
                  <li key={j.id}>
                    <CarRow job={j} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </Page>
  );
}

function MoneyTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 surface-raised">
      <div className="text-caption text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-caption text-subtle">{hint}</div>
    </div>
  );
}

function ApptRow({ a, tz, hint }: { a: CalendarItem; tz: string; hint?: string }) {
  return (
    <Link href={`/retail/appointments/${a.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent/50">
      <div className="min-w-0">
        <div className="font-medium">
          <span className="tabular-nums">{timeIn(a.starts_at, tz)}</span>
          <span className="text-muted-foreground"> · {a.customer ?? "Online customer"}{a.vehicle ? ` · ${a.vehicle}` : ""}</span>
        </div>
        <div className="truncate text-caption text-subtle">{hint ?? [a.services.join(", "), durationLabel(a.duration_minutes)].filter(Boolean).join(" · ")}</div>
      </div>
      <div className="shrink-0 text-right">
        <AppointmentStatusBadge status={a.status} />
      </div>
    </Link>
  );
}

function CarRow({ job: j }: { job: RetailTodayCar }) {
  return (
    <Link href={`/jobs/${j.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-accent/50">
      <div className="min-w-0">
        <div className="font-medium">
          <span className="tracking-wide">{j.ro_number ?? j.tag}</span>
          {j.vehicle && <span className="text-muted-foreground"> · {j.vehicle}</span>}
        </div>
        <div className="truncate text-caption text-subtle">{[j.customer ?? "No customer on file", j.services.join(", ")].filter(Boolean).join(" · ")}</div>
      </div>
      <div className="shrink-0 text-right">
        {j.paid_at ? <Badge variant="success">Paid</Badge> : j.invoiced_at === null ? <Badge variant="info">In progress</Badge> : <Badge variant="warning">Collect</Badge>}
        <div className="mt-1 text-caption tabular-nums text-subtle">{formatDate(j.performed_at, "MMM d, h:mm a")}</div>
      </div>
    </Link>
  );
}
