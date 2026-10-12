import type { InvoiceBundle } from "@/lib/invoices/load";
import { formatDate, formatDateOnly } from "@/lib/dates";
import type { QboInvoice, QboInvoiceLine } from "./client";

/*
  How an invoice here becomes a QuickBooks Invoice (pure functions, unit-tested):
  - DocNumber = our number (INV-000012). QuickBooks keeps it only when
    "Custom transaction numbers" is on (Settings → Sales → Sales form content).
  - TxnDate = the last day of the period (the month); DueDate = + payment terms days when the company has them.
  - One line per invoice line (car × service): Qty 1, UnitPrice = the price,
    Description = "Sep 12 · Stock 4821 · 2024 Mercedes-Benz GLE 450 · Used".
  - No tax line: the detailing is labor and the tax rate is expected to be 0.
    A non-zero tax rate is flagged in the PrivateNote so the owner sees it.
*/

export const vehicleOf = (it: { year: number | null; make: string | null; model: string | null }) => [it.year, it.make, it.model].filter(Boolean).join(" ");

export function describeLine(it: InvoiceBundle["items"][number]): string {
  return [formatDate(it.performed_at, "MMM d"), `Stock ${it.tag_number}`, vehicleOf(it) || null, it.service_name, it.ro_po_number ? `RO/PO ${it.ro_po_number}` : null].filter(Boolean).join(" · ");
}

export function invoiceLines(bundle: InvoiceBundle, itemId: string): QboInvoiceLine[] {
  return bundle.items.map((it, i) => ({
    LineNum: i + 1,
    Description: describeLine(it),
    Amount: round2(Number(it.price)),
    DetailType: "SalesItemLineDetail",
    SalesItemLineDetail: { ItemRef: { value: itemId }, Qty: 1, UnitPrice: round2(Number(it.price)), ServiceDate: it.performed_at.slice(0, 10) },
  }));
}

export function invoicePayload(bundle: InvoiceBundle, customerId: string, itemId: string): QboInvoice {
  const { invoice, dealership, company, items } = bundle;
  const email = dealership.ap_emails[0];
  const terms = parseTermsDays(dealership.payment_terms ?? company.payment_terms);
  const notes = [
    `Cali Tints ${invoice.display_number} · ${items.length} ${items.length === 1 ? "line" : "lines"} · ${formatDateOnly(invoice.period_start, "MMM d")} – ${formatDateOnly(invoice.period_end, "MMM d, yyyy")}`,
    Number(invoice.tax) > 0 ? `Tax of ${Number(invoice.tax).toFixed(2)} on the Cali Tints invoice is not carried to QuickBooks; add it here if it applies.` : null,
  ].filter(Boolean);
  return {
    DocNumber: invoice.display_number.slice(0, 21), // QuickBooks limit
    TxnDate: invoice.period_end,
    ...(terms ? { DueDate: addDays(invoice.period_end, terms) } : {}),
    CustomerRef: { value: customerId },
    ...(email ? { BillEmail: { Address: email } } : {}),
    CustomerMemo: { value: `Detailing ${formatDateOnly(invoice.period_start, "MMMM yyyy")}${invoice.ro_po_number ? ` · RO/PO ${invoice.ro_po_number}` : ""}` },
    PrivateNote: notes.join(" "),
    Line: invoiceLines(bundle, itemId),
  };
}

/** "Net 30" / "30" → 30; anything else → null. */
export function parseTermsDays(terms: string | null | undefined): number | null {
  const m = (terms ?? "").match(/(\d{1,3})/);
  return m ? Number(m[1]) : null;
}

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

const round2 = (n: number) => Math.round(n * 100) / 100;
