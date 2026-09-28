"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireOwnerAdmin } from "@/lib/auth";
import { errorMessage } from "@/lib/utils";
import type { ActionResult } from "@/app/(app)/jobs/actions";
import type { PaymentMethod, PaymentSource, TerminalTransaction } from "@/lib/db/types";
import { cloverContext } from "@/lib/clover/invoices";
import { chargeCardToQueue, deviceToQueue } from "@/lib/clover/charges";
import { refundCharge, refundPayment } from "@/lib/clover/client";
import { toCents } from "@/lib/clover/money";
import { sendReceiptEmail } from "@/lib/terminal/send-receipt";
import { autoReceipt } from "@/lib/terminal/auto-receipt";
import { LEDGER_SELECT, PAYMENT_SELECT, paymentToTransaction, toTransaction, type LedgerRow, type PaymentRow } from "@/lib/terminal/ledger";

/*
  Terminal actions: take a payment (card in app, card on the device, cash,
  check, ACH/other) for an invoice or as a stand-alone sale, refund, and email
  receipts. Invoice-linked money goes through the same RPCs as the invoice
  page (record_payment / apply_clover_payment); every transaction also gets a
  terminal_sales ledger row.
*/

const money = z.number().positive().max(1_000_000);
const saleSchema = z.object({
  amount: money,
  method: z.enum(["card", "device", "cash", "check", "ach", "other"]),
  token: z.string().regex(/^clv_[A-Za-z0-9_-]+$/, "Card token is invalid").optional(),
  invoiceId: z.uuid().optional(),
  /** Several unpaid invoices settled with one payment (oldest first). */
  invoiceIds: z.array(z.uuid()).min(1).max(50).optional(),
  description: z.string().trim().max(200).optional(),
  customerName: z.string().trim().max(120).optional(),
  customerEmail: z.email().optional().or(z.literal("")),
  reference: z.string().trim().max(80).optional(),
});
export type SaleInput = z.input<typeof saleSchema>;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** yyyy-mm-dd today in the company's timezone (paid_at is a date column). */
function todayIn(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

/** Settings → Receipts: the receipt went out by itself; show it as sent on the Paid dialog. */
const markSent = (tx: TerminalTransaction, to: string | null): TerminalTransaction => (to ? { ...tx, receipt_sent_at: new Date().toISOString(), customer_email: to } : tx);

function revalidate(invoiceId?: string | null) {
  revalidatePath("/terminal");
  revalidatePath("/invoices");
  revalidatePath("/");
  if (invoiceId) revalidatePath(`/invoices/${invoiceId}`);
}

/** A sale plus, for a combined payment, every per-invoice row it was split into. */
export type SaleResult = TerminalTransaction & { group?: TerminalTransaction[] };

/** Take a payment. Returns the ledger row for the receipt view. */
export async function takeSaleAction(input: SaleInput): Promise<ActionResult<SaleResult>> {
  const session = await requireOwnerAdmin();
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const d = parsed.data;
  const ids = [...new Set(d.invoiceIds ?? [])];
  if (ids.length > 1) return takeBatch(session, { ...d, invoiceIds: ids });
  if (ids.length === 1) d.invoiceId = ids[0];
  const supabase = await createClient();
  const company = session.company;

  // Invoice-linked: cap at the open balance.
  let invoice: { id: string; display_number: string; clover_order_id: string | null; dealership: { name: string } | null } | null = null;
  let amount = round2(d.amount);
  if (d.invoiceId) {
    const { data: raw } = await supabase.from("invoices").select("id, display_number, total, amount_paid, status, clover_order_id, dealership:dealerships(name)").eq("id", d.invoiceId).maybeSingle();
    const inv = raw as unknown as { id: string; display_number: string; total: number; amount_paid: number; status: string; clover_order_id: string | null; dealership: { name: string } | null } | null;
    if (!inv) return { ok: false, error: "Invoice not found" };
    const balance = Number(inv.total) - Number(inv.amount_paid);
    if (inv.status === "void" || balance <= 0) return { ok: false, error: "Nothing left to pay on this invoice" };
    amount = Math.min(amount, round2(balance));
    invoice = inv;
  }
  const label = invoice ? `${invoice.display_number}${invoice.dealership ? ` · ${invoice.dealership.name}` : ""}` : d.description || "Counter sale";
  const reference = invoice ? `${invoice.display_number} · terminal` : `Terminal · ${label}`.slice(0, 80);

  let paymentId: string | null = null;
  let source: PaymentSource = "manual";
  let method: PaymentMethod = d.method === "device" ? "card" : d.method;
  let brand: string | null = null;
  let last4: string | null = null;
  let cloverPaymentId: string | null = null;
  let chargeId: string | null = null;

  try {
    if (d.method === "card" || d.method === "device") {
      const ctx = cloverContext(company);
      if (!ctx) return { ok: false, error: "Clover is not enabled (Settings → Clover)" };
      const queueStatus = invoice ? "unmatched" : "ignored";
      if (d.method === "card") {
        if (!d.token) return { ok: false, error: "Card details are missing" };
        const take = await chargeCardToQueue(ctx, supabase, company.id, { token: d.token, amount, description: label, reference, idempotencyKey: `terminal:${d.token}`, status: queueStatus });
        source = "clover_card";
        ({ brand, last4, cloverPaymentId, chargeId } = take);
        amount = take.amount;
      } else {
        if (!company.clover_device_id) return { ok: false, error: "Add the Clover device serial in Settings → Clover first" };
        const device = { deviceId: company.clover_device_id, posId: company.clover_pos_id || "Cali Tints app" };
        const take = await deviceToQueue(ctx, device, supabase, company.id, { amount, reference, externalPaymentId: `term-${Date.now()}`, orderId: invoice?.clover_order_id ?? null, status: queueStatus });
        source = "clover_pos";
        ({ brand, last4, cloverPaymentId } = take);
        amount = take.amount;
      }
      method = "card";
      if (invoice && cloverPaymentId) {
        const { data, error } = await supabase.rpc("apply_clover_payment", { p_company_id: company.id, p_clover_payment_id: cloverPaymentId, p_invoice_id: invoice.id, p_matched_by: d.method === "card" ? "card" : "device" });
        if (error) return { ok: false, error: `The card was charged (${cloverPaymentId}) but the payment could not be recorded on the invoice: ${error.message}. Use Sync Clover or match it from the queue.` };
        paymentId = data;
      }
    } else if (invoice) {
      const { data, error } = await supabase.rpc("record_payment", {
        p_invoice_id: invoice.id,
        p_amount: amount,
        p_paid_at: todayIn(company.timezone),
        p_method: method,
        p_reference: d.reference || null,
        p_note: d.description || "Terminal",
      });
      if (error) return { ok: false, error: error.message };
      paymentId = data;
    }

    const { data: row, error } = await supabase
      .from("terminal_sales")
      .insert({
        company_id: company.id,
        kind: "sale",
        amount,
        method,
        source,
        invoice_id: invoice?.id ?? null,
        payment_id: paymentId,
        description: invoice ? null : d.description || null,
        customer_name: d.customerName || null,
        customer_email: d.customerEmail || null,
        reference: d.reference || null,
        card_brand: brand,
        last4,
        clover_payment_id: cloverPaymentId,
        clover_charge_id: chargeId,
        created_by: session.userId,
      })
      .select(LEDGER_SELECT)
      .single();
    if (error || !row) return { ok: false, error: `Payment taken but the ledger row failed: ${error?.message ?? "unknown"}` };
    const { sentTo } = invoice && paymentId ? await autoReceipt(supabase, company, [paymentId]) : { sentTo: null };
    revalidate(invoice?.id);
    return { ok: true, data: markSent(toTransaction(row as unknown as LedgerRow), sentTo) };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** One payment across several unpaid invoices: one Clover charge (or one check), split oldest first, one ledger row per invoice sharing a group id. */
async function takeBatch(session: Awaited<ReturnType<typeof requireOwnerAdmin>>, d: z.output<typeof saleSchema> & { invoiceIds: string[] }): Promise<ActionResult<SaleResult>> {
  const supabase = await createClient();
  const company = session.company;
  const { data: raw } = await supabase.from("invoices").select("id, number, display_number, total, amount_paid, status, dealership:dealerships(name, ap_emails)").in("id", d.invoiceIds);
  const invoices = (raw ?? []) as unknown as { id: string; number: number; display_number: string; total: number; amount_paid: number; status: string; dealership: { name: string; ap_emails: string[] } | null }[];
  const open = invoices.filter((i) => i.status !== "void" && Number(i.total) - Number(i.amount_paid) > 0).sort((a, b) => a.number - b.number);
  if (open.length !== d.invoiceIds.length) return { ok: false, error: "One of the invoices is not open any more. Refresh and try again." };
  const sum = round2(open.reduce((s, i) => s + Number(i.total) - Number(i.amount_paid), 0));
  let amount = Math.min(round2(d.amount), sum);
  const dealers = [...new Set(open.map((i) => i.dealership?.name).filter(Boolean))];
  const label = `${open.length} invoices${dealers.length === 1 ? ` · ${dealers[0]}` : ""}`;
  const reference = `${open.map((i) => i.display_number).join(", ")} · terminal`.slice(0, 80);

  let source: PaymentSource = "manual";
  let method: PaymentMethod = d.method === "device" ? "card" : d.method;
  let brand: string | null = null;
  let last4: string | null = null;
  let cloverPaymentId: string | null = null;
  let chargeId: string | null = null;

  try {
    if (d.method === "card" || d.method === "device") {
      const ctx = cloverContext(company);
      if (!ctx) return { ok: false, error: "Clover is not enabled (Settings → Clover)" };
      // One Clover payment for the whole batch; parked as ignored so the sync never re-matches it to a single invoice.
      if (d.method === "card") {
        if (!d.token) return { ok: false, error: "Card details are missing" };
        const take = await chargeCardToQueue(ctx, supabase, company.id, { token: d.token, amount, description: label, reference, idempotencyKey: `terminal:${d.token}`, status: "ignored" });
        source = "clover_card";
        ({ brand, last4, cloverPaymentId, chargeId } = take);
        amount = take.amount;
      } else {
        if (!company.clover_device_id) return { ok: false, error: "Add the Clover device serial in Settings → Clover first" };
        const device = { deviceId: company.clover_device_id, posId: company.clover_pos_id || "Cali Tints app" };
        const take = await deviceToQueue(ctx, device, supabase, company.id, { amount, reference, externalPaymentId: `term-${Date.now()}`, orderId: null, status: "ignored" });
        source = "clover_pos";
        ({ brand, last4, cloverPaymentId } = take);
        amount = take.amount;
      }
      method = "card";
    }

    const { data: split, error } = await supabase.rpc("record_batch_payment", {
      p_invoice_ids: open.map((i) => i.id),
      p_amount: amount,
      p_method: method,
      p_reference: cloverPaymentId ?? d.reference ?? null,
      p_note: d.description || `Terminal · ${label}`,
      p_source: source,
    });
    if (error || !split?.length) {
      const taken = cloverPaymentId ? `The card was charged (${cloverPaymentId}) but ` : "";
      return { ok: false, error: `${taken}the payment could not be recorded on the invoices: ${error?.message ?? "nothing allocated"}.${cloverPaymentId ? " Match it from the Clover queue on the Invoices page." : ""}` };
    }

    const groupId = crypto.randomUUID();
    const byId = new Map(open.map((i) => [i.id, i]));
    const rows = split.map((x) => {
      const inv = byId.get(x.invoice_id);
      return {
        company_id: company.id,
        kind: "sale" as const,
        amount: Number(x.amount),
        method,
        source,
        invoice_id: x.invoice_id,
        payment_id: x.payment_id,
        group_id: groupId,
        description: null,
        customer_name: d.customerName || inv?.dealership?.name || null,
        customer_email: d.customerEmail || inv?.dealership?.ap_emails?.[0] || null,
        reference: d.reference || null,
        card_brand: brand,
        last4,
        clover_payment_id: cloverPaymentId,
        clover_charge_id: chargeId,
        created_by: session.userId,
      };
    });
    const { data: inserted, error: insErr } = await supabase.from("terminal_sales").insert(rows).select(LEDGER_SELECT);
    if (insErr || !inserted?.length) return { ok: false, error: `Payment recorded but the ledger rows failed: ${insErr?.message ?? "unknown"}` };
    const { sentTo } = await autoReceipt(supabase, company, split.map((x) => x.payment_id));
    const group = (inserted as unknown as LedgerRow[])
      .map((r) => markSent(toTransaction(r), sentTo))
      .sort((a, b) => split.findIndex((x) => x.payment_id === a.payment_id) - split.findIndex((x) => x.payment_id === b.payment_id));
    for (const i of open) revalidatePath(`/invoices/${i.id}`);
    revalidate();
    return { ok: true, data: { ...group[0], group } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Refund part or all of a sale (ledger row id) or of an invoice payment recorded elsewhere. */
export async function refundSaleAction(input: { saleId?: string | null; paymentId?: string | null; amount: number }): Promise<ActionResult<TerminalTransaction>> {
  const session = await requireOwnerAdmin();
  const parsed = z.object({ saleId: z.uuid().nullish(), paymentId: z.uuid().nullish(), amount: money }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { saleId, paymentId } = parsed.data;
  const amount = round2(parsed.data.amount);
  const supabase = await createClient();

  // What is being refunded, and how it was paid.
  let source: PaymentSource = "manual";
  let cloverPaymentId: string | null = null;
  let chargeId: string | null = null;
  let remaining = 0;
  let invoiceId: string | null = null;
  let ledgerId: string | null = saleId ?? null;
  if (saleId) {
    const { data: s } = await supabase.from("terminal_sales").select("*").eq("id", saleId).eq("kind", "sale").maybeSingle();
    if (!s) return { ok: false, error: "Sale not found" };
    source = s.source;
    cloverPaymentId = s.clover_payment_id;
    chargeId = s.clover_charge_id;
    remaining = round2(Number(s.amount) - Number(s.refunded_amount));
    invoiceId = s.invoice_id;
  } else if (paymentId) {
    const { data: existing } = await supabase.from("terminal_sales").select("*").eq("payment_id", paymentId).eq("kind", "sale").maybeSingle();
    if (existing) {
      ledgerId = existing.id;
      source = existing.source;
      cloverPaymentId = existing.clover_payment_id;
      chargeId = existing.clover_charge_id;
      remaining = round2(Number(existing.amount) - Number(existing.refunded_amount));
      invoiceId = existing.invoice_id;
    } else {
      const { data: p } = await supabase.from("invoice_payments").select("*").eq("id", paymentId).maybeSingle();
      if (!p) return { ok: false, error: "Payment not found" };
      source = p.source;
      cloverPaymentId = p.clover_payment_id;
      chargeId = p.clover_charge_id;
      remaining = round2(Number(p.amount));
      invoiceId = p.invoice_id;
    }
  } else return { ok: false, error: "Nothing to refund" };
  if (amount > remaining + 0.005) return { ok: false, error: `Only ${remaining.toFixed(2)} is left to refund` };
  if (source === "clover_checkout") return { ok: false, error: "Payments made through the pay-by-card link are refunded from the Clover dashboard" };

  try {
    // Money first, then the books.
    let cloverRefundId: string | null = null;
    if (source === "clover_card" || source === "clover_pos") {
      const ctx = cloverContext(session.company);
      if (!ctx) return { ok: false, error: "Clover is not enabled (Settings → Clover)" };
      if (source === "clover_card") {
        const id = chargeId ?? cloverPaymentId?.replace(/^charge_/, "");
        if (!id) return { ok: false, error: "This card charge has no Clover id to refund" };
        const r = await refundCharge(ctx, { chargeId: id, amountCents: toCents(amount), idempotencyKey: `refund:${ledgerId ?? paymentId}:${toCents(amount)}:${Date.now()}` });
        if (r.status && /fail|declin/i.test(r.status)) return { ok: false, error: r.failure_message ?? `Clover declined the refund (${r.status})` };
        cloverRefundId = r.id ?? null;
      } else {
        if (!cloverPaymentId) return { ok: false, error: "This payment has no Clover id to refund" };
        const r = await refundPayment(ctx, { paymentId: cloverPaymentId, amountCents: toCents(amount) });
        cloverRefundId = r.id ?? null;
      }
    }
    const { data: refundId, error } = await supabase.rpc("refund_terminal_sale", { p_sale_id: ledgerId, p_payment_id: ledgerId ? null : paymentId ?? null, p_amount: amount, p_clover_refund_id: cloverRefundId });
    if (error) return { ok: false, error: cloverRefundId ? `Clover refunded ${amount.toFixed(2)} (${cloverRefundId}) but the books could not be updated: ${error.message}` : error.message };
    const { data: row } = await supabase.from("terminal_sales").select(LEDGER_SELECT).eq("id", refundId).single();
    revalidate(invoiceId);
    if (!row) return { ok: false, error: "Refund recorded but could not be loaded" };
    return { ok: true, data: toTransaction(row as unknown as LedgerRow) };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/** Email a receipt for a ledger row or an invoice payment recorded elsewhere. */
export async function emailReceiptAction(input: { id: string; to: string }): Promise<ActionResult<{ to: string }>> {
  const session = await requireOwnerAdmin();
  const parsed = z.object({ id: z.uuid(), to: z.email("Enter a valid email") }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const supabase = await createClient();
  let tx: TerminalTransaction | null = null;
  const { data: row } = await supabase.from("terminal_sales").select(LEDGER_SELECT).eq("id", parsed.data.id).maybeSingle();
  if (row) tx = toTransaction(row as unknown as LedgerRow);
  else {
    const { data: rawP } = await supabase.from("invoice_payments").select(PAYMENT_SELECT).eq("id", parsed.data.id).maybeSingle();
    const p = rawP as unknown as PaymentRow | null;
    if (!p) return { ok: false, error: "Transaction not found" };
    tx = paymentToTransaction(p);
  }
  let group: TerminalTransaction[] | null = null;
  if (tx.group_id) {
    const { data: rows } = await supabase.from("terminal_sales").select(LEDGER_SELECT).eq("group_id", tx.group_id).eq("kind", "sale").order("created_at");
    group = ((rows ?? []) as unknown as LedgerRow[]).map(toTransaction);
  }
  const r = await sendReceiptEmail(tx, session.company, parsed.data.to, group);
  if (!r.ok) return { ok: false, error: r.error };
  if (row) await supabase.from("terminal_sales").update({ receipt_sent_at: new Date().toISOString(), customer_email: row.customer_email ?? parsed.data.to }).eq("id", row.id);
  revalidatePath("/terminal");
  return { ok: true, data: { to: parsed.data.to } };
}
