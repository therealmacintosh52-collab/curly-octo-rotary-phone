import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, FileTextIcon, PlusIcon, WalletIcon } from "lucide-react";
import type { InvoiceListRow } from "@/lib/db/types";
import { INVOICE_PAGE_SIZE } from "@/lib/invoices/query";
import { formatMoney } from "@/lib/money";
import { formatDateOnly } from "@/lib/dates";
import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StaggerItem } from "@/components/motion/primitives";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { RestoreInvoiceButton } from "./restore-invoice-button";
import { cn } from "@/lib/utils";

/** "4821 · 2024 Mercedes-Benz GLE 450", with "+2 more" for the old multi-car invoices. */
export function carsLabel(r: Pick<InvoiceListRow, "cars" | "car_count">): { tag: string; vehicle: string; more: number } {
  const first = r.cars[0];
  return { tag: first?.tag ?? "—", vehicle: first?.vehicle ?? "", more: Math.max(0, r.car_count - 1) };
}

function periodLabel(r: Pick<InvoiceListRow, "period_start" | "period_end">) {
  return r.period_start === r.period_end ? formatDateOnly(r.period_start, "MMM d, yyyy") : `${formatDateOnly(r.period_start, "MMM d")} – ${formatDateOnly(r.period_end, "MMM d, yyyy")}`;
}

const collectable = (r: InvoiceListRow) => r.status !== "void" && r.status !== "paid" && r.balance > 0;

function addDays(ymd: string, n: number) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

/** Header for the first row of each day: "Today · Mon, Sep 28", "Yesterday · Sun, Sep 27", "Fri, Sep 25". Keyed by that row's id. */
function dayGroups(rows: InvoiceListRow[], today: string) {
  const yesterday = addDays(today, -1);
  const totals = new Map<string, { first: string; count: number; total: number }>();
  for (const r of rows) {
    const day = r.period_end;
    const g = totals.get(day) ?? { first: r.id, count: 0, total: 0 };
    g.count += 1;
    g.total += Number(r.total);
    totals.set(day, g);
  }
  const out = new Map<string, { label: string; count: number; total: number }>();
  for (const [day, g] of totals) {
    const date = formatDateOnly(day, "EEE, MMM d");
    out.set(g.first, { label: day === today ? `Today · ${date}` : day === yesterday ? `Yesterday · ${date}` : date, count: g.count, total: g.total });
  }
  return out;
}

function PageLinks({ page, count, params }: { page: number; count: number; params: string }) {
  const pages = Math.max(1, Math.ceil(count / INVOICE_PAGE_SIZE));
  if (pages <= 1) return null;
  const link = (p: number) => {
    const sp = new URLSearchParams(params);
    sp.set("page", String(p));
    return `?${sp.toString()}`;
  };
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Page {page} of {pages}
      </span>
      <div className="flex gap-1">
        <Button asChild variant="outline" size="sm">
          <Link href={link(page - 1)} aria-disabled={page <= 1} className={cn(page <= 1 && "pointer-events-none opacity-50")}>
            <ChevronLeftIcon /> Prev
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={link(page + 1)} aria-disabled={page >= pages} className={cn(page >= pages && "pointer-events-none opacity-50")}>
            Next <ChevronRightIcon />
          </Link>
        </Button>
      </div>
    </div>
  );
}

/**
 * The one list: every car, as its invoice. Desktop: dense table. Phone:
 * tappable cards with Collect on anything still owed (admins).
 */
export function InvoiceList({ rows, page, count, params, isAdmin, filtered, groupByDay = null }: { rows: InvoiceListRow[]; page: number; count: number; params: string; isAdmin: boolean; filtered: boolean; /** Today (yyyy-mm-dd): rows are grouped under day headers (Today, Yesterday, weekday) when set. */ groupByDay?: string | null }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={FileTextIcon}
        title={filtered ? "Nothing matches" : "No cars yet"}
        description={filtered ? "Try a different search or clear the filters." : "Log a car and it shows up here as its own invoice, ready to send or collect."}
        action={
          <Button asChild>
            <Link href="/jobs/new">
              <PlusIcon /> New invoice
            </Link>
          </Button>
        }
      />
    );
  }

  // Day groups (newest first, the order the rows arrive in), with a count and total per day.
  const groups = groupByDay ? dayGroups(rows, groupByDay) : null;

  return (
    <div className="flex flex-col gap-3">
      {/* Mobile cards */}
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((r, i) => {
          const c = carsLabel(r);
          const head = groups?.get(r.id);
          return (
            <Fragment key={r.id}>
            {head && (
              <li className="mt-2 flex items-baseline justify-between gap-3 px-1 first:mt-0" data-testid="day-group">
                <span className="text-sm font-semibold">{head.label}</span>
                <span className="text-caption tabular-nums text-muted-foreground">
                  {head.count} {head.count === 1 ? "car" : "cars"} · {formatMoney(head.total)}
                </span>
              </li>
            )}
            <StaggerItem index={i} as="li">
              {/* Stretched link: the card opens the invoice; "Collect" sits above it. */}
              <div className="relative rounded-xl border border-border bg-card p-4 surface-raised transition-[border-color] duration-150 hover:border-border-strong">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Link href={`/invoices/${r.id}`} className="text-lg font-semibold tracking-wide after:absolute after:inset-0 after:rounded-xl">
                        {c.tag}
                      </Link>
                      {c.more > 0 && <span className="text-caption text-muted-foreground">+{c.more} more</span>}
                    </div>
                    <div className="mt-0.5 truncate text-sm">{c.vehicle || "—"}</div>
                    <div className="truncate text-caption text-muted-foreground">{r.services.join(", ") || "No services"}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold tabular-nums">{formatMoney(r.total)}</div>
                    <div className="mt-1">
                      <InvoiceStatusBadge status={r.status} overdue={r.overdue} deleted={r.deleted} short />
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-caption text-subtle">
                  <span className="truncate">
                    {r.display_number} · {r.dealership}
                  </span>
                  <span className="shrink-0">{periodLabel(r)}</span>
                </div>
                {isAdmin && collectable(r) && (
                  <Button asChild size="sm" variant="soft" className="relative z-10 mt-3 w-full">
                    <Link href={`/terminal?invoice=${r.id}`}>
                      <WalletIcon /> Collect {formatMoney(r.balance)}
                    </Link>
                  </Button>
                )}
                {isAdmin && r.deleted && <RestoreInvoiceButton invoiceId={r.id} number={r.display_number} className="relative z-10 mt-3 w-full" />}
              </div>
            </StaggerItem>
            </Fragment>
          );
        })}
      </ul>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead scope="col">Date</TableHead>
              <TableHead scope="col">Tag</TableHead>
              <TableHead scope="col">Vehicle</TableHead>
              <TableHead scope="col">Services</TableHead>
              <TableHead scope="col">Dealership</TableHead>
              <TableHead scope="col">Invoice</TableHead>
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col" className="text-right">
                Total
              </TableHead>
              {isAdmin && (
                <TableHead scope="col" className="w-28">
                  <span className="sr-only">Collect</span>
                </TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const c = carsLabel(r);
              const head = groups?.get(r.id);
              return (
                <Fragment key={r.id}>
                {head && (
                  <TableRow className="bg-muted/30 hover:bg-muted/30" data-testid="day-group">
                    <TableCell colSpan={isAdmin ? 9 : 8} className="py-2 text-sm">
                      <span className="font-semibold">{head.label}</span>
                      <span className="ml-2 text-caption tabular-nums text-muted-foreground">
                        {head.count} {head.count === 1 ? "car" : "cars"} · {formatMoney(head.total)}
                      </span>
                    </TableCell>
                  </TableRow>
                )}
                <TableRow className={cn(r.status === "void" && !r.deleted && "opacity-60")}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{periodLabel(r)}</TableCell>
                  <TableCell>
                    <Link href={`/invoices/${r.id}`} className="font-semibold tracking-wide text-foreground hover:text-primary">
                      {c.tag}
                    </Link>
                    {c.more > 0 && <span className="ml-1.5 text-caption text-muted-foreground">+{c.more}</span>}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{c.vehicle || "—"}</TableCell>
                  <TableCell className="max-w-64 truncate">{r.services.join(", ")}</TableCell>
                  <TableCell className="text-muted-foreground">{r.dealership}</TableCell>
                  <TableCell>
                    <Link href={`/invoices/${r.id}`} className="tabular-nums text-muted-foreground hover:text-primary">
                      {r.display_number}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <InvoiceStatusBadge status={r.status} overdue={r.overdue} deleted={r.deleted} short />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(r.total)}
                    {r.amount_paid > 0 && r.status !== "paid" && <div className="text-caption text-muted-foreground">{formatMoney(r.amount_paid)} paid</div>}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      {collectable(r) && (
                        <Button asChild size="sm" variant="soft">
                          <Link href={`/terminal?invoice=${r.id}`}>
                            <WalletIcon /> Collect
                          </Link>
                        </Button>
                      )}
                      {r.deleted && <RestoreInvoiceButton invoiceId={r.id} number={r.display_number} />}
                    </TableCell>
                  )}
                </TableRow>
                </Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <PageLinks page={page} count={count} params={params} />
    </div>
  );
}
