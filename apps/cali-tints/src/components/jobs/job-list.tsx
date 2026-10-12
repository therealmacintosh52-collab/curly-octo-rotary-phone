import Link from "next/link";
import { Fragment } from "react";
import { CameraIcon, CarFrontIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon } from "lucide-react";
import type { JobListRow } from "@/lib/db/types";
import { JOB_PAGE_SIZE } from "@/lib/jobs/query";
import { dayHeading, formatDate } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StaggerItem } from "@/components/motion/primitives";
import { cn } from "@/lib/utils";

/** Drop the make when it is the default one, so "4821 · 2024 GLE 450" fits a phone row. */
const shortVehicle = (v: string | null) => v?.replace(/^(\d{4} )?Mercedes-Benz /, "$1") ?? null;

/** Header for the first row of each day: "Today · Mon, Sep 28", keyed by that row's id. */
function dayGroups(rows: JobListRow[], today: string) {
  const counts = new Map<string, { first: string; count: number }>();
  for (const r of rows) {
    const g = counts.get(r.day) ?? { first: r.id, count: 0 };
    g.count += 1;
    counts.set(r.day, g);
  }
  const out = new Map<string, { label: string; count: number }>();
  for (const [day, g] of counts) out.set(g.first, { label: dayHeading(day, today), count: g.count });
  return out;
}

function PageLinks({ page, count, params }: { page: number; count: number; params: string }) {
  const pages = Math.max(1, Math.ceil(count / JOB_PAGE_SIZE));
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

/** "On INV-000061" / "Waiting for the month's invoice" / "Deleted". The owner also sees "Needs price". */
function JobState({ r, short, flagged }: { r: JobListRow; short?: boolean; flagged?: boolean }) {
  if (r.deleted) return <Badge variant="destructive" title="Deleted · kept in the archive">Deleted</Badge>;
  if (r.retail) return r.paid_at ? <Badge variant="success" title="Retail customer · paid at the counter">Paid</Badge> : <Badge variant="warning" title="Retail customer · collect at the counter on the Clover">Collect</Badge>;
  if (flagged && !r.invoice_id) return <Badge variant="warning" title="Logged as Other without a price · set it with Edit job">Needs price</Badge>;
  if (r.invoice_id) return <Badge variant="info" title={`On invoice ${r.quickbooks_doc_number ?? r.display_number ?? ""}`}>{short ? "Invoiced" : (r.quickbooks_doc_number ? `QB ${r.quickbooks_doc_number}` : (r.display_number ?? "Invoiced"))}</Badge>;
  if (r.quickbooks_doc_number) return <Badge variant="muted" title={`On this month's QuickBooks invoice ${r.quickbooks_doc_number}, still open`}>{short ? `QB ${r.quickbooks_doc_number}` : `In QuickBooks · ${r.quickbooks_doc_number}`}</Badge>;
  return <Badge variant="muted" title="Goes on the dealership's QuickBooks invoice as soon as it syncs">{short ? "Open" : "Not in QuickBooks yet"}</Badge>;
}

/**
 * The Jobs list: every car logged, newest first under day headers. Desktop:
 * dense table. Phone: tappable cards. No money anywhere.
 */
export function JobList({ rows, page, count, params, isAdmin, filtered, today, flagged }: { rows: JobListRow[]; page: number; count: number; params: string; isAdmin: boolean; filtered: boolean; /** Today (yyyy-mm-dd): rows are grouped under day headers. */ today: string; /** Owner only: job ids with a line still needing a price. */ flagged?: string[] }) {
  const needsPrice = new Set(flagged ?? []);
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={CarFrontIcon}
        title={filtered ? "Nothing matches" : "No jobs yet"}
        description={filtered ? "Try a different search or clear the filters." : "Log a car and it shows up here. The month's jobs become one invoice per dealership on the 1st."}
        action={
          <Button asChild>
            <Link href="/jobs/new">
              <PlusIcon /> New job
            </Link>
          </Button>
        }
      />
    );
  }

  const groups = dayGroups(rows, today);

  return (
    <div className="flex flex-col gap-3">
      {/* Mobile cards */}
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((r, i) => {
          const head = groups.get(r.id);
          return (
            <Fragment key={r.id}>
              {head && (
                <li className="mt-2 flex items-baseline justify-between gap-3 px-1 first:mt-0" data-testid="day-group">
                  <span className="text-sm font-semibold">{head.label}</span>
                  <span className="text-caption tabular-nums text-muted-foreground">
                    {head.count} {head.count === 1 ? "car" : "cars"}
                  </span>
                </li>
              )}
              <StaggerItem index={i} as="li">
                <div className={cn("relative rounded-xl border border-border bg-card p-4 surface-raised transition-[border-color] duration-150 hover:border-border-strong", r.deleted && "opacity-60")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/jobs/${r.id}`} className="text-lg font-semibold tracking-wide after:absolute after:inset-0 after:rounded-xl">
                        {r.tag}
                      </Link>
                      <div className="mt-0.5 truncate text-sm">{shortVehicle(r.vehicle) || "—"}</div>
                      <div className="truncate text-caption text-muted-foreground">{r.services.join(", ") || "No services"}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <JobState r={r} short flagged={needsPrice.has(r.id)} />
                      {r.photo_count > 0 && (
                        <div className="mt-1 flex items-center justify-end gap-1 text-caption text-subtle">
                          <CameraIcon className="size-3.5" /> {r.photo_count}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-caption text-subtle">
                    <span className="truncate">
                      {r.dealership}
                      {isAdmin ? ` · ${r.detailer}` : ""}
                    </span>
                    <span className="shrink-0">{formatDate(r.performed_at, "h:mm a")}</span>
                  </div>
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
              <TableHead scope="col">Time</TableHead>
              <TableHead scope="col">Stock #</TableHead>
              <TableHead scope="col">Vehicle</TableHead>
              <TableHead scope="col">Services</TableHead>
              <TableHead scope="col">Dealership</TableHead>
              {isAdmin && <TableHead scope="col">Detailer</TableHead>}
              <TableHead scope="col">Photos</TableHead>
              <TableHead scope="col">Invoice</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const head = groups.get(r.id);
              const cols = isAdmin ? 8 : 7;
              return (
                <Fragment key={r.id}>
                  {head && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30" data-testid="day-group">
                      <TableCell colSpan={cols} className="py-2 text-sm">
                        <span className="font-semibold">{head.label}</span>
                        <span className="ml-2 text-caption tabular-nums text-muted-foreground">
                          {head.count} {head.count === 1 ? "car" : "cars"}
                        </span>
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow className={cn(r.deleted && "opacity-60")}>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(r.performed_at, "h:mm a")}</TableCell>
                    <TableCell>
                      <Link href={`/jobs/${r.id}`} className="font-semibold tracking-wide text-foreground hover:text-primary">
                        {r.tag}
                      </Link>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{r.vehicle || "—"}</TableCell>
                    <TableCell className="max-w-64 truncate">{r.services.join(", ")}</TableCell>
                    <TableCell className="text-muted-foreground">{r.dealership}</TableCell>
                    {isAdmin && <TableCell className="text-muted-foreground">{r.detailer}</TableCell>}
                    <TableCell className="text-muted-foreground">{r.photo_count > 0 ? r.photo_count : "—"}</TableCell>
                    <TableCell>
                      {r.invoice_id ? (
                        <Link href={`/invoices/${r.invoice_id}`} className="tabular-nums hover:text-primary">
                          <JobState r={r} />
                        </Link>
                      ) : (
                        <JobState r={r} flagged={needsPrice.has(r.id)} />
                      )}
                    </TableCell>
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
