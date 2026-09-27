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
import { cloverContext, createInvoiceCheckout, pushInvoiceOrder } from "@/lib/clover/invoices";
import { syncCloverPayments, type SyncResult } from "@/lib/clover/sync";
import { cancelDevice, createCharge, payOnDevice } from "@/lib/clover/client";
import { cloverSecrets } from "@/lib/clover/env";
import { fromCents, toCents } from "@/lib/clover/money";
import type { InvoiceBundle } from "@/lib/invoices/load";
import type { Company } from "@/lib/db/types";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use yyyy-mm-dd");

/** Batch mode: one invoice for a date range. Returns the new invoice id. */
export async function generateInvoiceAction(input: { dealership_id: string; start: string; end: string; notes?: string; exclude?: string[] }): Promise<ActionResult<string>> {
  const session = await requireAdmin();
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
  await autoPushToClover([data], session.company);
  revalidatePath("/invoices");
  revalidatePath("/jobs");
  revalidatePath("/");
  return { ok: true, data };
}

/** Per-job mode: one invoice per RO/PO for every pending job. Returns the ids. */
export async function generatePerJobInvoicesAction(input: { dealership_id: string; notes?: string; exclude?: string[] }): Promise<ActionResult<string[]>> {
  const session = await requireAdmin();
  const parsed = z.object({ dealership_id: z.uuid(), notes: z.string().trim().max(1000).optional(), exclude: z.array(z.uuid()).max(500).optional() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input" };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_per_job_invoices", {
    p_dealership_id: parsed.data.dealership_id,
    p_notes: parsed.data.notes || null,
    p_exclude: parsed.data.exclude ?? [],
  });
  if (error) return { ok: false, error: errorMessage(error) };
  await autoPushToClover(data ?? [], session.company);
  revalidatePath("/invoices");
  revalidatePath("/jobs");
  revalidatePath("/");
  return { ok: true, data: data ?? [] };
}

// --- Clover -------------------------------------------------------------------

/** Best effort after generation: a Clover hiccup must never block invoicing. The invoice page offers a manual push. */
async function autoPushToClover(ids: string[], company: Company) {
  if (!company.clover_push_orders || !cloverContext(company)) return;
  for (const id of ids) {
    const r = await pushInvoiceToCloverAction(id);
    if (!r.ok) console.warn(`Clover push for invoice ${id} failed: ${r.error}`);
  }
}

/** Mirror the invoice as an open Clover order (idempotent: returns the existing order id). */
export async function pushInvoiceToCloverAction(id: string): Promise<ActionResult<{ orderId: string }>> {
  const session = await requireAdmin();
  const ctx = cloverContext(session.company);
  if (!ctx) return { ok: false, error: "Clover is not enabled (Settings → Clover)" };
  const bundle = await loadInvoiceBundle(id);
  if (!bundle) return { ok: false, error: "Invoice not found" };
  if (bundle.invoice.status === "void") return { ok: false, error: "Invoice is void" };
  if (bundle.invoice.clover_order_id) return { ok: true, data: { orderId: bundle.invoice.clover_order_id } };
  try {
    const orderId = await pushInvoiceOrder(ctx, bundle);
    const supabase = await createClient();
    const { error } = await supabase.from("invoices").update({ clover_order_id: orderId, clover_pushed_at: new Date().toISOString() }).eq("id", id);
    if (error) return { ok: false, error: `Clover order ${orderId} created but not saved: ${error.message}` };
    revalidatePath(`/invoices/${id}`);
    return { ok: true, data: { orderId } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Reuse a live link or create a new one. Returns null when Clover checkout is off or the invoice has no balance. */
async function ensureCheckoutLink(company: Company, bundle: InvoiceBundle): Promise<{ url: string; expiresAt: string | null } | null> {
  const ctx = cloverContext(company);
  if (!ctx || !company.clover_hosted_checkout || !cloverSecrets().ecomPrivateToken) return null;
  const balance = Number(bundle.invoice.total) - Number(bundle.invoice.amount_paid);
  if (bundle.invoice.status === "void" || balance <= 0) return null;
  const current = bundle.invoice;
  const fresh = current.clover_checkout_url && (!current.clover_checkout_expires_at || new Date(current.clover_checkout_expires_at).getTime() > Date.now() + 3600_000);
  if (fresh && current.clover_checkout_url) return { url: current.clover_checkout_url, expiresAt: current.clover_checkout_expires_at };
  const link = await createInvoiceCheckout(ctx, bundle, process.env.NEXT_PUBLIC_APP_URL ?? null);
  const supabase = await createClient();
  const { error } = await supabase
    .from("invoices")
    .update({ clover_checkout_session_id: link.sessionId, clover_checkout_url: link.url, clover_checkout_expires_at: link.expiresAt })
    .eq("id", bundle.invoice.id);
  if (error) throw new Error(`Link created but not saved: ${error.message}`);
  return { url: link.url, expiresAt: link.expiresAt };
}

/** Create (or refresh an expired) hosted-checkout link for the open balance. */
export async function createCheckoutLinkAction(id: string): Promise<ActionResult<{ url: string; expiresAt: string | null }>> {
  const session = await requireAdmin();
  if (!cloverContext(session.company)) return { ok: false, error: "Clover is not enabled (Settings → Clover)" };
  const bundle = await loadInvoiceBundle(id);
  if (!bundle) return { ok: false, error: "Invoice not found" };
  try {
    const link = await ensureCheckoutLink(session.company, bundle);
    if (!link) return { ok: false, error: "Nothing left to pay on this invoice, or pay links are turned off in Settings → Clover" };
    revalidatePath(`/invoices/${id}`);
    return { ok: true, data: link };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
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
  // Pay-by-card link (Clover hosted checkout). A Clover failure must not block the email.
  let payUrl: string | null = null;
  try {
    payUrl = (await ensureCheckoutLink(session.company, bundle))?.url ?? null;
  } catch (err) {
    console.warn(`Clover pay link for ${bundle.invoice.display_number}: ${errorMessage(err)}`);
  }
  const result = await sendInvoiceEmail(bundle, { pdf, csv }, { payUrl });

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

/** Owner reviewed a flagged job and confirmed it is legitimately billable. */
export async function reviewJobDuplicateAction(jobId: string, note: string): Promise<ActionResult> {
  await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(jobId)) return { ok: false, error: "Invalid job" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_job_duplicate", { p_id: jobId, p_note: note.trim() || null });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/invoices/new");
  revalidatePath(`/jobs/${jobId}`);
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

// --- Clover: sync, queue, card charges ------------------------------------------

/** "Sync now": pull Clover payments and match what can be matched. */
export async function syncCloverAction(): Promise<ActionResult<SyncResult>> {
  const session = await requireAdmin();
  if (!cloverContext(session.company)) return { ok: false, error: "Clover is not enabled (Settings → Clover)" };
  try {
    const supabase = await createClient();
    const r = await syncCloverPayments(supabase, session.company);
    if (r.error) return { ok: false, error: r.error };
    revalidatePath("/invoices");
    revalidatePath("/");
    return { ok: true, data: r };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Owner assigns a queued Clover payment to an invoice by hand. */
export async function matchCloverPaymentAction(cloverPaymentId: string, invoiceId: string): Promise<ActionResult> {
  const session = await requireAdmin();
  const parsed = z.object({ cloverPaymentId: z.string().min(1).max(80), invoiceId: z.uuid() }).safeParse({ cloverPaymentId, invoiceId });
  if (!parsed.success) return { ok: false, error: "Pick an invoice" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_clover_payment", { p_company_id: session.company.id, p_clover_payment_id: parsed.data.cloverPaymentId, p_invoice_id: parsed.data.invoiceId, p_matched_by: "manual" });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${invoiceId}`);
  revalidatePath("/");
  return { ok: true, data: undefined };
}

export async function ignoreCloverPaymentAction(cloverPaymentId: string, ignore = true): Promise<ActionResult> {
  const session = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.rpc("ignore_clover_payment", { p_company_id: session.company.id, p_clover_payment_id: cloverPaymentId, p_ignore: ignore });
  if (error) return { ok: false, error: errorMessage(error) };
  revalidatePath("/invoices");
  revalidatePath("/");
  return { ok: true, data: undefined };
}

/**
 * Charge a card tokenised by the Clover iframe in the app. The charge is
 * queued and applied through the same path as every other Clover payment,
 * so the invoice status and audit trail stay consistent.
 */
export async function chargeCardAction(input: { invoiceId: string; token: string; amount: number }): Promise<ActionResult<{ amount: number; last4: string | null }>> {
  const session = await requireAdmin();
  const ctx = cloverContext(session.company);
  if (!ctx) return { ok: false, error: "Clover is not enabled (Settings → Clover)" };
  const parsed = z.object({ invoiceId: z.uuid(), token: z.string().regex(/^clv_[A-Za-z0-9_-]+$/, "Card token is invalid"), amount: z.number().positive().max(1_000_000) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const bundle = await loadInvoiceBundle(parsed.data.invoiceId);
  if (!bundle) return { ok: false, error: "Invoice not found" };
  const balance = Number(bundle.invoice.total) - Number(bundle.invoice.amount_paid);
  if (bundle.invoice.status === "void" || balance <= 0) return { ok: false, error: "Nothing left to pay on this invoice" };
  const amount = Math.min(Math.round(parsed.data.amount * 100) / 100, balance);
  try {
    const charge = await createCharge(ctx, {
      amountCents: toCents(amount),
      source: parsed.data.token,
      description: `${bundle.invoice.display_number} · ${bundle.dealership.name}`,
      externalReferenceId: bundle.invoice.display_number,
      idempotencyKey: `${bundle.invoice.id}:${parsed.data.token}`,
    });
    if (charge.status && !/succeeded|paid|approved/i.test(charge.status)) return { ok: false, error: charge.failure_message ?? `Card declined (${charge.status})` };
    const supabase = await createClient();
    const paymentId = `charge_${charge.id}`;
    await supabase.from("clover_payments").upsert(
      {
        company_id: session.company.id,
        clover_payment_id: paymentId,
        source: "clover_card",
        amount: fromCents(charge.amount ?? toCents(amount)),
        paid_at: new Date().toISOString(),
        card_brand: charge.source?.brand ?? null,
        last4: charge.source?.last4 ?? null,
        reference: `${bundle.invoice.display_number} · in app`,
        raw: charge as never,
        status: "unmatched",
      },
      { onConflict: "company_id,clover_payment_id", ignoreDuplicates: true },
    );
    const { error } = await supabase.rpc("apply_clover_payment", { p_company_id: session.company.id, p_clover_payment_id: paymentId, p_invoice_id: bundle.invoice.id, p_matched_by: "card" });
    if (error) return { ok: false, error: `Card charged (${charge.id}) but the payment could not be recorded: ${error.message}. Use Sync Clover or match it from the queue.` };
    revalidatePath(`/invoices/${bundle.invoice.id}`);
    revalidatePath("/invoices");
    revalidatePath("/");
    return { ok: true, data: { amount, last4: charge.source?.last4 ?? null } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Send the amount to the Clover terminal and record the payment when the device answers. */
export async function payOnDeviceAction(input: { invoiceId: string; amount: number }): Promise<ActionResult<{ amount: number; last4: string | null }>> {
  const session = await requireAdmin();
  const ctx = cloverContext(session.company);
  if (!ctx) return { ok: false, error: "Clover is not enabled (Settings → Clover)" };
  if (!session.company.clover_device_id) return { ok: false, error: "Add the Clover device serial in Settings → Clover first" };
  const parsed = z.object({ invoiceId: z.uuid(), amount: z.number().positive().max(1_000_000) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: "Enter an amount" };
  const bundle = await loadInvoiceBundle(parsed.data.invoiceId);
  if (!bundle) return { ok: false, error: "Invoice not found" };
  const balance = Number(bundle.invoice.total) - Number(bundle.invoice.amount_paid);
  if (bundle.invoice.status === "void" || balance <= 0) return { ok: false, error: "Nothing left to pay on this invoice" };
  const amount = Math.min(Math.round(parsed.data.amount * 100) / 100, balance);
  const device = { deviceId: session.company.clover_device_id, posId: session.company.clover_pos_id || "Cali Tints app" };
  try {
    const res = await payOnDevice(ctx, device, { amountCents: toCents(amount), externalPaymentId: `${bundle.invoice.id.slice(0, 8)}-${Date.now()}`, externalReferenceId: bundle.invoice.display_number });
    const payment = res.payment;
    if (!payment || (payment.result && payment.result !== "SUCCESS")) {
      const msg = typeof res.error === "string" ? res.error : res.error?.message ?? res.message ?? (payment?.result ? `Terminal reported ${payment.result}` : "The terminal did not complete the payment");
      return { ok: false, error: msg };
    }
    const supabase = await createClient();
    await supabase.from("clover_payments").upsert(
      {
        company_id: session.company.id,
        clover_payment_id: payment.id,
        clover_order_id: payment.order?.id ?? bundle.invoice.clover_order_id,
        source: "clover_pos",
        amount: fromCents(payment.amount ?? toCents(amount)),
        tip: fromCents(payment.tipAmount ?? 0),
        paid_at: new Date(payment.createdTime ?? Date.now()).toISOString(),
        card_brand: payment.cardTransaction?.cardType ?? null,
        last4: payment.cardTransaction?.last4 ?? null,
        reference: `${bundle.invoice.display_number} · terminal`,
        raw: payment as never,
        status: "unmatched",
      },
      { onConflict: "company_id,clover_payment_id", ignoreDuplicates: true },
    );
    const { error } = await supabase.rpc("apply_clover_payment", { p_company_id: session.company.id, p_clover_payment_id: payment.id, p_invoice_id: bundle.invoice.id, p_matched_by: "device" });
    if (error) return { ok: false, error: `The terminal took the payment (${payment.id}) but it could not be recorded: ${error.message}. Use Sync Clover or match it from the queue.` };
    revalidatePath(`/invoices/${bundle.invoice.id}`);
    revalidatePath("/invoices");
    revalidatePath("/");
    return { ok: true, data: { amount: fromCents(payment.amount ?? toCents(amount)), last4: payment.cardTransaction?.last4 ?? null } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

export async function cancelDevicePaymentAction(): Promise<ActionResult> {
  const session = await requireAdmin();
  const ctx = cloverContext(session.company);
  if (!ctx || !session.company.clover_device_id) return { ok: false, error: "No Clover device configured" };
  try {
    await cancelDevice(ctx, { deviceId: session.company.clover_device_id, posId: session.company.clover_pos_id || "Cali Tints app" });
    return { ok: true, data: undefined };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}
