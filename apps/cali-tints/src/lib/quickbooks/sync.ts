import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { loadInvoiceBundle } from "@/lib/invoices/load";
import { errorMessage } from "@/lib/utils";
import { QuickBooksApiError, QuickBooksClient } from "./client";
import { getCredentials, markConnection } from "./connection";
import { invoicePayload } from "./payload";
import { linkClosedMonths, pullOpenMonths, syncOpenMonths } from "./live";

type Db = SupabaseClient<Database>;

export interface SyncReport {
  pushed: { id: string; display_number: string; quickbooks_id: string }[];
  pushErrors: { id: string; display_number: string; error: string }[];
  paymentsRecorded: number;
  pullErrors: string[];
  /** Open months kept live in QuickBooks this run. */
  live: { dealershipId: string; monthStart: string; docNumber: string | null; jobs: number }[];
  /** Closed months whose mirror invoice took over an existing QuickBooks invoice. */
  linked: number;
  /** The company has no QuickBooks sign-in (nothing ran). */
  notConnected?: boolean;
}

async function clientFor(db: Db, companyId: string): Promise<{ client: QuickBooksClient; realmId: string } | { error: string } | null> {
  const creds = await getCredentials(db, companyId);
  if (!creds) return null;
  if (creds.status !== "ok" || !creds.accessToken) return { error: creds.lastError ? `Reconnect QuickBooks: ${creds.lastError}` : "Reconnect QuickBooks" };
  return { client: new QuickBooksClient(creds.env, creds.realmId, creds.accessToken), realmId: creds.realmId };
}

async function noteFailure(db: Db, companyId: string, err: unknown) {
  if (err instanceof QuickBooksApiError && err.needsReconnect) await markConnection(db, companyId, false, err.message);
  await db.from("companies").update({ quickbooks_last_error: errorMessage(err) }).eq("id", companyId);
}

/** The QuickBooks customer for a dealership (found by name or created), remembered on the dealership. */
async function ensureCustomer(db: Db, client: QuickBooksClient, dealership: { id: string; name: string; quickbooks_customer_id: string | null; ap_emails: string[]; address_line1: string | null; address_line2: string | null; city: string | null; state: string | null; postal_code: string | null }): Promise<string> {
  if (dealership.quickbooks_customer_id) return dealership.quickbooks_customer_id;
  let customer = await client.findCustomerByName(dealership.name);
  if (!customer) {
    customer = await client.createCustomer({
      DisplayName: dealership.name,
      CompanyName: dealership.name,
      ...(dealership.ap_emails[0] ? { PrimaryEmailAddr: { Address: dealership.ap_emails[0] } } : {}),
      BillAddr: { Line1: dealership.address_line1 ?? undefined, Line2: dealership.address_line2 ?? undefined, City: dealership.city ?? undefined, CountrySubDivisionCode: dealership.state ?? undefined, PostalCode: dealership.postal_code ?? undefined },
    });
  }
  await db.from("dealerships").update({ quickbooks_customer_id: customer.Id }).eq("id", dealership.id);
  return customer.Id;
}

/** The service item every line posts to (found by name or created on the first Income account), remembered on the company. */
async function ensureItem(db: Db, client: QuickBooksClient, company: { id: string; quickbooks_item_id: string | null; quickbooks_item_name: string }): Promise<string> {
  if (company.quickbooks_item_id) return company.quickbooks_item_id;
  const name = company.quickbooks_item_name.trim() || "Auto detailing";
  let item = await client.findItemByName(name);
  if (!item) {
    const account = await client.firstIncomeAccount();
    if (!account) throw new Error("QuickBooks has no Income account to post the detailing item to. Add one in QuickBooks (Chart of accounts) and try again.");
    item = await client.createServiceItem(name, account.Id);
  }
  await db.from("companies").update({ quickbooks_item_id: item.Id }).eq("id", company.id);
  return item.Id;
}

/** Create or update one invoice in QuickBooks and remember its id, number and balance. */
export async function pushInvoice(db: Db, companyId: string, invoiceId: string): Promise<{ ok: true; quickbooksId: string; docNumber: string | null } | { ok: false; error: string }> {
  const c = await clientFor(db, companyId);
  if (!c) return { ok: false, error: "QuickBooks is not connected. Connect it under Settings." };
  if ("error" in c) return { ok: false, error: c.error };
  const bundle = await loadInvoiceBundle(invoiceId, db);
  if (!bundle || bundle.invoice.company_id !== companyId) return { ok: false, error: "Invoice not found" };
  if (bundle.invoice.status === "void") return { ok: false, error: "A void invoice is not sent to QuickBooks" };
  if (bundle.items.length === 0) return { ok: false, error: "The invoice has no lines" };
  try {
    const customerId = await ensureCustomer(db, c.client, bundle.dealership);
    const itemId = await ensureItem(db, c.client, bundle.company);
    const payload = invoicePayload(bundle, customerId, itemId);
    if (bundle.invoice.quickbooks_invoice_id) {
      const current = await c.client.getInvoice(bundle.invoice.quickbooks_invoice_id);
      payload.Id = current.Id;
      payload.SyncToken = current.SyncToken;
      payload.DocNumber = current.DocNumber; // keep the number QuickBooks gave it
    }
    const saved = await c.client.saveInvoice(payload);
    const now = new Date().toISOString();
    await db
      .from("invoices")
      .update({ quickbooks_invoice_id: saved.Id ?? null, quickbooks_doc_number: saved.DocNumber ?? null, quickbooks_sync_token: saved.SyncToken ?? null, quickbooks_synced_at: now, quickbooks_error: null, quickbooks_balance: saved.Balance ?? null, quickbooks_balance_at: now })
      .eq("id", invoiceId);
    await db.from("companies").update({ quickbooks_last_sync_at: now, quickbooks_last_error: null }).eq("id", companyId);
    await markConnection(db, companyId, true);
    return { ok: true, quickbooksId: saved.Id ?? "", docNumber: saved.DocNumber ?? null };
  } catch (err) {
    await db.from("invoices").update({ quickbooks_error: errorMessage(err) }).eq("id", invoiceId);
    await noteFailure(db, companyId, err);
    return { ok: false, error: errorMessage(err) };
  }
}

/** Every live invoice not yet in QuickBooks (new ones from the month close included), oldest first. */
export async function pushUnsynced(db: Db, companyId: string, report: SyncReport, limit = 50): Promise<void> {
  const { data: rows } = await db
    .from("invoices")
    .select("id, display_number")
    .eq("company_id", companyId)
    .is("quickbooks_invoice_id", null)
    .in("status", ["draft", "submitted", "partial", "paid"])
    .order("number")
    .limit(limit);
  for (const r of rows ?? []) {
    const res = await pushInvoice(db, companyId, r.id);
    if (res.ok) report.pushed.push({ id: r.id, display_number: r.display_number, quickbooks_id: res.quickbooksId });
    else {
      report.pushErrors.push({ id: r.id, display_number: r.display_number, error: res.error });
      if (/not connected|Reconnect QuickBooks/i.test(res.error)) break;
    }
  }
}

/** Open synced invoices: when QuickBooks shows a lower balance than we do, a payment was recorded there; mirror it here. */
export async function pullBalances(db: Db, companyId: string, report: SyncReport, limit = 100): Promise<void> {
  const c = await clientFor(db, companyId);
  if (!c || "error" in c) return;
  const { data: rows } = await db
    .from("invoices")
    .select("id, display_number, total, amount_paid, status, quickbooks_invoice_id")
    .eq("company_id", companyId)
    .not("quickbooks_invoice_id", "is", null)
    .in("status", ["draft", "submitted", "partial"])
    .order("number")
    .limit(limit);
  for (const r of rows ?? []) {
    try {
      const q = await c.client.getInvoice(r.quickbooks_invoice_id!);
      const now = new Date().toISOString();
      const ourBalance = Math.round((Number(r.total) - Number(r.amount_paid)) * 100) / 100;
      const theirBalance = q.Balance === undefined ? null : Math.round(Number(q.Balance) * 100) / 100;
      if (theirBalance !== null && theirBalance < ourBalance) {
        const paid = Math.round((ourBalance - theirBalance) * 100) / 100;
        const { error } = await db.rpc("record_payment_system", { p_company_id: companyId, p_invoice_id: r.id, p_amount: paid, p_paid_at: now.slice(0, 10), p_method: "other", p_reference: "QuickBooks", p_note: "Recorded in QuickBooks" });
        if (error) throw new Error(error.message);
        report.paymentsRecorded += 1;
      }
      // Sent from QuickBooks: the app shows it as sent too (nothing to email from here).
      const sent = q.EmailStatus === "EmailSent" && r.status === "draft";
      await db
        .from("invoices")
        .update({ quickbooks_balance: theirBalance, quickbooks_balance_at: now, quickbooks_sync_token: q.SyncToken ?? null, quickbooks_doc_number: q.DocNumber ?? null, quickbooks_error: null, ...(sent ? { status: "submitted" as const, submitted_at: now } : {}) })
        .eq("id", r.id);
    } catch (err) {
      report.pullErrors.push(`${r.display_number}: ${errorMessage(err)}`);
      await noteFailure(db, companyId, err);
      if (err instanceof QuickBooksApiError && err.needsReconnect) break;
    }
  }
  if (report.pullErrors.length === 0) await db.from("companies").update({ quickbooks_last_sync_at: new Date().toISOString() }).eq("id", companyId);
}

/**
 * The sync for one company: open months live in QuickBooks, closed months
 * handed to their mirror invoice, anything still missing pushed, payments
 * and sent-state pulled. Nothing runs for a company without a sign-in.
 */
export async function syncQuickBooks(db: Db, companyId: string): Promise<SyncReport> {
  const report: SyncReport = { pushed: [], pushErrors: [], paymentsRecorded: 0, pullErrors: [], live: [], linked: 0 };
  const { data: company } = await db.from("companies").select("quickbooks_realm_id, quickbooks_auto_push").eq("id", companyId).maybeSingle();
  if (!company?.quickbooks_realm_id) return { ...report, notConnected: true };
  report.linked = await linkClosedMonths(db, companyId);
  if (company.quickbooks_auto_push) {
    await syncOpenMonths(db, companyId, report);
    await pushUnsynced(db, companyId, report);
  }
  await pullOpenMonths(db, companyId, report);
  await pullBalances(db, companyId, report);
  return report;
}
