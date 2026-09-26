import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon, ClipboardListIcon, PlusIcon } from "lucide-react";
import type { JobListRow } from "@/lib/jobs/query";
import { formatMoney, sumPrices } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StaggerItem } from "@/components/motion/primitives";
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

/** Desktop: dense table. Phone: tappable cards. Same data, same links. */
export function JobsTable({ rows, page, pages, isAdmin }: { rows: JobListRow[]; page: number; pages: number; isAdmin: boolean }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ClipboardListIcon}
        title="No jobs match"
        description="Try a different search or clear the filters. Every car you log shows up here."
        action={
          <Button asChild>
            <Link href="/jobs/new">
              <PlusIcon /> Log a job
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Mobile cards */}
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((r, i) => {
          const total = sumPrices(r.job_services);
          return (
            <StaggerItem key={r.id} index={i} as="li">
              <Link href={`/jobs/${r.id}`} className="group block rounded-xl border border-border bg-card p-4 surface-raised transition-[border-color,background-color] duration-150 hover:border-border-strong active:bg-accent">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold tracking-wide">{r.tag_number}</span>
                      <JobStatusBadge row={r} />
                    </div>
                    <div className="mt-0.5 truncate text-sm">{vehicleLabel(r)}</div>
                    <div className="truncate text-caption text-muted-foreground">{r.job_services.map((s) => s.service?.name).filter(Boolean).join(", ") || "No services"}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="font-semibold tabular-nums">{formatMoney(total)}</div>
                    <div className="text-caption text-muted-foreground">{formatDate(r.performed_at, "MMM d")}</div>
                  </div>
                </div>
                {isAdmin && r.dealership?.name && <div className="mt-2 truncate text-caption text-subtle">{r.dealership.name}</div>}
              </Link>
            </StaggerItem>
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
              <TableHead scope="col" className="hidden xl:table-cell">
                VIN
              </TableHead>
              <TableHead scope="col">Services</TableHead>
              {isAdmin && <TableHead scope="col">Dealership</TableHead>}
              <TableHead scope="col">Status</TableHead>
              <TableHead scope="col" className="text-right">
                Total
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id} className={cn(r.deleted_at && "opacity-60")}>
                <TableCell className="text-muted-foreground">{formatDate(r.performed_at)}</TableCell>
                <TableCell>
                  <Link href={`/jobs/${r.id}`} className="font-semibold tracking-wide text-foreground hover:text-primary">
                    {r.tag_number}
                  </Link>
                </TableCell>
                <TableCell>{vehicleLabel(r)}</TableCell>
                <TableCell className="hidden font-mono text-xs text-muted-foreground xl:table-cell">{r.vin ?? "—"}</TableCell>
                <TableCell className="max-w-64 truncate">{r.job_services.map((s) => s.service?.name).filter(Boolean).join(", ")}</TableCell>
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
