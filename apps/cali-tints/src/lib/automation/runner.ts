import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClaimedRun, Database } from "@/lib/db/types";
import { appUrl, sendPlainRetailEmail, sendRetailEmail, type RetailMailResult } from "@/lib/retail/email";
import { renderTemplate, templateFor, type TemplateKey } from "@/lib/retail/templates";
import { whenIn } from "@/lib/retail/slots";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

/**
 * The 5-minute runner. Everything that decides *whether* a run happens is in
 * Postgres (rules, delays, conditions, quiet hours); this only carries the
 * run out: render the template, email it, queue the text for the owner's
 * phone, tell the owner, and log the result on the run. Zero paid keys:
 * without Resend the run is logged as skipped, never lost.
 */
export interface Sender {
  email: typeof sendRetailEmail;
  ownerEmail: typeof sendPlainRetailEmail;
}

export interface RunReport {
  enqueued: { derived: number; events: number; runs: number } | null;
  claimed: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
}

const TEMPLATE_KEYS = new Set<string>(["estimate_sent", "hold_created", "hold_expiring", "booking_confirmed", "reminder", "receipt", "abandoned", "cancelled", "review_request", "estimate_nudge", "booking_received", "findings_ready", "status_ready", "declined_work", "signed_copy"]);

/** The placeholders a template may use, from the run's subject. Pure, for tests. */
export function runVariables(run: ClaimedRun): Record<string, string | number | null | undefined> {
  const base = appUrl() ?? "";
  const s = run.subject;
  const tz = run.company.timezone || "America/Los_Angeles";
  const startsAt = typeof s.starts_at === "string" ? whenIn(s.starts_at, tz) : "";
  const token = typeof s.token === "string" ? s.token : null;
  const receiptToken = typeof s.receipt_token === "string" ? s.receipt_token : null;
  const expires = typeof s.expires_at === "string" ? formatDate(s.expires_at) : "";
  return {
    first_name: run.customer?.first_name || "there",
    vehicle: (typeof s.vehicle === "string" && s.vehicle) || "your car",
    services: typeof s.services === "string" ? s.services : "",
    starts_at: startsAt,
    hold_minutes: run.settings.hold_minutes,
    booking_url: token ? (run.subject_type === "appointment" && s.status === "hold" ? `${base}/book/${token}` : `${base}/a/${token}`) : `${base}/book`,
    manage_url: token && run.subject_type === "appointment" ? `${base}/a/${token}` : `${base}/book`,
    book_url: `${base}/book`,
    estimate_url: token && run.subject_type === "estimate" ? `${base}/e/${token}` : "",
    expires,
    receipt_url: receiptToken ? `${base}/r/${receiptToken}` : "",
    review_url: run.settings.review_url ?? "",
    declined_list: typeof s.declined_list === "string" ? s.declined_list : "",
    address: run.company.address ?? "",
    company: run.company.name,
    total: typeof s.total === "number" ? formatMoney(s.total) : "",
    display_number: typeof s.display_number === "string" ? s.display_number : "",
  };
}

/** What the owner reads when a rule says "tell me". */
export function ownerSummary(run: ClaimedRun): { subject: string; body: string } {
  const base = appUrl() ?? "";
  const who = run.customer?.display_name ?? run.customer?.first_name ?? "A customer";
  const s = run.subject;
  const vehicle = typeof s.vehicle === "string" && s.vehicle ? ` · ${s.vehicle}` : "";
  const link = run.subject_type === "appointment" ? `${base}/retail/appointments/${run.subject_id}` : run.subject_type === "estimate" ? `${base}/retail/estimates/${run.subject_id}` : run.subject_type === "job" ? `${base}/jobs/${run.subject_id}` : `${base}/retail`;
  const subject = `${run.action.owner_subject ?? run.rule_name}: ${who}${vehicle}`;
  const lines = [
    `${who}${vehicle}`,
    typeof s.display_number === "string" ? s.display_number : null,
    typeof s.starts_at === "string" ? whenIn(s.starts_at, run.company.timezone || "America/Los_Angeles") : null,
    typeof s.services === "string" && s.services ? s.services : null,
    typeof s.total === "number" ? `Total ${formatMoney(s.total)}` : null,
    typeof s.pay_choice === "string" ? (s.pay_choice === "deposit" ? "Wants to pay the deposit online" : "Pays at the shop") : null,
    `Open it: ${link}`,
  ].filter(Boolean) as string[];
  return { subject, body: lines.join("\n") };
}

export async function runAutomation(db: SupabaseClient<Database>, sender: Sender = { email: sendRetailEmail, ownerEmail: sendPlainRetailEmail }): Promise<RunReport> {
  const report: RunReport = { enqueued: null, claimed: 0, sent: 0, skipped: 0, failed: 0, errors: [] };
  const { data: enq, error: enqErr } = await db.rpc("enqueue_due_runs");
  if (enqErr) report.errors.push(`enqueue: ${enqErr.message}`);
  else report.enqueued = enq;
  const { data: runs, error: claimErr } = await db.rpc("claim_runs", { p_limit: 50 });
  if (claimErr) {
    report.errors.push(`claim: ${claimErr.message}`);
    return report;
  }
  for (const run of runs ?? []) {
    report.claimed += 1;
    const outcome = await carryOut(db, run, sender);
    const { error } = await db.rpc("complete_run", { p_id: run.run_id, p_status: outcome.status, p_result: outcome.result });
    if (error) report.errors.push(`complete ${run.run_id}: ${error.message}`);
    if (outcome.status === "sent") report.sent += 1;
    else if (outcome.status === "skipped") report.skipped += 1;
    else report.failed += 1;
  }
  return report;
}

async function carryOut(db: SupabaseClient<Database>, run: ClaimedRun, sender: Sender): Promise<{ status: "sent" | "skipped" | "failed"; result: string }> {
  const kind = run.action.kind ?? "none";
  if (kind === "none") return { status: "skipped", result: "rule has no action" };
  try {
    if (kind === "notify_owner") {
      if (!run.company.email) return { status: "skipped", result: "no shop email in Settings" };
      const { subject, body } = ownerSummary(run);
      const r = await sender.ownerEmail({ to: run.company.email, subject, body, companyName: run.company.name, refId: run.run_id });
      return r.ok ? { status: "sent", result: `owner email ${r.messageId}` } : { status: r.skipped ? "skipped" : "failed", result: r.error };
    }
    const template = run.action.template;
    if (!template || !TEMPLATE_KEYS.has(template)) return { status: "failed", result: `unknown template ${template ?? "(none)"}` };
    const key = template as TemplateKey;
    const vars = runVariables(run);
    const parts: string[] = [];
    let emailResult: RetailMailResult | null = null;
    if (kind === "email" || kind === "both") {
      emailResult = await sender.email({ to: run.customer?.email, key, templates: run.settings.email_templates, vars, companyName: run.company.name, replyTo: run.company.email, refId: run.run_id });
      parts.push(emailResult.ok ? `email ${emailResult.messageId}` : `email: ${emailResult.error}`);
    }
    if (kind === "text" || kind === "both") {
      const phone = run.customer?.phone ?? null;
      const consent = !!run.customer?.sms_opt_in;
      if (phone && consent) {
        const body = renderTemplate(templateFor(key, run.settings.email_templates).body, vars).replace(/\n{2,}/g, "\n").trim();
        const { data: id, error } = await db.rpc("queue_text", { p_company: run.company_id, p_customer: run.customer?.id ?? null, p_phone: phone, p_body: body, p_reason: run.rule_name, p_run: run.run_id });
        parts.push(error ? `text: ${error.message}` : id ? "text queued" : "text: no usable phone");
      } else {
        parts.push(phone ? "text: no consent" : "text: no phone");
      }
    }
    const anySent = (emailResult?.ok ?? false) || parts.some((p) => p === "text queued");
    if (anySent) return { status: "sent", result: parts.join(" · ") };
    const hardFailure = emailResult && !emailResult.ok && !emailResult.skipped;
    return { status: hardFailure ? "failed" : "skipped", result: parts.join(" · ") || "nothing to send" };
  } catch (err) {
    return { status: "failed", result: err instanceof Error ? err.message : "failed" };
  }
}
