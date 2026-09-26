"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth";
import { errorMessage } from "@/lib/utils";
import { loadInvoiceBundle } from "@/lib/invoices/load";
import { invoicePdf } from "@/lib/invoices/pdf";
import { invoiceCsv } from "@/lib/invoices/csv";
import { sendInvoiceEmail } from "@/lib/invoices/email";
import type { ActionResult } from "@/app/(app)/jobs/actions";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-mm-dd");

/** Batch mode: one invoice for a date range. Returns the new invoice id. */
export async function generateInvoiceAction(input: { dealership_id: string; start: string; end: string; notes?: string }): Promise<ActionResult<string>> {
  await requireAdmin();
  const parsed = z.object({ dealership_id: z.uuid(), start: dateStr, end: dateStr, notes: z.string().trim().max(1000).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (parsed.data.end < parsed.data.start) return { ok: false, error: "End date is before start date" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_invoice", {
    p_dealership_id: parsed.data.dealership_id,
    p_start: parsed.data.start,
    p_end: parsed.data.end,
    p_notes: parsed.data.notes || null,
  });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/invoices");
  revalidatePath("/jobs");
  revalidatePath("/");
  return { ok: true, data };
}

/** Per-job mode: one invoice per RO/PO for every pending job. Returns the ids. */
export async function generatePerJobInvoicesAction(input: { dealership_id: string; notes?: string }): Promise<ActionResult<string[]>> {
  await requireAdmin();
  const parsed = z.object({ dealership_id: z.uuid(), notes: z.string().trim().max(1000).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_per_job_invoices", { p_dealership_id: parsed.data.dealership_id, p_notes: parsed.data.notes || null });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/invoices");
  revalidatePath("/jobs");
  revalidatePath("/");
  return { ok: true, data: data ?? [] };
}

export async function voidInvoiceAction(id: string, reason: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_invoice", { p_id: id, p_reason: reason.trim() || null });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/jobs");
  revalidatePath("/");
  return { ok: true, data: undefined };
}

const paymentSchema = z.object({
  invoice_id: z.uuid(),
  amount: z.number().positive(),
  paid_at: dateStr,
  method: z.enum(["check", "ach", "card", "cash", "other"]),
  reference: z.string().trim().max(80).optional(),
  note: z.string().trim().max(500).optional(),
});
export type PaymentInput = z.input<typeof paymentSchema>;

export async function recordPaymentAction(input: PaymentInput): Promise<ActionResult> {
  await requireAdmin();
  const parsed = paymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const p = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("record_payment", {
    p_invoice_id: p.invoice_id,
    p_amount: p.amount,
    p_paid_at: p.paid_at,
    p_method: p.method,
    p_reference: p.reference || null,
    p_note: p.note || null,
  });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${p.invoice_id}`);
  revalidatePath("/");
  return { ok: true, data: undefined };
}

export async function deletePaymentAction(paymentId: string, invoiceId: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("invoice_payments").delete().eq("id", paymentId);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/invoices");
  return { ok: true, data: undefined };
}

/**
 * Email the invoice (PDF + CSV) to the dealership's AP contacts. Every
 * attempt, successful or not, is recorded in invoice_submissions.
 */
export async function submitInvoiceByEmailAction(id: string): Promise<ActionResult<{ recipients: string[] }>> {
  const session = await requireAdmin();
  const bundle = await loadInvoiceBundle(id);
  if (!bundle) return { ok: false, error: "Invoice not found" };
  if (bundle.invoice.status === "void") return { ok: false, error: "Invoice is void" };

  const [pdf, csv] = await Promise.all([invoicePdf(bundle, "branded"), Promise.resolve(invoiceCsv(bundle))]);
  const result = await sendInvoiceEmail(bundle, { pdf, csv });

  const supabase = await createClient();
  const { error: insErr } = await supabase.from("invoice_submissions").insert({
    company_id: bundle.invoice.company_id,
    invoice_id: id,
    method: "email",
    status: result.ok ? "sent" : "failed",
    recipients: result.to,
    cc: result.cc,
    provider: "resend",
    message_id: result.ok ? result.messageId : null,
    error: result.ok ? null : result.error,
    created_by: session.userId,
  });
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  revalidatePath("/");
  if (insErr) return { ok: false, error: `Sent but could not log the submission: ${insErr.message}` };
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: { recipients: result.to } };
}

/** Manual "Mark as submitted" for portal / paper, with an optional confirmation upload. */
export async function markSubmittedAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAdmin();
  const id = String(formData.get("invoice_id") ?? "");
  const method = String(formData.get("method") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  const file = formData.get("confirmation");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Invalid invoice" };
  if (method !== "portal" && method !== "paper" && method !== "email") return { ok: false, error: "Pick a submission method" };

  const supabase = await createClient();
  let confirmationPath: string | null = null;
  if (file instanceof File && file.size > 0) {
    if (file.size > 10 * 1024 * 1024) return { ok: false, error: "Confirmation file must be under 10 MB" };
    const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
    confirmationPath = `${session.company.id}/${id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage.from("submission-confirmations").upload(confirmationPath, file, { contentType: file.type || undefined });
    if (upErr) return { ok: false, error: `Upload failed: ${upErr.message}` };
  }

  const { error } = await supabase.rpc("mark_invoice_submitted", {
    p_invoice_id: id,
    p_method: method,
    p_note: note || null,
    p_confirmation_path: confirmationPath,
  });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  revalidatePath("/");
  return { ok: true, data: undefined };
}

export async function updateInvoiceNotesAction(id: string, notes: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").update({ notes: notes.trim() || null }).eq("id", id);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/invoices/${id}`);
  return { ok: true, data: undefined };
}
