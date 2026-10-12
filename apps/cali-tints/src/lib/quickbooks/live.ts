import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { formatDate, formatDateOnly } from "@/lib/dates";
import { errorMessage } from "@/lib/utils";
import { QuickBooksApiError, QuickBooksClient, type QboInvoice, type QboInvoiceLine } from "./client";
import { getCredentials, markConnection } from "./connection";
import { vehicleOf } from "./payload";
import type { SyncReport } from "./sync";

/*
  Live QuickBooks: the moment a job is saved it becomes a line on the
  dealership's open QuickBooks invoice for that month. QuickBooks numbers the
  invoice, Mike sends it from QuickBooks, payments are recorded there. The
  app only tracks it (quickbooks_month_invoices + the number on each job).
  Every push rebuilds the invoice's lines from the month's open jobs, so
  edits and deletes are reflected and a retry can never double a line.
*/

type Db = SupabaseClient<Database>;

interface MonthJob {
  id: string;
  tag_number: string;
  year: number | null;
  make: string | null;
  model: string | null;
  performed_at: string;
  ro_po_number: string | null;
  job_services: { id: string; label: string | null; price: number; service: { name: string } | null }[];
}

export interface LiveSyncResult {
  dealershipId: string;
  monthStart: string;
  jobs: number;
  qboInvoiceId: string | null;
  docNumber: string | null;
  error?: string;
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The company-timezone calendar month a timestamp falls in: [start, end] as yyyy-mm-dd. */
export function monthOf(iso: string, tz: string): { start: string; end: string } {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(new Date(iso));
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  return { start: ymd(new Date(y, m - 1, 1)), end: ymd(new Date(y, m, 0)) };
}

async function clientFor(db: Db, companyId: string) {
  const creds = await getCredentials(db, companyId);
  if (!creds) return null;
  if (creds.status !== "ok" || !creds.accessToken) throw new Error(creds.lastError ? `Reconnect QuickBooks: ${creds.lastError}` : "Reconnect QuickBooks");
  return new QuickBooksClient(creds.env, creds.realmId, creds.accessToken);
}

/** The QuickBooks customer for the dealership, found by name or created; remembered on the dealership. */
async function ensureCustomer(db: Db, client: QuickBooksClient, dealership: { id: string; name: string; quickbooks_customer_id: string | null; ap_emails: string[]; address_line1: string | null; address_line2: string | null; city: string | null; state: string | null; postal_code: string | null }) {
  if (dealership.quickbooks_customer_id) return dealership.quickbooks_customer_id;
  let c = await client.findCustomerByName(dealership.name);
  if (!c) {
    c = await client.createCustomer({
      DisplayName: dealership.name,
      CompanyName: dealership.name,
      ...(dealership.ap_emails[0] ? { PrimaryEmailAddr: { Address: dealership.ap_emails[0] } } : {}),
      BillAddr: { Line1: dealership.address_line1 ?? undefined, Line2: dealership.address_line2 ?? undefined, City: dealership.city ?? undefined, CountrySubDivisionCode: dealership.state ?? undefined, PostalCode: dealership.postal_code ?? undefined },
    });
  }
  await db.from("dealerships").update({ quickbooks_customer_id: c.Id }).eq("id", dealership.id);
  return c.Id;
}

/** The one Service item every line posts to; remembered on the company. */
async function ensureItem(db: Db, client: QuickBooksClient, company: { id: string; quickbooks_item_id: string | null; quickbooks_item_name: string }) {
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

/** One line per car × service, newest car last, the way Mike reads it. */
export function monthLines(jobs: MonthJob[], itemId: string): QboInvoiceLine[] {
  const lines: QboInvoiceLine[] = [];
  const sorted = [...jobs].sort((a, b) => (a.performed_at < b.performed_at ? -1 : a.performed_at > b.performed_at ? 1 : a.tag_number.localeCompare(b.tag_number)));
  for (const j of sorted) {
    for (const s of j.job_services) {
      const price = Math.round(Number(s.price) * 100) / 100;
      lines.push({
        LineNum: lines.length + 1,
        Description: [formatDate(j.performed_at, "MMM d"), `Stock ${j.tag_number}`, vehicleOf(j) || null, s.label || s.service?.name || "Service", j.ro_po_number ? `RO/PO ${j.ro_po_number}` : null].filter(Boolean).join(" · "),
        Amount: price,
        DetailType: "SalesItemLineDetail",
        SalesItemLineDetail: { ItemRef: { value: itemId }, Qty: 1, UnitPrice: price, ServiceDate: j.performed_at.slice(0, 10) },
      });
    }
  }
  return lines;
}

/** The QuickBooks invoice for an open month (no DocNumber: QuickBooks numbers it). */
export function monthPayload(input: { customerId: string; itemId: string; jobs: MonthJob[]; monthStart: string; email: string | null; termsDays: number | null }): QboInvoice {
  const last = input.jobs.reduce<string>((m, j) => (j.performed_at > m ? j.performed_at : m), input.jobs[0]?.performed_at ?? `${input.monthStart}T12:00:00Z`);
  const txnDate = last.slice(0, 10);
  return {
    TxnDate: txnDate,
    ...(input.termsDays ? { DueDate: addDays(txnDate, input.termsDays) } : {}),
    CustomerRef: { value: input.customerId },
    ...(input.email ? { BillEmail: { Address: input.email } } : {}),
    CustomerMemo: { value: `Detailing ${formatDateOnly(input.monthStart, "MMMM yyyy")}` },
    PrivateNote: `Cali Tints · ${input.jobs.length} ${input.jobs.length === 1 ? "car" : "cars"} · updated live as jobs are logged`,
    Line: monthLines(input.jobs, input.itemId),
  };
}

function addDays(ymdStr: string, n: number) {
  const [y, m, d] = ymdStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/**
 * Push one dealership's open month to QuickBooks: create the invoice on the
 * first job, update its lines on every change, delete it when the last open
 * job is removed. Remembers the QuickBooks id and number on the tracker row
 * and on each job.
 */
export async function syncJobMonth(db: Db, companyId: string, dealershipId: string, monthStart: string): Promise<LiveSyncResult> {
  const result: LiveSyncResult = { dealershipId, monthStart, jobs: 0, qboInvoiceId: null, docNumber: null };
  const { data: company } = await db.from("companies").select("id, timezone, payment_terms, quickbooks_realm_id, quickbooks_item_id, quickbooks_item_name").eq("id", companyId).maybeSingle();
  if (!company?.quickbooks_realm_id) return { ...result, error: "QuickBooks is not connected" };
  const { data: dealership } = await db.from("dealerships").select("id, name, quickbooks_customer_id, ap_emails, address_line1, address_line2, city, state, postal_code, payment_terms").eq("id", dealershipId).maybeSingle();
  if (!dealership) return { ...result, error: "Dealership not found" };

  const monthEnd = monthOf(`${monthStart}T12:00:00Z`, "UTC").end;
  // Open jobs of the month in the company's timezone: a day-wide window, then filtered precisely.
  const { data: candidates } = await db
    .from("jobs")
    .select("id, tag_number, year, make, model, performed_at, ro_po_number, job_services(id, label, price, service:services(name))")
    .eq("company_id", companyId)
    .eq("dealership_id", dealershipId)
    .is("deleted_at", null)
    .is("invoice_id", null)
    .gte("performed_at", `${monthStart}T00:00:00Z`)
    .lt("performed_at", `${addDays(monthEnd, 2)}T00:00:00Z`)
    .order("performed_at");
  const jobs = ((candidates ?? []) as unknown as MonthJob[]).filter((j) => monthOf(j.performed_at, company.timezone).start === monthStart);
  result.jobs = jobs.length;

  const { data: tracker } = await db.from("quickbooks_month_invoices").select("*").eq("dealership_id", dealershipId).eq("month_start", monthStart).maybeSingle();
  if (tracker?.invoice_id) return { ...result, qboInvoiceId: tracker.qbo_invoice_id, docNumber: tracker.doc_number }; // the month closed: the mirror invoice tracks it now

  const now = new Date().toISOString();
  try {
    const client = await clientFor(db, companyId);
    if (!client) return { ...result, error: "QuickBooks is not connected" };

    if (jobs.length === 0) {
      // Nothing left in the month: take the invoice out of QuickBooks too.
      if (tracker?.qbo_invoice_id) {
        try {
          const current = await client.getInvoice(tracker.qbo_invoice_id);
          if (Number(current.Balance ?? current.TotalAmt ?? 0) === Number(current.TotalAmt ?? 0)) await client.deleteInvoice(tracker.qbo_invoice_id, current.SyncToken ?? "0");
        } catch (err) {
          if (!(err instanceof QuickBooksApiError && err.status === 400)) throw err;
        }
        await db.from("quickbooks_month_invoices").delete().eq("id", tracker.id);
      }
      return result;
    }

    const customerId = await ensureCustomer(db, client, dealership);
    const itemId = await ensureItem(db, client, company);
    const payload = monthPayload({ customerId, itemId, jobs, monthStart, email: dealership.ap_emails[0] ?? null, termsDays: parseTerms(dealership.payment_terms ?? company.payment_terms) });
    if (tracker?.qbo_invoice_id) {
      const current = await client.getInvoice(tracker.qbo_invoice_id);
      payload.Id = current.Id;
      payload.SyncToken = current.SyncToken;
      payload.DocNumber = current.DocNumber; // keep the number QuickBooks gave it
    }
    const saved = await client.saveInvoice(payload);
    const row = {
      company_id: companyId,
      dealership_id: dealershipId,
      month_start: monthStart,
      qbo_invoice_id: saved.Id ?? null,
      doc_number: saved.DocNumber ?? null,
      sync_token: saved.SyncToken ?? null,
      total: saved.TotalAmt ?? null,
      balance: saved.Balance ?? null,
      email_status: (saved as QboInvoice & { EmailStatus?: string }).EmailStatus ?? null,
      job_count: jobs.length,
      synced_at: now,
      error: null,
      updated_at: now,
    };
    await db.from("quickbooks_month_invoices").upsert(row, { onConflict: "dealership_id,month_start" });
    await db.from("jobs").update({ quickbooks_invoice_id: saved.Id ?? null, quickbooks_doc_number: saved.DocNumber ?? null, quickbooks_synced_at: now }).in("id", jobs.map((j) => j.id));
    await db.from("companies").update({ quickbooks_last_sync_at: now, quickbooks_last_error: null }).eq("id", companyId);
    await markConnection(db, companyId, true);
    return { ...result, qboInvoiceId: saved.Id ?? null, docNumber: saved.DocNumber ?? null };
  } catch (err) {
    const msg = errorMessage(err);
    await db.from("quickbooks_month_invoices").upsert({ company_id: companyId, dealership_id: dealershipId, month_start: monthStart, job_count: jobs.length, error: msg, updated_at: now }, { onConflict: "dealership_id,month_start" });
    if (err instanceof QuickBooksApiError && err.needsReconnect) await markConnection(db, companyId, false, err.message);
    await db.from("companies").update({ quickbooks_last_error: msg }).eq("id", companyId);
    return { ...result, qboInvoiceId: tracker?.qbo_invoice_id ?? null, docNumber: tracker?.doc_number ?? null, error: msg };
  }
}

function parseTerms(terms: string | null | undefined): number | null {
  const m = (terms ?? "").match(/(\d{1,3})/);
  return m ? Number(m[1]) : null;
}

/** After a job changed: push the month it belongs to (and, if it moved, the one it came from). Best effort; the daily sync catches the rest. */
export async function syncJobToQuickBooks(db: Db, jobId: string, previous?: { dealership_id: string; performed_at: string } | null): Promise<LiveSyncResult[]> {
  const { data: job } = await db.from("jobs").select("id, company_id, dealership_id, performed_at, company:companies(timezone, quickbooks_realm_id)").eq("id", jobId).maybeSingle();
  if (!job) return [];
  const company = job.company as unknown as { timezone: string; quickbooks_realm_id: string | null } | null;
  if (!company?.quickbooks_realm_id) return [];
  const targets = new Map<string, { dealershipId: string; monthStart: string }>();
  const add = (d: string, at: string) => {
    const m = monthOf(at, company.timezone).start;
    targets.set(`${d}:${m}`, { dealershipId: d, monthStart: m });
  };
  add(job.dealership_id, job.performed_at);
  if (previous) add(previous.dealership_id, previous.performed_at);
  const out: LiveSyncResult[] = [];
  for (const t of targets.values()) out.push(await syncJobMonth(db, job.company_id, t.dealershipId, t.monthStart));
  return out;
}

/** Every open (dealership, month) with jobs, plus trackers whose jobs are gone: the daily sweep. */
export async function syncOpenMonths(db: Db, companyId: string, report: SyncReport): Promise<void> {
  const { data: company } = await db.from("companies").select("timezone, quickbooks_realm_id").eq("id", companyId).maybeSingle();
  if (!company?.quickbooks_realm_id) return;
  const { data: open } = await db.from("jobs").select("dealership_id, performed_at").eq("company_id", companyId).is("deleted_at", null).is("invoice_id", null);
  const targets = new Map<string, { dealershipId: string; monthStart: string }>();
  for (const j of open ?? []) {
    const m = monthOf(j.performed_at, company.timezone).start;
    targets.set(`${j.dealership_id}:${m}`, { dealershipId: j.dealership_id, monthStart: m });
  }
  const { data: trackers } = await db.from("quickbooks_month_invoices").select("dealership_id, month_start").eq("company_id", companyId).is("invoice_id", null);
  for (const t of trackers ?? []) targets.set(`${t.dealership_id}:${t.month_start}`, { dealershipId: t.dealership_id, monthStart: t.month_start });
  for (const t of targets.values()) {
    const r = await syncJobMonth(db, companyId, t.dealershipId, t.monthStart);
    if (r.error) {
      report.pushErrors.push({ id: `${t.dealershipId}:${t.monthStart}`, display_number: `${formatDateOnly(t.monthStart, "MMMM yyyy")} (live)`, error: r.error });
      if (/not connected|Reconnect QuickBooks/i.test(r.error)) break;
    } else if (r.qboInvoiceId) report.live.push({ dealershipId: t.dealershipId, monthStart: t.monthStart, docNumber: r.docNumber, jobs: r.jobs });
  }
}

/**
 * The month closed (close_month made the app's mirror invoice): hand the
 * QuickBooks invoice over to it so the number, balance and payments keep
 * flowing to the invoice page, and the live tracker stops touching it.
 */
export async function linkClosedMonths(db: Db, companyId: string): Promise<number> {
  const { data: invoices } = await db.from("invoices").select("id, dealership_id, period_start").eq("company_id", companyId).is("quickbooks_invoice_id", null).neq("status", "void");
  let linked = 0;
  for (const inv of invoices ?? []) {
    const { data: t } = await db.from("quickbooks_month_invoices").select("*").eq("dealership_id", inv.dealership_id).eq("month_start", inv.period_start).is("invoice_id", null).maybeSingle();
    if (!t?.qbo_invoice_id) continue;
    const now = new Date().toISOString();
    await db.from("invoices").update({ quickbooks_invoice_id: t.qbo_invoice_id, quickbooks_doc_number: t.doc_number, quickbooks_sync_token: t.sync_token, quickbooks_synced_at: now, quickbooks_error: null, quickbooks_balance: t.balance, quickbooks_balance_at: t.synced_at }).eq("id", inv.id);
    await db.from("quickbooks_month_invoices").update({ invoice_id: inv.id, updated_at: now }).eq("id", t.id);
    linked++;
  }
  return linked;
}

/** Refresh number, total, balance and sent-state of the open months from QuickBooks (Mike may have sent or edited there). */
export async function pullOpenMonths(db: Db, companyId: string, report: SyncReport): Promise<void> {
  let client: QuickBooksClient | null;
  try {
    client = await clientFor(db, companyId);
  } catch {
    return;
  }
  if (!client) return;
  const { data: trackers } = await db.from("quickbooks_month_invoices").select("id, qbo_invoice_id, doc_number").eq("company_id", companyId).is("invoice_id", null).not("qbo_invoice_id", "is", null);
  for (const t of trackers ?? []) {
    try {
      const q = (await client.getInvoice(t.qbo_invoice_id!)) as QboInvoice & { EmailStatus?: string };
      await db.from("quickbooks_month_invoices").update({ doc_number: q.DocNumber ?? t.doc_number, total: q.TotalAmt ?? null, balance: q.Balance ?? null, email_status: q.EmailStatus ?? null, sync_token: q.SyncToken ?? null, synced_at: new Date().toISOString(), error: null }).eq("id", t.id);
      if (q.DocNumber && q.DocNumber !== t.doc_number) await db.from("jobs").update({ quickbooks_doc_number: q.DocNumber }).eq("quickbooks_invoice_id", t.qbo_invoice_id!);
    } catch (err) {
      report.pullErrors.push(`${t.doc_number ?? "open month"}: ${errorMessage(err)}`);
      if (err instanceof QuickBooksApiError && err.needsReconnect) break;
    }
  }
}
