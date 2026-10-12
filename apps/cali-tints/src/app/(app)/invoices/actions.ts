"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOwner } from "@/lib/auth";
import { errorMessage } from "@/lib/utils";
import { loadInvoiceBundle } from "@/lib/invoices/load";
import { invoiceEmailEnvelope, invoiceEmailHtml } from "@/lib/invoices/email";
import { emailInvoice } from "@/lib/invoices/submit";
import type { ActionResult } from "@/app/(app)/jobs/actions";
import { updateJobSchema, type UpdateJobInput } from "@/lib/jobs/schema";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-mm-dd");

/**
 * Fix the car on a draft, unpaid, one-car invoice (typo in the tag, wrong
 * service, wrong day). The RPC re-snapshots the lines and keeps the number;
 * owners and the car's own detailer may do this.
 */
export async function editInvoiceCarAction(input: UpdateJobInput & { invoice_id: string }): Promise<ActionResult> {
  await requireOwner();
  const parsed = updateJobSchema.extend({ invoice_id: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { id: _jobId, invoice_id, ...p } = parsed.data;
  void _jobId;
  const supabase = await createClient();
  const { error } = await supabase.rpc("edit_invoice_car", { p_invoice_id: invoice_id, p });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoice_id}`);
  revalidatePath("/");
  return { ok: true, data: undefined };
}

/** A car that should never have been logged: void its invoice and soft-delete the car (kept for audit). */
export async function deleteInvoiceCarAction(invoiceId: string, reason: string): Promise<ActionResult> {
  await requireOwner();
  if (!/^[0-9a-f-]{36}$/i.test(invoiceId)) return { ok: false, error: "Invalid invoice" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_invoice_car", { p_invoice_id: invoiceId, p_reason: reason.trim() || null });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/");
  return { ok: true, data: undefined };
}

/** Back from the archive: un-void the invoice, restore its car, relink them (same number). */
export async function restoreInvoiceCarAction(invoiceId: string): Promise<ActionResult> {
  await requireOwner();
  if (!/^[0-9a-f-]{36}$/i.test(invoiceId)) return { ok: false, error: "Invalid invoice" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_invoice_car", { p_invoice_id: invoiceId });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/");
  return { ok: true, data: undefined };
}

/** Batch mode: one invoice for a date range. Returns the new invoice id. */
export async function generateInvoiceAction(input: { dealership_id: string; start: string; end: string; notes?: string; exclude?: string[] }): Promise<ActionResult<string>> {
  await requireOwner();
  const parsed = z
    .object({ dealership_id: z.uuid(), start: dateStr, end: dateStr, notes: z.string().trim().max(1000).optional(), exclude: z.array(z.uuid()).max(500).optional() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  if (parsed.data.end < parsed.data.start) return { ok: false, error: "End date is before start date" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_invoice", {
    p_dealership_id: parsed.data.dealership_id,
    p_start: parsed.data.start,
    p_end: parsed.data.end,
    p_notes: parsed.data.notes || null,
    p_exclude: parsed.data.exclude ?? [],
  });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/invoices");
  revalidatePath("/");
  return { ok: true, data };
}

/** Per-job mode: one invoice per RO/PO for every pending job. Returns the ids. */
export async function generatePerJobInvoicesAction(input: { dealership_id: string; notes?: string; exclude?: string[] }): Promise<ActionResult<string[]>> {
  await requireOwner();
  const parsed = z.object({ dealership_id: z.uuid(), notes: z.string().trim().max(1000).optional(), exclude: z.array(z.uuid()).max(500).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_per_job_invoices", {
    p_dealership_id: parsed.data.dealership_id,
    p_notes: parsed.data.notes || null,
    p_exclude: parsed.data.exclude ?? [],
  });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/invoices");
  revalidatePath("/");
  return { ok: true, data: data ?? [] };
}

export async function voidInvoiceAction(id: string, reason: string): Promise<ActionResult> {
  await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_invoice", { p_id: id, p_reason: reason.trim() || null });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
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
  await requireOwner();
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
  await requireOwner();
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
  const session = await requireOwner();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Invalid invoice" };
  const supabase = await createClient();
  const r = await emailInvoice(supabase, id, session.userId);
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/invoices");
  revalidatePath("/");
  if (!r.ok) return { ok: false, error: r.error };
  return { ok: true, data: { recipients: r.recipients } };
}

/** The owner closes one dealership's month early: every open job through today goes on one invoice now. */
export async function invoiceNowAction(dealershipId: string): Promise<ActionResult<string>> {
  await requireOwner();
  if (!/^[0-9a-f-]{36}$/i.test(dealershipId)) return { ok: false, error: "Invalid dealership" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("invoice_now", { p_dealership_id: dealershipId });
  if (error || !data) return { ok: false, error: error ? errorMessage(error) : "Nothing to invoice" };
  revalidatePath("/invoices");
  revalidatePath("/jobs");
  revalidatePath("/");
  return { ok: true, data };
}

/** The email as it will arrive. */
export async function previewInvoiceEmailAction(id: string): Promise<ActionResult<{ to: string[]; cc: string[]; subject: string; html: string; attachments: { name: string; href: string | null }[] }>> {
  await requireOwner();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, error: "Invalid invoice" };
  const bundle = await loadInvoiceBundle(id);
  if (!bundle) return { ok: false, error: "Invoice not found" };
  const env = invoiceEmailEnvelope(bundle);
  return {
    ok: true,
    data: {
      to: env.to,
      cc: env.cc,
      subject: env.subject,
      html: invoiceEmailHtml(bundle, process.env.NEXT_PUBLIC_APP_URL ?? null),
      attachments: [
        { name: `${env.stem}.pdf`, href: `/api/invoices/${id}/pdf?inline=1` },
        { name: `${env.stem}.csv`, href: `/api/invoices/${id}/csv` },
      ],
    },
  };
}

/** "Send invoices": email every chosen unsent invoice, one after another. Never throws for one bad address; the caller gets the list. */
export async function sendInvoicesAction(ids: string[]): Promise<ActionResult<{ sent: number; failed: { id: string; number: string; error: string }[] }>> {
  await requireOwner();
  const parsed = z.array(z.uuid()).min(1).max(200).safeParse(ids);
  if (!parsed.success) return { ok: false, error: "Pick at least one invoice" };
  const supabase = await createClient();
  const { data: rows } = await supabase.from("invoices").select("id, display_number, status").in("id", parsed.data).eq("status", "draft");
  let sent = 0;
  const failed: { id: string; number: string; error: string }[] = [];
  for (const inv of rows ?? []) {
    const r = await submitInvoiceByEmailAction(inv.id);
    if (r.ok) sent += 1;
    else failed.push({ id: inv.id, number: inv.display_number, error: r.error });
  }
  revalidatePath("/invoices");
  revalidatePath("/");
  return { ok: true, data: { sent, failed } };
}

/** Manual "Mark as submitted" for portal / paper, with an optional confirmation upload. */
export async function markSubmittedAction(formData: FormData): Promise<ActionResult> {
  const session = await requireOwner();
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

/** Owner reviewed a flagged job and confirmed it is legitimately billable. */
export async function reviewJobDuplicateAction(jobId: string, note: string): Promise<ActionResult> {
  await requireOwner();
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return { ok: false, error: "Invalid job" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_job_duplicate", { p_id: jobId, p_note: note.trim() || null });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/invoices/new");
  return { ok: true, data: undefined };
}

export async function updateInvoiceNotesAction(id: string, notes: string): Promise<ActionResult> {
  await requireOwner();
  const supabase = await createClient();
  const { error } = await supabase.from("invoices").update({ notes: notes.trim() || null }).eq("id", id);
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath(`/invoices/${id}`);
  return { ok: true, data: undefined };
}
