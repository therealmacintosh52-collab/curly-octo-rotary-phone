import { CheckCircle2Icon, FileDownIcon } from "lucide-react";
import type { ReceiptView as Receipt } from "@/lib/db/types";
import { formatDateTime } from "@/lib/dates";
import { formatMoney, formatTaxRate } from "@/lib/money";
import { formatAddress } from "@/lib/address";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { PublicFindings } from "./public-findings";
import { PAYMENT_METHOD } from "@/lib/retail/payment-labels";
import { InvoiceDocument } from "./invoice-document";

const METHOD = PAYMENT_METHOD;

/** The customer's receipt page: what was done, what was paid and how, the signature at pickup, a PDF. */
export function ReceiptView({ r, token }: { r: Receipt; token: string }) {
  // Work in progress: the repair order is approved but not invoiced yet (0052). Older invoices always carry invoiced_at.
  const wip = !r.paid_at && r.invoiced_at === null;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col gap-5 px-4 py-6 sm:px-6" data-testid="receipt-page">
      <header className="flex items-center gap-3">
        <Logo size={44} />
        <div>
          <div className="font-semibold">{r.company.name}</div>
          <div className="text-caption text-subtle">{formatAddress(r.company).join(", ")}</div>
        </div>
      </header>
      {r.jobs && r.jobs.length > 0 ? (
        <>
          <h1 className="text-heading" data-testid="receipt-greeting">{r.paid_at ? `Thanks${r.customer?.first_name ? `, ${r.customer.first_name}` : ""}!` : wip ? `Hi${r.customer?.first_name ? ` ${r.customer.first_name}` : ""}, here is where your car stands` : `Hi${r.customer?.first_name ? ` ${r.customer.first_name}` : ""}, here is your invoice`}</h1>
          <InvoiceDocument r={r}>
            {r.signed_name && <p className="mt-3 border-t border-border pt-3 text-caption text-subtle" data-testid="receipt-signed">Received by {r.signed_name}{r.signed_at ? ` · ${formatDateTime(r.signed_at)}` : ""}{r.has_signature ? " · signed" : ""}</p>}
          </InvoiceDocument>
          <span className="sr-only" data-testid="receipt-kind">{r.paid_at ? "Receipt" : wip ? "Repair order" : "Invoice"} · {wip ? (r.ro_number ?? r.tag) : (r.invoice_number ?? r.tag)}</span>
        </>
      ) : (
      <section className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-caption text-subtle" data-testid="receipt-kind">{r.paid_at ? "Receipt" : wip ? "Repair order" : "Invoice"} · {wip ? (r.ro_number ?? r.tag) : (r.invoice_number ?? r.tag)}</div>
              <h1 className="text-heading">{r.paid_at ? `Thanks${r.customer?.first_name ? `, ${r.customer.first_name}` : ""}!` : wip ? `Hi${r.customer?.first_name ? ` ${r.customer.first_name}` : ""}, here is where your car stands` : `Hi${r.customer?.first_name ? ` ${r.customer.first_name}` : ""}, here is your invoice`}</h1>
              <div className="text-sm text-muted-foreground">{[r.vehicle, r.color, r.odometer ? `${r.odometer.toLocaleString()} mi` : null].filter(Boolean).join(" · ")}{r.paid_at ? ` · paid ${formatDateTime(r.paid_at)}` : ""}</div>
            </div>
            {r.paid_at && <CheckCircle2Icon className="size-6 shrink-0 text-success" />}
          </div>
          {wip && r.concern && <p className="mt-3 whitespace-pre-wrap rounded-lg border border-border px-3 py-2 text-sm" data-testid="receipt-concern"><span className="block text-label text-subtle">What you told us</span>{r.concern}</p>}
          {wip && <div className="mt-3 text-label text-subtle">Approved work so far</div>}
          <ul className="mt-3 divide-y divide-border text-sm" data-testid="receipt-lines">
            {r.lines.map((l, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2"><span>{l.name}</span><span className="tabular-nums">{formatMoney(l.price)}</span></li>
            ))}
          </ul>
          <div className="mt-2 grid gap-1 border-t border-border pt-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="tabular-nums">{formatMoney(r.subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Tax ({formatTaxRate(Number(r.tax_rate ?? 0))})</span><span className="tabular-nums">{formatMoney(r.tax)}</span></div>
            <div className="flex justify-between text-base font-semibold"><span>Total</span><span className="tabular-nums" data-testid="receipt-total">{formatMoney(r.total)}</span></div>
            {r.payments.map((p, i) => (
              <div key={i} className="flex justify-between text-muted-foreground"><span>{p.kind === "refund" ? "Refund" : p.kind === "deposit" ? "Deposit" : "Paid"} · {METHOD[p.method] ?? p.method}{p.paid_at ? ` · ${formatDateTime(p.paid_at)}` : ""}</span><span className="tabular-nums">{p.kind === "refund" ? "+" : "−"}{formatMoney(p.amount)}</span></div>
            ))}
            {!wip && <div className="flex justify-between font-semibold"><span>{r.paid_at ? "Balance" : "Amount due"}</span><span className="tabular-nums">{formatMoney(r.balance)}</span></div>}
          </div>
          {r.signed_name && <p className="mt-3 text-caption text-subtle" data-testid="receipt-signed">Received by {r.signed_name}{r.signed_at ? ` · ${formatDateTime(r.signed_at)}` : ""}{r.has_signature ? " · signed" : ""}</p>}
        </section>
      )}
      {wip && <p className="text-sm text-muted-foreground" data-testid="receipt-wip">We are working on it. Your invoice comes from this same repair order when the work is done, and it will match what you approved.</p>}
      {!r.paid_at && !wip && <p className="text-sm text-muted-foreground" data-testid="receipt-unpaid">Nothing to pay online: you pay at the shop when you pick up the car{r.company.phone ? `, or call us at ${r.company.phone}` : ""}.</p>}
      <PublicFindings findings={r.findings ?? []} />
      <Button asChild variant="outline">
        <a href={`/api/r/${token}/pdf`} data-testid="receipt-pdf"><FileDownIcon /> Download the PDF</a>
      </Button>
      <footer className="mt-auto pt-4 text-center text-caption text-subtle">{r.company.name}{r.company.phone ? ` · ${r.company.phone}` : ""}</footer>
    </main>
  );
}
