import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { CloverMatchedBy, Company, Database } from "@/lib/db/types";
import { listPaymentsSince, type CloverPayment } from "./client";
import { cloverContext } from "./invoices";
import { matchPayment, type OpenInvoice } from "./matcher";
import { fromCents } from "./money";

export interface SyncResult {
  pulled: number;
  queued: number;
  matched: number;
  unmatched: number;
  error?: string;
}

const OVERLAP_MS = 24 * 3600_000;
const FIRST_SYNC_LOOKBACK_MS = 30 * 24 * 3600_000;

/**
 * Pull payments from Clover into the queue and match what can be matched.
 * Works with the service-role client (cron, webhook) or an admin's client
 * (the "Sync now" button); the RPC enforces who may apply a payment.
 */
export async function syncCloverPayments(supabase: SupabaseClient<Database>, company: Company): Promise<SyncResult> {
  const ctx = cloverContext(company);
  if (!ctx) return { pulled: 0, queued: 0, matched: 0, unmatched: 0, error: "Clover is not enabled" };

  const since = company.clover_last_sync_at ? new Date(company.clover_last_sync_at).getTime() - OVERLAP_MS : Date.now() - FIRST_SYNC_LOOKBACK_MS;
  const payments = await listPaymentsSince(ctx, since);
  const successful = payments.filter((p) => !p.result || p.result === "SUCCESS");

  // Queue every payment we have not seen (unique on company + clover id).
  const rows = successful.map((p) => toQueueRow(company.id, p));
  let queued = 0;
  if (rows.length) {
    const ids = rows.map((r) => r.clover_payment_id);
    const { data: existing } = await supabase.from("clover_payments").select("clover_payment_id").eq("company_id", company.id).in("clover_payment_id", ids);
    const known = new Set((existing ?? []).map((e) => e.clover_payment_id));
    const fresh = rows.filter((r) => !known.has(r.clover_payment_id));
    if (fresh.length) {
      const { error } = await supabase.from("clover_payments").insert(fresh);
      if (error) return { pulled: payments.length, queued: 0, matched: 0, unmatched: 0, error: error.message };
      queued = fresh.length;
    }
  }

  const { matched, unmatched } = await matchQueue(supabase, company.id);
  await supabase.from("companies").update({ clover_last_sync_at: new Date().toISOString() }).eq("id", company.id);
  return { pulled: payments.length, queued, matched, unmatched };
}

/** Try to match every unmatched queue row against open invoices. */
export async function matchQueue(supabase: SupabaseClient<Database>, companyId: string): Promise<{ matched: number; unmatched: number }> {
  const [{ data: queue }, { data: invoices }] = await Promise.all([
    supabase.from("clover_payments").select("*").eq("company_id", companyId).eq("status", "unmatched").order("paid_at"),
    supabase.from("invoices").select("id, display_number, clover_order_id, total, amount_paid").eq("company_id", companyId).in("status", ["draft", "submitted", "partial"]),
  ]);
  const open: OpenInvoice[] = (invoices ?? []).map((i) => ({ id: i.id, display_number: i.display_number, clover_order_id: i.clover_order_id, balance: Number(i.total) - Number(i.amount_paid) }));
  let matched = 0;
  let unmatched = 0;
  for (const q of queue ?? []) {
    const m = matchPayment({ amount: Number(q.amount), orderId: q.clover_order_id, reference: q.reference, note: null }, open);
    if (!m) {
      unmatched += 1;
      continue;
    }
    const { error } = await supabase.rpc("apply_clover_payment", { p_company_id: companyId, p_clover_payment_id: q.clover_payment_id, p_invoice_id: m.invoiceId, p_matched_by: m.matchedBy as CloverMatchedBy });
    if (error) {
      console.warn(`apply_clover_payment ${q.clover_payment_id}: ${error.message}`);
      unmatched += 1;
      continue;
    }
    matched += 1;
    // Keep balances current for the next row in this pass.
    const inv = open.find((i) => i.id === m.invoiceId);
    if (inv) inv.balance = Math.round((inv.balance - Number(q.amount)) * 100) / 100;
  }
  return { matched, unmatched };
}

type QueueInsert = Database["public"]["Tables"]["clover_payments"]["Insert"] & { clover_payment_id: string };

function toQueueRow(companyId: string, p: CloverPayment): QueueInsert {
  return {
    company_id: companyId,
    clover_payment_id: p.id,
    clover_order_id: p.order?.id ?? null,
    source: "clover_pos",
    amount: fromCents(p.amount),
    tip: fromCents(p.tipAmount ?? 0),
    paid_at: new Date(p.createdTime).toISOString(),
    card_brand: p.cardTransaction?.cardType ?? null,
    last4: p.cardTransaction?.last4 ?? null,
    reference: p.externalReferenceId ?? p.note ?? null,
    raw: p as unknown as QueueInsert["raw"],
    status: "unmatched",
  };
}
