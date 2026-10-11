import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";
import { loadInvoiceBundle } from "./load";
import { invoicePdf } from "./pdf";
import { invoiceCsv } from "./csv";
import { sendInvoiceEmail } from "./email";

type Db = SupabaseClient<Database>;

/**
 * Email one invoice (PDF + CSV) to the dealership's AP contacts and record
 * the attempt in invoice_submissions. Shared by the invoice page action and
 * the month-close job (service role, no signed-in user).
 */
export async function emailInvoice(db: Db, id: string, createdBy: string | null): Promise<{ ok: true; recipients: string[] } | { ok: false; error: string }> {
  const bundle = await loadInvoiceBundle(id, db);
  if (!bundle) return { ok: false, error: "Invoice not found" };
  if (bundle.invoice.status === "void") return { ok: false, error: "Invoice is void" };

  const [pdf, csv] = await Promise.all([invoicePdf(bundle, "branded"), Promise.resolve(invoiceCsv(bundle))]);
  const result = await sendInvoiceEmail(bundle, { pdf, csv });

  const { error: insErr } = await db.from("invoice_submissions").insert({
    company_id: bundle.invoice.company_id,
    invoice_id: id,
    method: "email",
    status: result.ok ? "sent" : "failed",
    recipients: result.to,
    cc: result.cc,
    provider: "resend",
    message_id: result.ok ? result.messageId : null,
    error: result.ok ? null : result.error,
    created_by: createdBy,
  });
  if (insErr) return { ok: false, error: `Sent but could not log the submission: ${insErr.message}` };
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, recipients: result.to };
}

export interface MonthCloseReport {
  created: { id: string; display_number: string; dealership: string; total: number }[];
  emailed: number;
  emailErrors: { id: string; display_number: string; error: string }[];
}

/**
 * Close every finished month for one company: one invoice per dealership per
 * month, then (when the company wants it) email each one to the dealership.
 * Idempotent: a second run finds nothing left to invoice.
 */
export async function closeMonth(db: Db, companyId: string, through: string | null = null): Promise<MonthCloseReport> {
  const { data: ids, error } = await db.rpc("close_month", { p_company: companyId, p_through: through });
  if (error) throw new Error(error.message);
  const created = ids ?? [];
  const report: MonthCloseReport = { created: [], emailed: 0, emailErrors: [] };
  if (created.length === 0) return report;

  const { data: rows } = await db.from("invoices").select("id, display_number, total, dealership:dealerships(name)").in("id", created);
  for (const r of rows ?? []) report.created.push({ id: r.id, display_number: r.display_number, total: Number(r.total), dealership: (r.dealership as unknown as { name: string } | null)?.name ?? "" });

  const { data: company } = await db.from("companies").select("auto_send_monthly").eq("id", companyId).maybeSingle();
  if (!company?.auto_send_monthly) return report;
  for (const inv of report.created) {
    const r = await emailInvoice(db, inv.id, null);
    if (r.ok) report.emailed += 1;
    else report.emailErrors.push({ id: inv.id, display_number: inv.display_number, error: r.error });
  }
  return report;
}
