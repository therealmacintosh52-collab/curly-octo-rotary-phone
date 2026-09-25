import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import type { JobListRow } from "@/lib/jobs/query";
import { formatMoney, sumPrices } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

export function vehicleLabel(j: { year: number | null; make: string | null; model: string | null }): string {
  return [j.year, j.make, j.model].filter(Boolean).join(" ") || "—";
}

export function JobStatusBadge({ row }: { row: Pick<JobListRow, "deleted_at" | "invoice"> }) {
  if (row.deleted_at) return <Badge variant="destructive">Deleted</Badge>;
  if (row.invoice) {
    const v = row.invoice.status === "paid" ? "success" : row.invoice.status === "void" ? "muted" : "info";
    return (
      <Badge variant={v} title={row.invoice.display_number}>
        {row.invoice.status === "paid" ? "Paid" : row.invoice.status === "void" ? "Void inv." : "Invoiced"}
      </Badge>
    );
  }
  return <Badge variant="warning">Uninvoiced</Badge>;
}

function PageLinks({ page, pages }: { page: number; pages: number }) {
  if (pages <= 1) return null;
  const link = (p: number) => {
    // Preserve filters; only swap the page param.
    const sp = typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
    const params = sp ?? new URLSearchParams();
    params.set("page", String(p));
    return `?${params.toString()}`;
  };
  return (
    <div className="flex items-center justify-between text-sm text-muted-foreground">
      <span>
        Page {page} of {pages}
      </span>
      <div className="flex gap-1">
        <Button asChild variant="outline" size="sm" disabled={page <= 1}>
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

/** Desktop: dense table. Phone: tappable cards. Same data, same links. */
export function JobsTable({ rows, page, pages, isAdmin }: { rows: JobListRow[]; page: number; pages: number; isAdmin: boolean }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
        No jobs match. Try clearing filters, or{" "}
        <Link href="/jobs/new" className="text-primary underline-offset-4 hover:underline">
          log one
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Mobile cards */}
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((r) => {
          const total = sumPrices(r.job_services);
          return (
            <li key={r.id}>
              <Link href={`/jobs/${r.id}`} className="block rounded-xl border border-border bg-card p-4 active:bg-accent">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold tracking-wide">{r.tag_number}</span>
                      <JobStatusBadge row={r} />
                    </div>
                    <div className="truncate text-sm">{vehicleLabel(r)}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {r.job_services.map((s) => s.service?.name).filter(Boolean).join(", ") || "No services"}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold tabular-nums">{formatMoney(total)}</div>
                    <div className="text-xs text-muted-foreground">{formatDate(r.performed_at, "MMM d")}</div>
                  </div>
                </div>
                {isAdmin && (
                  <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                    <span>{r.detailer?.full_name}</span>
                    <span>{r.dealership?.name}</span>
                  </div>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-xl border border-border md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead>Date</TableHead>
              <TableHead>Tag</TableHead>
              <TableHead>Vehicle</TableHead>
              <TableHead className="hidden xl:table-cell">VIN</TableHead>
              <TableHead>Services</TableHead>
              {isAdmin && <TableHead>Detailer</TableHead>}
              {isAdmin && <TableHead>Dealership</TableHead>}
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className={cn(r.deleted_at && "opacity-60")}>
                <TableCell className="text-muted-foreground">{formatDateTime(r.performed_at)}</TableCell>
                <TableCell>
                  <Link href={`/jobs/${r.id}`} className="font-semibold tracking-wide text-foreground hover:text-primary">
                    {r.tag_number}
                  </Link>
                </TableCell>
                <TableCell>{vehicleLabel(r)}</TableCell>
                <TableCell className="hidden font-mono text-xs text-muted-foreground xl:table-cell">{r.vin ?? "—"}</TableCell>
                <TableCell className="max-w-64 truncate">{r.job_services.map((s) => s.service?.name).filter(Boolean).join(", ")}</TableCell>
                {isAdmin && <TableCell>{r.detailer?.full_name}</TableCell>}
                {isAdmin && <TableCell className="text-muted-foreground">{r.dealership?.name}</TableCell>}
                <TableCell>
                  <JobStatusBadge row={r} />
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">{formatMoney(sumPrices(r.job_services))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <PageLinks page={page} pages={pages} />
    </div>
  );
}
