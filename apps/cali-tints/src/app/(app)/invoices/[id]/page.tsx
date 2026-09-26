import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { loadInvoiceBundle } from "@/lib/invoices/load";
import { formatMoney, formatTaxRate } from "@/lib/money";
import { formatDate, formatDateOnly, formatDateTime, nowMs } from "@/lib/dates";
import { Page } from "@/components/app/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { InvoiceActions } from "@/components/invoices/invoice-actions";
import { PaymentsCard } from "@/components/invoices/payments-card";
import { SubmissionsCard } from "@/components/invoices/submissions-card";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoiceDetailPage(props: PageProps<"/invoices/[id]">) {
  const { id } = await props.params;
  const session = await requireAdmin();
  const bundle = await loadInvoiceBundle(id);
  if (!bundle) notFound();
  const { invoice, items, dealership, company, payments, submissions } = bundle;

  // Signed URLs for uploaded confirmations.
  const supabase = await createClient();
  const submissionsWithUrls = await Promise.all(
    submissions.map(async (s) => {
      if (!s.confirmation_path) return { ...s, confirmation_url: null };
      const { data } = await supabase.storage.from("submission-confirmations").createSignedUrl(s.confirmation_path, 3600);
      return { ...s, confirmation_url: data?.signedUrl ?? null };
    }),
  );

  const balance = Number(invoice.total) - Number(invoice.amount_paid);
  const overdue =
    (invoice.status === "submitted" || invoice.status === "partial") &&
    !!invoice.submitted_at &&
    nowMs() - new Date(invoice.submitted_at).getTime() > session.company.reminder_days * 86400000;

  return (
    <Page>
      <Link href="/invoices" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Invoices
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight">{invoice.display_number}</h1>
            <InvoiceStatusBadge status={invoice.status} overdue={overdue} />
          </div>
          <p className="mt-1 text-lg">{dealership.name}</p>
          <p className="text-sm text-muted-foreground">
            {formatDateOnly(invoice.period_start)} – {formatDateOnly(invoice.period_end)} · created {formatDate(invoice.created_at)}
            {invoice.ro_po_number ? ` · RO/PO ${invoice.ro_po_number}` : ""}
          </p>
          {invoice.status === "void" && (
            <p className="mt-1 text-sm text-destructive">
              Voided {formatDateTime(invoice.voided_at)}
              {invoice.void_reason ? ` · ${invoice.void_reason}` : ""}
            </p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-3 lg:text-right">
          <Stat label="Total" value={formatMoney(invoice.total)} />
          <Stat label="Paid" value={formatMoney(invoice.amount_paid)} />
          <Stat label="Balance" value={formatMoney(balance)} highlight={balance > 0 && invoice.status !== "void"} />
        </div>
      </div>

      <div className="mt-5">
        <InvoiceActions
          invoice={{ id: invoice.id, status: invoice.status, display_number: invoice.display_number, amount_paid: Number(invoice.amount_paid), total: Number(invoice.total), notes: invoice.notes }}
          dealership={{ name: dealership.name, ap_emails: dealership.ap_emails, submission_method: dealership.submission_method }}
          companyEmail={company.email}
        />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="min-w-0 overflow-hidden">
            <CardHeader>
              <CardTitle>
                Line items <Badge variant="muted">{items.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Tag</TableHead>
                    <TableHead>Vehicle</TableHead>
                    <TableHead className="hidden xl:table-cell">VIN</TableHead>
                    <TableHead>Service</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => (
                    <TableRow key={it.id}>
                      <TableCell className="text-muted-foreground">{formatDate(it.performed_at, "MM/dd/yy")}</TableCell>
                      <TableCell>
                        {it.job_id ? (
                          <Link href={`/jobs/${it.job_id}`} className="font-semibold hover:text-primary">
                            {it.tag_number}
                          </Link>
                        ) : (
                          <span className="font-semibold">{it.tag_number}</span>
                        )}
                      </TableCell>
                      <TableCell>{[it.year, it.make, it.model].filter(Boolean).join(" ")}</TableCell>
                      <TableCell className="hidden font-mono text-xs text-muted-foreground xl:table-cell">{it.vin ?? "—"}</TableCell>
                      <TableCell>{it.service_name}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(it.price)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="ml-auto mt-4 grid w-full max-w-xs gap-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{formatMoney(invoice.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax ({formatTaxRate(Number(invoice.tax_rate))})</span>
                  <span className="tabular-nums">{formatMoney(invoice.tax)}</span>
                </div>
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                  <span>Total</span>
                  <span className="tabular-nums">{formatMoney(invoice.total)}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <PaymentsCard invoiceId={invoice.id} payments={payments} balance={balance} status={invoice.status} />
          <SubmissionsCard submissions={submissionsWithUrls} submittedAt={invoice.submitted_at} />
          <Card>
            <CardHeader>
              <CardTitle>Terms</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Payment terms</span>
                <span>{invoice.payment_terms}</span>
              </div>
              {invoice.notes && <p className="mt-3 whitespace-pre-wrap text-muted-foreground">{invoice.notes}</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </Page>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${highlight ? "text-warning" : ""}`}>{value}</div>
    </div>
  );
}
