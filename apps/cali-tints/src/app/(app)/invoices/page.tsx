import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceStatus } from "@/lib/db/types";
import { formatMoney } from "@/lib/money";
import { formatDate, formatDateOnly, nowMs } from "@/lib/dates";
import { Page, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { InvoiceStatusTabs } from "@/components/invoices/invoice-status-tabs";
import { BulkDownloadBanner } from "@/components/invoices/bulk-download-banner";

export const metadata: Metadata = { title: "Invoices" };

const STATUSES: InvoiceStatus[] = ["draft", "submitted", "partial", "paid", "void"];

export default async function InvoicesPage(props: PageProps<"/invoices">) {
  const sp = await props.searchParams;
  const session = await requireAdmin();
  const supabase = await createClient();
  const status = typeof sp.status === "string" && (STATUSES as string[]).includes(sp.status) ? (sp.status as InvoiceStatus) : undefined;
  const created = typeof sp.created === "string" ? sp.created.split(",").filter(Boolean) : [];

  let q = supabase
    .from("invoices")
    .select("id, display_number, period_start, period_end, ro_po_number, total, amount_paid, status, submitted_at, paid_at, created_at, dealership:dealerships(name)")
    .order("number", { ascending: false })
    .limit(200);
  if (status) q = q.eq("status", status);
  else q = q.neq("status", "void");
  const { data: invoices } = await q;

  const reminderMs = session.company.reminder_days * 86400000;
  const isOverdue = (i: { status: InvoiceStatus; submitted_at: string | null }) =>
    (i.status === "submitted" || i.status === "partial") && !!i.submitted_at && nowMs() - new Date(i.submitted_at).getTime() > reminderMs;

  return (
    <Page>
      <PageHeader
        title="Invoices"
        description="Generate, send and track payment."
        actions={
          <Button asChild>
            <Link href="/invoices/new">
              <PlusIcon /> New invoice
            </Link>
          </Button>
        }
      />
      {created.length > 0 && <BulkDownloadBanner ids={created} />}
      <div className="mt-5 flex flex-col gap-4">
        <InvoiceStatusTabs value={status ?? "all"} />

        {(invoices ?? []).length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            No invoices here yet.{" "}
            <Link href="/invoices/new" className="text-primary hover:underline">
              Generate one
            </Link>
            .
          </div>
        ) : (
          <>
            <ul className="flex flex-col gap-2 md:hidden">
              {(invoices ?? []).map((i) => (
                <li key={i.id}>
                  <Link href={`/invoices/${i.id}`} className="block rounded-xl border border-border bg-card p-4 active:bg-accent">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold">{i.display_number}</div>
                        <div className="truncate text-sm text-muted-foreground">{(i.dealership as unknown as { name: string } | null)?.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatDateOnly(i.period_start, "MMM d")} – {formatDateOnly(i.period_end, "MMM d, yyyy")}
                          {i.ro_po_number ? ` · ${i.ro_po_number}` : ""}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-semibold tabular-nums">{formatMoney(i.total)}</div>
                        <div className="mt-1">
                          <InvoiceStatusBadge status={i.status} overdue={isOverdue(i)} />
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-hidden rounded-xl border border-border md:block">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead>Invoice</TableHead>
                    <TableHead>Dealership</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>RO/PO</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(invoices ?? []).map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>
                        <Link href={`/invoices/${i.id}`} className="font-semibold hover:text-primary">
                          {i.display_number}
                        </Link>
                      </TableCell>
                      <TableCell>{(i.dealership as unknown as { name: string } | null)?.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDateOnly(i.period_start, "MMM d")} – {formatDateOnly(i.period_end, "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{i.ro_po_number ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">{formatDate(i.created_at)}</TableCell>
                      <TableCell className="text-muted-foreground">{i.submitted_at ? formatDate(i.submitted_at) : "—"}</TableCell>
                      <TableCell>
                        <InvoiceStatusBadge status={i.status} overdue={isOverdue(i)} />
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{Number(i.amount_paid) > 0 ? formatMoney(i.amount_paid) : "—"}</TableCell>
                      <TableCell className="text-right font-medium tabular-nums">{formatMoney(i.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </Page>
  );
}
