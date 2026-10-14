import Link from "next/link";
import { CalendarDaysIcon, ClockIcon, FileTextIcon, LayoutGridIcon, UserIcon, UsersIcon } from "lucide-react";
import type { CalendarItem, EstimateListRow, EstimateStage, RetailMoneySummary, TextQueueRow } from "@/lib/db/types";
import { TextQueue } from "./text-queue";
import { AppointmentStatusBadge } from "./appointment-status-badge";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { documentNumber, STAGE_META, STAGE_ORDER } from "@/lib/retail/estimate-stage";
import { durationLabel, holdSecondsLeft, mmss, timeIn } from "@/lib/retail/slots";
import { Page, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DashboardTab = "action" | "board" | "open" | "closed";

export interface RetailDashboardData {
  tab: DashboardTab;
  /** Workflow tab: lanes per tech (default) or per stage. */
  view?: "tech" | "stage";
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

const daysOpen = (iso: string, now = Date.now()) => Math.floor((now - new Date(iso).getTime()) / 86400000);
/** A visit that has sat for three days or more and is not waiting on payment is flagged late (red outline, like the shop's board). */
const isLate = (r: EstimateListRow) => r.stage !== "closed" && r.stage !== "declined" && r.stage !== "expired" && daysOpen(r.created_at) >= 3;
const titleOf = (r: EstimateListRow) => r.concern ?? documentNumber(r).primary;
const splitName = (name: string | null) => {
  const [first, ...rest] = (name ?? "").trim().split(/\s+/);
  return { first: first || "—", last: rest.join(" ") || "—" };
};

/**
 * The Retail dashboard, laid out like the shop's own page: a title and
 * New estimate, four tabs (what needs action, the workflow board, every open
 * visit, the closed ones), and compact rows. Every row is an estimate (the same
 * document becomes the invoice).
 */
export function RetailDashboard({ data, shopName, tz }: { data: RetailDashboardData; shopName: string; tz: string }) {
  const need = SECTIONS.reduce((n, s) => n + data.open.filter(s.pick).length, 0);
  const tabs: { value: DashboardTab; label: string; count?: number; href: string }[] = [
    { value: "action", label: "Needs action", count: need, href: "/retail" },
    { value: "board", label: "Workflow", count: data.open.length, href: "/retail?tab=board" },
    { value: "open", label: "Open", count: data.open.length, href: "/retail?tab=open" },
    { value: "closed", label: "Closed", count: data.counts.closed, href: "/retail?tab=closed" },
  ];
  return (
    <Page>
      <PageHeader
        eyebrow={shopName}
        title="In the shop"
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
      <nav aria-label="Dashboard tabs" className="mt-4 flex gap-5 overflow-x-auto border-b border-border" data-testid="dash-tabs">
        {tabs.map((t) => (
          <Link key={t.value} href={t.href} scroll={false} aria-current={t.value === data.tab ? "page" : undefined} className={cn("-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 px-0.5 py-2.5 text-sm font-medium transition-colors", t.value === data.tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground")}>
            {t.label}
            {t.count ? <span className="rounded-full bg-primary/15 px-1.5 text-xs text-primary">{t.count}</span> : null}
          </Link>
        ))}
      </nav>

      {data.tab === "action" && <NeedsAction data={data} tz={tz} />}
      {data.tab === "board" && <Board rows={data.open} showMoney={data.showMoney} by={data.view ?? "tech"} />}
      {data.tab === "open" && <VisitTable rows={data.open} showMoney={data.showMoney} testId="dash-open" empty="Nothing is open. Start an estimate from a customer or with New estimate." />}
      {data.tab === "closed" && <VisitTable rows={data.closed} showMoney={data.showMoney} testId="dash-closed" empty="Nothing closed yet." />}
    </Page>
  );
}

function SideCard({ title, icon, children, action, testId }: { title: string; icon: React.ReactNode; children: React.ReactNode; action?: React.ReactNode; testId?: string }) {
  return (
    <section className="rounded-xl border border-border bg-card surface-raised" data-testid={testId}>
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">{icon} {title}</h2>
        {action}
      </header>
      <div className="px-4 py-2">{children}</div>
    </section>
  );
}

function NeedsAction({ data, tz }: { data: RetailDashboardData; tz: string }) {
  const groups = SECTIONS.map((s) => ({ ...s, rows: data.open.filter(s.pick) })).filter((g) => g.rows.length > 0);
  const unpaid = data.open.filter((r) => r.stage === "unpaid");
  const owed = unpaid.reduce((n, r) => n + (r.balance ?? 0), 0);
  return (
    <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start" data-testid="dash-action">
      <div className="grid gap-5">
        {groups.length === 0 ? (
          <p className="rounded-xl border border-border bg-card px-4 py-6 text-sm text-muted-foreground" data-testid="dash-empty">Nothing needs action. Every visit is waiting on the customer, closed, or not started.</p>
        ) : (
          groups.map((g) => (
            <section key={g.key} data-testid={`dash-section-${g.key}`}>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <h2 className="text-label text-subtle">
                  {g.title} <span className="ml-1 text-muted-foreground">{g.rows.length}</span>
                </h2>
                <p className="hidden text-caption text-subtle sm:block">{g.hint}</p>
              </div>
              <ul className="grid gap-2" data-testid={`dash-list-${g.key}`}>
                {g.rows.map((r) => (
                  <li key={r.id}>
                    <VisitRow r={r} showMoney={data.showMoney} />
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <div className="grid gap-4">
        {data.showMoney && data.money && (
          <SideCard title="Money" icon={<FileTextIcon className="size-4 text-primary" />} testId="retail-money">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 py-1 text-sm">
              <Stat label="In this week" value={formatMoney(data.money.collected_week)} />
              <Stat label="Deposits this week" value={formatMoney(data.money.deposits_week)} />
              <Stat label="Unpaid invoices" value={formatMoney(owed)} hint={`${unpaid.length} ${unpaid.length === 1 ? "invoice" : "invoices"}`} />
              <Stat label="Deposits still due" value={formatMoney(data.money.deposits_outstanding.amount)} hint={`${data.money.deposits_outstanding.count} ${data.money.deposits_outstanding.count === 1 ? "booking" : "bookings"}`} />
            </dl>
          </SideCard>
        )}
        {(data.leads.length > 0 || data.holds.length > 0) && (
          <SideCard title="Online bookings" icon={<ClockIcon className="size-4 text-warning" />}>
            <ul className="divide-y divide-border text-sm" data-testid="retail-leads">
              {data.leads.map((a) => (
                <li key={a.id}><ApptRow a={a} tz={tz} hint="Booked online · confirm it or call them" /></li>
              ))}
              {data.holds.map((a) => (
                <li key={a.id}><ApptRow a={a} tz={tz} hint={`Someone is booking · ${mmss(holdSecondsLeft(a.hold_expires_at))} left on the hold`} /></li>
              ))}
            </ul>
          </SideCard>
        )}
        {data.texts.length > 0 && <TextQueue rows={data.texts} />}
        <SideCard title="Appointments today" icon={<CalendarDaysIcon className="size-4 text-primary" />} action={<Link href="/retail/calendar" className="text-caption text-primary hover:underline">Calendar</Link>}>
          {data.appointments.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">Nothing booked today.</p>
          ) : (
            <ul className="divide-y divide-border text-sm" data-testid="retail-appointments">
              {data.appointments.map((a) => (
                <li key={a.id}><ApptRow a={a} tz={tz} /></li>
              ))}
            </ul>
          )}
        </SideCard>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-caption text-subtle">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
      {hint && <div className="text-caption text-subtle">{hint}</div>}
    </div>
  );
}

/** One visit as a row, like "My Current Jobs": the title in bold, the stage and age on the right, who and which car below. */
function VisitRow({ r, showMoney, compact }: { r: EstimateListRow; showMoney: boolean; compact?: boolean }) {
  const n = documentNumber(r);
  const late = isLate(r);
  return (
    <Link href={`/retail/estimates/${r.id}`} className={cn("block rounded-lg border bg-card p-3.5 surface-raised transition-colors hover:border-border-strong", late ? "border-destructive/70" : "border-border")} data-testid="dash-card" data-stage={r.stage} data-late={late || undefined}>
      <div className="flex items-start justify-between gap-3">
        <div className={cn("min-w-0 font-semibold", compact ? "line-clamp-2 text-sm" : "line-clamp-2")}>{titleOf(r)}</div>
        <div className="shrink-0 text-right">
          <div className={cn("text-caption tabular-nums", late ? "font-medium text-destructive" : "text-subtle")}>{late ? `late ${ageLabel(r.created_at)}` : ageLabel(r.created_at)}</div>
          <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{STAGE_META[r.stage ?? "draft"].label}</div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3 text-caption">
        <div className="text-subtle">
          {r.advisor && <div>Advisor: <span className="text-muted-foreground">{r.advisor}</span></div>}
          {r.tech && <div>Tech: <span className="text-muted-foreground">{r.tech}</span></div>}
          <div className="tracking-wide">{n.primary}{n.secondary ? ` (${n.secondary})` : ""}</div>
        </div>
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{r.customer ?? "Customer"}</div>
          <div className="truncate text-muted-foreground">{r.vehicle ?? "No car on file"}</div>
          {showMoney && (r.stage === "unpaid" && r.balance != null ? <div className="font-semibold tabular-nums text-warning">{formatMoney(r.balance)} due</div> : r.total !== null ? <div className="tabular-nums text-muted-foreground">{formatMoney(r.total)}</div> : null)}
          {r.waiting_supplement && <div className="text-warning">more work waiting on them</div>}
        </div>
      </div>
    </Link>
  );
}

/**
 * The workflow board: a lane per tech with the cars they hold (the shop's own
 * "workflow" tab), or a lane per stage. A card outlined in red is late.
 */
function Board({ rows, showMoney, by }: { rows: EstimateListRow[]; showMoney: boolean; by: "tech" | "stage" }) {
  const lanes: { key: string; title: string; items: EstimateListRow[] }[] =
    by === "stage"
      ? STAGE_ORDER.filter((s) => s !== "closed").map((stage) => ({ key: stage, title: STAGE_META[stage].label, items: rows.filter((r) => r.stage === stage) }))
      : (() => {
          const techs = Array.from(new Set(rows.map((r) => r.tech ?? "")));
          techs.sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
          return techs.map((t) => ({ key: t || "none", title: t || "Not assigned", items: rows.filter((r) => (r.tech ?? "") === t) }));
        })();
  const toggle = (value: "tech" | "stage", label: string, icon: React.ReactNode) => (
    <Link href={value === "tech" ? "/retail?tab=board" : "/retail?tab=board&view=stage"} scroll={false} aria-current={by === value ? "true" : undefined} className={cn("inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm", by === value ? "bg-card text-foreground surface-raised" : "text-muted-foreground hover:text-foreground")} data-testid={`board-by-${value}`}>
      {icon} {label}
    </Link>
  );
  return (
    <div className="mt-4">
      <div className="mb-3 flex justify-end gap-0.5 rounded-lg bg-muted p-1 sm:ml-auto sm:w-fit">
        {toggle("tech", "By tech", <UserIcon className="size-3.5" />)}
        {toggle("stage", "By stage", <LayoutGridIcon className="size-3.5" />)}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-3" data-testid="dash-board" data-by={by}>
        {lanes.map((lane) => (
          <section key={lane.key} className="w-72 shrink-0" data-testid={`board-col-${lane.key}`}>
            <h2 className="mb-2 flex items-center justify-between px-1 text-sm font-semibold">
              {lane.title}
              <span className="rounded-full bg-muted px-2 text-xs font-medium text-muted-foreground">{lane.items.length}</span>
            </h2>
            <ul className={cn("grid min-h-24 content-start gap-2 rounded-xl bg-muted/30 p-2", lane.items.length === 0 && "place-items-center")}>
              {lane.items.length === 0 && <li className="text-caption text-subtle">Nothing here</li>}
              {lane.items.map((r) => (
                <li key={r.id}>
                  <VisitRow r={r} showMoney={showMoney} compact />
                </li>
              ))}
            </ul>
          </section>
        ))}
        {lanes.length === 0 && <p className="text-sm text-muted-foreground">Nothing is open.</p>}
      </div>
    </div>
  );
}

/** The open and closed tabs: one row per visit, with the shop's own columns. */
function VisitTable({ rows, showMoney, testId, empty }: { rows: EstimateListRow[]; showMoney: boolean; testId: string; empty: string }) {
  if (rows.length === 0) return <p className="mt-5 text-sm text-muted-foreground" data-testid={`${testId}-empty`}>{empty}</p>;
  const th = "px-3 py-2.5 font-medium";
  return (
    <>
      <ul className="mt-5 grid gap-2 md:hidden" data-testid={testId}>
        {rows.map((r) => (
          <li key={r.id}>
            <VisitRow r={r} showMoney={showMoney} />
          </li>
        ))}
      </ul>
      <div className="mt-5 hidden overflow-x-auto rounded-xl border border-border bg-card md:block" data-testid={`${testId}-table`}>
        <table className="w-full text-sm">
          <thead className="border-b border-border text-left text-caption text-muted-foreground">
            <tr>
              <th scope="col" className={th}>Status</th>
              <th scope="col" className={th}>Started</th>
              <th scope="col" className={th}>Number</th>
              <th scope="col" className={th}>First</th>
              <th scope="col" className={th}>Last</th>
              <th scope="col" className={th}>Vehicle</th>
              <th scope="col" className={th}>Title</th>
              <th scope="col" className={th}>Advisor</th>
              <th scope="col" className={th}>Tech</th>
              {showMoney && <th scope="col" className={cn(th, "text-right")}>Amount</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const n = documentNumber(r);
              const nm = splitName(r.customer);
              return (
                <tr key={r.id} className={cn("hover:bg-accent/40", isLate(r) && "bg-destructive/5")} data-testid="dash-row">
                  <td className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{STAGE_META[r.stage ?? "draft"].label}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">{formatDate(r.created_at)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <Link href={`/retail/estimates/${r.id}`} className="font-semibold tracking-wide text-primary hover:underline">{n.primary}</Link>
                    {n.secondary && <div className="text-caption text-subtle">{n.secondary}</div>}
                  </td>
                  <td className="px-3 py-2.5">{nm.first}</td>
                  <td className="px-3 py-2.5">{nm.last}</td>
                  <td className="max-w-44 px-3 py-2.5 text-muted-foreground">{r.vehicle ?? "—"}</td>
                  <td className="max-w-72 px-3 py-2.5 text-muted-foreground"><span className="line-clamp-2">{r.concern ?? "—"}</span></td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.advisor ?? "—"}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.tech ?? "—"}</td>
                  {showMoney && <td className="px-3 py-2.5 text-right tabular-nums">{r.stage === "unpaid" && r.balance != null ? `${formatMoney(r.balance)} due` : r.total !== null ? formatMoney(r.total) : "—"}</td>}
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
