import type { Database } from "@/lib/db/types";
import type { QboHistoryInvoice } from "./client";

/**
 * Reading the dealerships' past QuickBooks invoices (0072). The stock number and the VIN are
 * pulled out of each line's free-text description so a car is not billed twice. Pure functions:
 * no server or database here, so they are unit tested.
 */

export interface ParsedBilledLine {
  stock: string | null;
  vin: string | null;
  /** yyyy-mm-dd the work was done (the line's service date, else the invoice date). */
  servedOn: string | null;
  /** A stock number or a VIN was found; a line with neither cannot protect anything. */
  ok: boolean;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const VIN = /\b[A-HJ-NPR-Z0-9]{17}\b/i;
const STOCK_WORD = /\b(?:stock|stk)\b\s*(?:#|no\.?|number)?\s*[:#-]?\s*([A-Za-z0-9][A-Za-z0-9-]{1,31})/i;
const HASH = /(?:^|[\s(,;])#\s?([A-Za-z0-9][A-Za-z0-9-]{2,31})\b/;

/** A VIN has digits and letters; an all-letters or all-digits run of 17 is not one. */
function looksLikeVin(s: string): boolean {
  return /[A-Za-z]/.test(s) && /\d/.test(s);
}

export function parseBilledLine(description: string | null | undefined, serviceDate?: string | null, txnDate?: string | null): ParsedBilledLine {
  const text = (description ?? "").replace(/\s+/g, " ").trim();
  let vin: string | null = null;
  const vinMatch = text.match(VIN);
  if (vinMatch && looksLikeVin(vinMatch[0])) vin = vinMatch[0].toUpperCase();
  const stockMatch = text.match(STOCK_WORD) ?? text.match(HASH);
  let stock = stockMatch ? stockMatch[1].replace(/[-.]+$/, "").toUpperCase() : null;
  // "Stock 4821" must not capture the VIN or a year that follows a missing number.
  if (stock && vin && stock === vin) stock = null;
  const servedOn = serviceDate && ISO.test(serviceDate) ? serviceDate : txnDate && ISO.test(txnDate) ? txnDate : null;
  return { stock, vin, servedOn, ok: !!(stock || vin) };
}

/**
 * Windows of at most six months, oldest first, covering the last `monthsBack` months up to `today`
 * (yyyy-mm-dd): each window is one QuickBooks query so a call stays short.
 */
export function historyWindows(today: string, monthsBack: number): { from: string; to: string }[] {
  const end = new Date(`${today}T00:00:00Z`);
  const start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() - monthsBack, end.getUTCDate()));
  const out: { from: string; to: string }[] = [];
  let from = start;
  while (from <= end) {
    const next = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 6, from.getUTCDate()));
    const to = new Date(Math.min(next.getTime() - 86400000, end.getTime()));
    out.push({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
    from = next;
  }
  return out;
}

/** Turn QuickBooks invoices into "already billed" rows: one per described line (subtotal and discount rows are skipped). */
export const toBilledRows = (
  invoices: QboHistoryInvoice[],
  ctx: { companyId: string; dealershipId: string; appInvoiceIds: Set<string> },
) => {
  const rows: Database["public"]["Tables"]["quickbooks_billed_lines"]["Insert"][] = [];
  for (const inv of invoices) {
    (inv.Line ?? []).forEach((line, i) => {
      // Subtotal and discount rows carry no description; only a described line can name a car.
      if (line.DetailType === "SubTotalLineDetail" || line.DetailType === "DiscountLineDetail") return;
      if (!line.Description && !(line.Amount ?? 0)) return;
      const p = parseBilledLine(line.Description, line.SalesItemLineDetail?.ServiceDate, inv.TxnDate);
      rows.push({
        company_id: ctx.companyId,
        dealership_id: ctx.dealershipId,
        qbo_invoice_id: inv.Id,
        doc_number: inv.DocNumber ?? null,
        line_key: String(line.Id ?? line.LineNum ?? i + 1),
        txn_date: inv.TxnDate ?? null,
        service_date: p.servedOn,
        stock_number: p.stock,
        vin: p.vin,
        description: (line.Description ?? "").slice(0, 500) || null,
        amount: line.Amount ?? null,
        parsed_ok: p.ok,
        source: ctx.appInvoiceIds.has(inv.Id) ? "app" : "history",
      });
    });
  }
  return rows;
};

