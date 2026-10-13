import Link from "next/link";
import { ArrowLeftIcon, CarFrontIcon, FileDownIcon, WrenchIcon } from "lucide-react";
import type { RetailInvoiceDetail as Invoice } from "@/lib/db/types";
import { formatDate, formatDateTime } from "@/lib/dates";
import { formatMoney, formatTaxRate } from "@/lib/money";
import { formatAddress } from "@/lib/address";
import { Page } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { RetailInvoiceStatusBadge } from "./retail-invoice-status-badge";

const METHOD: Record<string, string> = { clover_online: "Card online", clover_flex: "Card at the counter", cash: "Cash", check: "Check", other: "Other" };

/**
 * One retail invoice: the repair order's lines, tax, deposit, what was paid
 * and how, the signature at pickup. Taking the payment stays on the repair
 * order (the counter card on the Clover); this page is the document.
 */
export function RetailInvoiceDetail({ inv }: { inv: Invoice }) {
  const due = inv.status === "unpaid" || inv.status === "partial";
  return (
    <Page>
      <Link href="/retail/invoices" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Invoices
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-title" data-testid="retail-invoice-number">{inv.invoice_number}</h1>
            <RetailInvoiceStatusBadge status={inv.status} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {[inv.customer?.display_name ?? "Walk-in", inv.vehicle, inv.color].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-0.5 text-caption text-subtle">
            {[inv.ro_number, `Tag ${inv.tag}`, formatDate(inv.performed_at)].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-2 text-caption text-subtle">Retail invoice · kept apart from the dealerships&apos; monthly invoices, never sent to QuickBooks.</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button asChild>
            <Link href={`/jobs/${inv.job_id}`} data-testid="retail-invoice-open-ro">
              <WrenchIcon /> {due ? "Open the repair order to collect" : "Open the repair order"}
            </Link>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/receipts/${inv.job_id}/pdf`} data-testid="retail-invoice-pdf">
              <FileDownIcon /> PDF
            </a>
          </Button>
          {inv.customer && (
            <Button asChild variant="outline">
              <Link href={`/retail/customers/${inv.customer.id}`}>
                <CarFrontIcon /> Customer
              </Link>
            </Button>
          )}
        </div>
      </div>

      <section className="mt-6 max-w-2xl rounded-2xl border border-border bg-card p-4">
        <ul className="divide-y divide-border text-sm" data-testid="retail-invoice-lines">
          {inv.lines.map((l, i) => (
            <li key={i} className="flex items-center justify-between gap-3 py-2">
              <span>{l.name}</span>
              <span className="tabular-nums">{formatMoney(l.price)}</span>
            </li>
          ))}
          {inv.lines.length === 0 && <li className="py-2 text-muted-foreground">No services on the repair order yet.</li>}
        </ul>
        <div className="mt-2 grid gap-1 border-t border-border pt-2 text-sm">
          <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{formatMoney(inv.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Tax ({formatTaxRate(Number(inv.tax_rate ?? 0))})</span><span className="tabular-nums">{formatMoney(inv.tax)}</span></div>
          <div className="flex justify-between text-base font-semibold"><span>Total</span><span className="tabular-nums" data-testid="retail-invoice-total">{formatMoney(inv.total)}</span></div>
          {inv.payments.map((p, i) => (
            <div key={i} className="flex justify-between text-muted-foreground">
              <span>{p.kind === "refund" ? "Refund" : p.kind === "deposit" ? "Deposit" : "Paid"} · {METHOD[p.method] ?? p.method}{p.paid_at ? ` · ${formatDateTime(p.paid_at)}` : ""}</span>
              <span className="tabular-nums">{p.kind === "refund" ? "+" : "−"}{formatMoney(p.amount)}</span>
            </div>
          ))}
          <div className="flex justify-between font-semibold"><span>Balance due</span><span className="tabular-nums" data-testid="retail-invoice-balance">{formatMoney(inv.balance)}</span></div>
        </div>
        {inv.signed_name && (
          <p className="mt-3 text-caption text-subtle" data-testid="retail-invoice-signed">
            Received by {inv.signed_name}{inv.signed_at ? ` · ${formatDateTime(inv.signed_at)}` : ""}{inv.has_signature ? " · signed" : ""}
          </p>
        )}
      </section>
      <p className="mt-4 text-caption text-subtle">{inv.company.name} · {formatAddress(inv.company).join(", ")}</p>
    </Page>
  );
}
