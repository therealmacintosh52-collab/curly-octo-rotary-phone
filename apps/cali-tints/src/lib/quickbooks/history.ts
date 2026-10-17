import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import type { QuickBooksClient } from "./client";
import { toBilledRows } from "./history-parse";

type Db = SupabaseClient<Database>;

/** What one call read: the caller keeps going while `next` is set. */
export interface HistoryChunk {
  invoices: number;
  lines: number;
  unread: number;
  /** Set when there are more invoices in this window: pass it back as `start`. */
  next: number | null;
  /** Why this dealership was skipped (no QuickBooks customer with its name). */
  skipped?: string;
}

const PAGE = 1000;
const PAGES_PER_CALL = 2;

/**
 * Read a dealership's invoices from QuickBooks for one date window and keep each line as an
 * "already billed" row (never a job). Re-running is safe: rows are unique per invoice line.
 */
export async function importHistoryChunk(
  db: Db,
  client: QuickBooksClient,
  companyId: string,
  input: { dealershipId: string; from: string; to: string; start: number },
): Promise<HistoryChunk> {
  const { data: dealership } = await db.from("dealerships").select("id, name, retail, quickbooks_customer_id").eq("id", input.dealershipId).eq("company_id", companyId).maybeSingle();
  if (!dealership || dealership.retail) return { invoices: 0, lines: 0, unread: 0, next: null, skipped: "Not a dealership" };

  let customerId = dealership.quickbooks_customer_id;
  if (!customerId) {
    const found = await client.findCustomerByName(dealership.name);
    if (!found) return { invoices: 0, lines: 0, unread: 0, next: null, skipped: `No QuickBooks customer named "${dealership.name}"` };
    customerId = found.Id;
    await db.from("dealerships").update({ quickbooks_customer_id: customerId }).eq("id", dealership.id);
  }

  // Invoices this app built itself are tagged so a job never matches its own line.
  const [{ data: tracked }, { data: mirrored }] = await Promise.all([
    db.from("quickbooks_month_invoices").select("qbo_invoice_id").eq("company_id", companyId),
    db.from("invoices").select("quickbooks_invoice_id").eq("company_id", companyId).not("quickbooks_invoice_id", "is", null),
  ]);
  const appInvoiceIds = new Set<string>([...(tracked ?? []).map((r) => r.qbo_invoice_id), ...(mirrored ?? []).map((r) => r.quickbooks_invoice_id)].filter((x): x is string => !!x));

  let start = input.start;
  let invoices = 0;
  let lines = 0;
  let unread = 0;
  let next: number | null = null;
  for (let page = 0; page < PAGES_PER_CALL; page++) {
    const batch = await client.listInvoices({ customerId, from: input.from, to: input.to, start, max: PAGE });
    invoices += batch.length;
    const rows = toBilledRows(batch, { companyId, dealershipId: dealership.id, appInvoiceIds });
    for (let i = 0; i < rows.length; i += 500) {
      const part = rows.slice(i, i + 500);
      const { error } = await db.from("quickbooks_billed_lines").upsert(part, { onConflict: "company_id,qbo_invoice_id,line_key" });
      if (error) throw new Error(error.message);
    }
    lines += rows.length;
    unread += rows.filter((r) => !r.parsed_ok).length;
    if (batch.length < PAGE) {
      next = null;
      break;
    }
    start += PAGE;
    next = start;
  }
  return { invoices, lines, unread, next };
}
