import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Company, Database, TerminalTransaction } from "@/lib/db/types";
import { LEDGER_SELECT, PAYMENT_SELECT, paymentToTransaction, toTransaction, type LedgerRow, type PaymentRow } from "./ledger";
import { sendReceiptEmail } from "./send-receipt";
import type { ReceiptCompany } from "./receipt";

export type AutoReceiptCompany = ReceiptCompany & Pick<Company, "auto_receipt">;

/**
 * Settings → Receipts → "Email a receipt automatically": the moment a payment
 * lands on an invoice, the dealership's AP contact gets the receipt. Off by
 * default. Every path that records an invoice payment calls this with the new
 * payment ids after the money is safely recorded; a failed email only logs and
 * never undoes the payment. A combined payment across several invoices goes
 * out as one receipt per AP address, listing every invoice it covered.
 */
export async function autoReceipt(supabase: SupabaseClient<Database>, company: AutoReceiptCompany, paymentIds: string[]): Promise<{ sentTo: string | null }> {
  if (!company.auto_receipt || paymentIds.length === 0) return { sentTo: null };
  try {
    const [{ data: rawPayments }, { data: rawLedger }] = await Promise.all([
      supabase.from("invoice_payments").select(`${PAYMENT_SELECT.replace("dealerships(name)", "dealerships(name, ap_emails)")}`).in("id", paymentIds),
      supabase.from("terminal_sales").select(LEDGER_SELECT).in("payment_id", paymentIds).eq("kind", "sale"),
    ]);
    const payments = (rawPayments ?? []) as unknown as (PaymentRow & { invoice: { dealership: { ap_emails: string[] } | null } | null })[];
    const ledger = (rawLedger ?? []) as unknown as LedgerRow[];

    const byEmail = new Map<string, { txs: TerminalTransaction[]; ledgerIds: string[] }>();
    for (const p of payments) {
      const to = p.invoice?.dealership?.ap_emails?.find((e) => e.includes("@"));
      if (!to) continue;
      const row = ledger.find((r) => r.payment_id === p.id);
      const entry = byEmail.get(to) ?? { txs: [], ledgerIds: [] };
      entry.txs.push(row ? toTransaction(row) : paymentToTransaction(p));
      if (row) entry.ledgerIds.push(row.id);
      byEmail.set(to, entry);
    }

    let sentTo: string | null = null;
    for (const [to, { txs, ledgerIds }] of byEmail) {
      const r = await sendReceiptEmail(txs[0], company, to, txs.length > 1 ? txs : null);
      if (!r.ok) {
        console.warn(`auto receipt to ${to}: ${r.error}`);
        continue;
      }
      sentTo = to;
      if (ledgerIds.length) await supabase.from("terminal_sales").update({ receipt_sent_at: new Date().toISOString(), customer_email: to }).in("id", ledgerIds);
    }
    return { sentTo };
  } catch (err) {
    console.warn(`auto receipt: ${err instanceof Error ? err.message : String(err)}`);
    return { sentTo: null };
  }
}
