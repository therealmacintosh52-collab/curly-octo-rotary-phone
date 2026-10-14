import Link from "next/link";
import { CalendarDaysIcon, ClockIcon, FileTextIcon, UsersIcon } from "lucide-react";
import type { CalendarItem, EstimateListRow, EstimateStage, RetailMoneySummary, TextQueueRow } from "@/lib/db/types";
import { TextQueue } from "./text-queue";
import { EstimateStageBadge } from "./estimate-stage-badge";
import { AppointmentStatusBadge } from "./appointment-status-badge";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { documentNumber, STAGE_META, STAGE_ORDER } from "@/lib/retail/estimate-stage";
import { durationLabel, holdSecondsLeft, mmss, timeIn } from "@/lib/retail/slots";
import { Page, PageHeader } from "@/components/app/page-header";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type DashboardTab = "action" | "board" | "open" | "closed";

export interface RetailDashboardData {
  tab: DashboardTab;
  customers: number;
  /** Every visit that is still open (not closed, declined or expired), newest first. */
  open: EstimateListRow[];
  /** The closed tab: visits that were paid, signed and picked up. */
  closed: EstimateListRow[];
  counts: Partial<Record<EstimateStage, number>>;
  /** Online bookings waiting for a confirmation, and spots held right now. */
  leads: CalendarItem[];
  holds: CalendarItem[];
  appointments: CalendarItem[];
  /** Texts the automations queued for the phone: one tap each. */
  texts: TextQueueRow[];
  /** Owner, admin, advisor: amounts and what is still owed. */
  showMoney: boolean;
  /** What came in and what is still owed (pricers only). */
  money?: RetailMoneySummary | null;
}

/** What needs doing, in the order the shop works a car. A visit with more work out for approval waits with the customers. */
const SECTIONS: { key: string; title: string; hint: string; pick: (r: EstimateListRow) => boolean }[] = [
  { key: "draft", title: "Finish the estimate", hint: "Written but not sent", pick: (r) => r.stage === "draft" },
  { key: "sent", title: "Waiting on the customer", hint: "An estimate or more work is out for their answer", pick: (r) => r.stage === "sent" || (r.stage === "in_progress" && !!r.waiting_supplement) },
  { key: "in_progress", title: "In progress", hint: "Approved: do the work, write what was done, check it", pick: (r) => r.stage === "in_progress" && !r.waiting_supplement },
  { key: "ready", title: "Ready to invoice", hint: "The work is done and checked", pick: (r) => r.stage === "ready" },
  { key: "unpaid", title: "Unpaid", hint: "The invoice is out: collect payment", pick: (r) => r.stage === "unpaid" },
  { key: "paid", title: "Paid: signature and pickup", hint: "The customer signs, then close it", pick: (r) => r.stage === "paid" },
];

/** "today", "1 day", "5 days": how long a visit has been open. */
export function ageLabel(iso: string, now = Date.now()): string {
  const days = Math.floor((now - new Date(iso).getTime()) / 86400000);
  return days <= 0 ? "today" : days === 1 ? "1 day" : `${days} days`;
}

/**
 * The Retail dashboard: opens the section. Tabs like the shop's own board:
 * what needs action, the board by stage, every open visit, the closed ones.
 * Every row is an estimate (the same document becomes the invoice); retail has
 * no jobs.
 */
export function RetailDashboard({ data, shopName, tz }: { data: RetailDashboardData; shopName: string; tz: string }) {
  const unpaid = data.open.filter((r) => r.stage === "unpaid");
  const owed = unpaid.reduce((n, r) => n + (r.balance ?? 0), 0);
  const need = SECTIONS.reduce((n, s) => n + data.open.filter(s.pick).length, 0);
  const tabs = [
    { value: "action", label: need > 0 ? `Needs action ${need}` : "Needs action", href: "/retail" },
    { value: "board", label: "Board", href: "/retail?tab=board" },
    { value: "open", label: `Open ${data.open.length}`, href: "/retail?tab=open" },
    { value: "closed", label: `Closed${data.counts.closed ? ` ${data.counts.closed}` : ""}`, href: "/retail?tab=closed" },
  ];
  return (
    <Page>
      <PageHeader
        eyebrow={shopName}
        title="Dashboard"
        description={`${need} ${need === 1 ? "visit needs" : "visits need"} action · ${data.open.length} open · ${data.customers.toLocaleString()} ${data.customers === 1 ? "customer" : "customers"}`}
        actions={
          <>
            <Button asChild variant="outline">
              <Link href="/retail/customers/new">
                <UsersIcon /> New customer
              </Link>
            </Button>
            {data.showMoney && (
              <Button asChild>
                <Link href="/retail/estimates/new" data-testid="retail-new-estimate">
                  <FileTextIcon /> New estimate
                </Link>
              </Button>
            )}
          </>
        }
      />
      {data.showMoney && data.money && (
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4" data-testid="retail-money">
          <Tile label="In this week" value={formatMoney(data.money.collected_week)} />
          <Tile label="Deposits this week" value={formatMoney(data.money.deposits_week)} />
          <Tile label="Unpaid invoices" value={formatMoney(owed)} hint={`${unpaid.length} ${unpaid.length === 1 ? "invoice" : "invoices"}`} />
          <Tile label="Deposits still due" value={formatMoney(data.money.deposits_outstanding.amount)} hint={`${data.money.deposits_outstanding.count} ${data.money.deposits_outstanding.count === 1 ? "booking" : "bookings"}`} />
        </div>
      )}
      <div className="mt-5">
        <Segmented aria-label="Dashboard tabs" items={tabs} value={data.tab} wrap />
      </div>

      {data.tab === "action" && <NeedsAction data={data} tz={tz} />}
      {data.tab === "board" && <Board rows={data.open} showMoney={data.showMoney} />}
      {data.tab === "open" && <VisitTable rows={data.open} showMoney={data.showMoney} testId="dash-open" empty="Nothing is open. Start an estimate from a customer or with New estimate." />}
      {data.tab === "closed" && <VisitTable rows={data.closed} showMoney={data.showMoney} testId="dash-closed" empty="Nothing closed yet." />}
    </Page>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 surface-raised">
      <div className="text-label text-subtle">{label}</div>
      <div className="mt-0.5 text-lg font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-caption text-subtle">{hint}</div>}
    </div>
  );
}

function NeedsAction({ data, tz }: { data: RetailDashboardData; tz: string }) {
  const groups = SECTIONS.map((s) => ({ ...s, rows: data.open.filter(s.pick) })).filter((g) => g.rows.length > 0);
  return (
    <div className="mt-5 grid gap-5" data-testid="dash-action">
      {(data.leads.length > 0 || data.holds.length > 0) && (
        <Card className="border-warning/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClockIcon className="size-4 text-warning" /> Online bookings
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

      {groups.length === 0 ? (
        <Card>
          <CardContent className="pt-5 text-sm text-muted-foreground" data-testid="dash-empty">Nothing needs action. Every visit is waiting on the customer, closed, or not started.</CardContent>
        </Card>
      ) : (
        groups.map((g) => (
          <section key={g.key} data-testid={`dash-section-${g.key}`}>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold">
                {g.title} <span className="ml-1 text-sm font-normal text-muted-foreground">{g.rows.length}</span>
              </h2>
              <p className="hidden text-caption text-subtle sm:block">{g.hint}</p>
            </div>
            <ul className="grid gap-2 md:grid-cols-2" data-testid={`dash-list-${g.key}`}>
              {g.rows.map((r) => (
                <li key={r.id}>
                  <VisitCard r={r} showMoney={data.showMoney} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}

      {data.texts.length > 0 && <TextQueue rows={data.texts} />}

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
    </div>
  );
}

/** One visit as a card: number, customer, car, what they said, where it stands, how long, what is owed. */
function VisitCard({ r, showMoney, compact }: { r: EstimateListRow; showMoney: boolean; compact?: boolean }) {
  const n = documentNumber(r);
  return (
    <Link href={`/retail/estimates/${r.id}`} className="block rounded-xl border border-border bg-card p-3.5 surface-raised transition-colors hover:border-border-strong" data-testid="dash-card" data-stage={r.stage}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-semibold">{r.customer ?? "Customer"}</div>
          <div className="truncate text-sm text-muted-foreground">{r.vehicle ?? "No car on file"}</div>
        </div>
        <div className="shrink-0 text-right">
          <EstimateStageBadge stage={r.stage} status={r.status} />
          {showMoney && (r.stage === "unpaid" && r.balance != null ? <div className="mt-1 text-sm font-semibold tabular-nums text-warning">{formatMoney(r.balance)} due</div> : r.total !== null ? <div className="mt-1 text-sm font-semibold tabular-nums">{formatMoney(r.total)}</div> : null)}
        </div>
      </div>
      {!compact && r.concern && <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">&ldquo;{r.concern}&rdquo;</p>}
      <div className="mt-2 flex flex-wrap items-center gap-x-2 text-caption text-subtle">
        <span className="tracking-wide">{n.primary}</span>
        {n.secondary && <span>({n.secondary})</span>}
        <span>· {ageLabel(r.created_at)}</span>
        {r.waiting_supplement && <span className="text-warning">· more work waiting on them</span>}
        {(r.advisor || r.tech) && <span className="ml-auto">{[r.advisor, r.tech].filter(Boolean).join(" · ")}</span>}
      </div>
    </Link>
  );
}

/** The board: a column per stage, a card per car, like the shop's own board. */
function Board({ rows, showMoney }: { rows: EstimateListRow[]; showMoney: boolean }) {
  const cols = STAGE_ORDER.filter((s) => s !== "closed");
  return (
    <div className="mt-5 flex gap-3 overflow-x-auto pb-3" data-testid="dash-board">
      {cols.map((stage) => {
        const items = rows.filter((r) => r.stage === stage);
        return (
          <section key={stage} className="w-72 shrink-0" data-testid={`board-col-${stage}`}>
            <h2 className="mb-2 flex items-center justify-between px-1 text-sm font-semibold">
              {STAGE_META[stage].label}
              <span className="rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">{items.length}</span>
            </h2>
            <ul className={cn("grid min-h-24 content-start gap-2 rounded-xl bg-muted/30 p-2", items.length === 0 && "place-items-center")}>
              {items.length === 0 && <li className="text-caption text-subtle">Nothing here</li>}
              {items.map((r) => (
                <li key={r.id}>
                  <VisitCard r={r} showMoney={showMoney} compact />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

/** The open and closed tabs: one row per visit. */
function VisitTable({ rows, showMoney, testId, empty }: { rows: EstimateListRow[]; showMoney: boolean; testId: string; empty: string }) {
  if (rows.length === 0) return <p className="mt-5 text-sm text-muted-foreground" data-testid={`${testId}-empty`}>{empty}</p>;
  return (
    <>
      <ul className="mt-5 grid gap-2 md:hidden" data-testid={testId}>
        {rows.map((r) => (
          <li key={r.id}>
            <VisitCard r={r} showMoney={showMoney} />
          </li>
        ))}
      </ul>
      <div className="mt-5 hidden overflow-hidden rounded-xl border border-border md:block" data-testid={`${testId}-table`}>
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-caption text-muted-foreground">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Number</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Customer</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Vehicle</th>
              <th scope="col" className="px-4 py-2.5 font-medium">What they said</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Stage</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Opened</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Advisor · tech</th>
              {showMoney && <th scope="col" className="px-4 py-2.5 text-right font-medium">Amount</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const n = documentNumber(r);
              return (
                <tr key={r.id} className="hover:bg-accent/40">
                  <td className="px-4 py-2.5">
                    <Link href={`/retail/estimates/${r.id}`} className="font-semibold tracking-wide hover:text-primary">{n.primary}</Link>
                    {n.secondary && <div className="text-caption text-subtle">{n.secondary}</div>}
                  </td>
                  <td className="px-4 py-2.5">{r.customer ?? "—"}</td>
                  <td className="max-w-48 truncate px-4 py-2.5 text-muted-foreground">{r.vehicle ?? "—"}</td>
                  <td className="max-w-64 truncate px-4 py-2.5 text-muted-foreground">{r.concern ?? "—"}</td>
                  <td className="px-4 py-2.5"><EstimateStageBadge stage={r.stage} status={r.status} /></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{formatDate(r.created_at)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{[r.advisor, r.tech].filter(Boolean).join(" · ") || "—"}</td>
                  {showMoney && <td className="px-4 py-2.5 text-right tabular-nums">{r.stage === "unpaid" && r.balance != null ? `${formatMoney(r.balance)} due` : r.total !== null ? formatMoney(r.total) : "—"}</td>}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
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
