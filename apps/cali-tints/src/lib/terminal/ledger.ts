import "server-only";

import type { InvoicePayment, TerminalSale, TerminalTransaction } from "@/lib/db/types";

/** A terminal_sales row with the invoice and dealership it belongs to. */
export type LedgerRow = TerminalSale & { invoice: { display_number: string; dealership: { name: string } | null } | null };
export const LEDGER_SELECT = "*, invoice:invoices(display_number, dealership:dealerships(name))";

/** An invoice_payments row with the invoice and dealership it belongs to. */
export type PaymentRow = InvoicePayment & { invoice: { display_number: string; dealership: { name: string } | null } | null };
export const PAYMENT_SELECT = "*, invoice:invoices(display_number, dealership:dealerships(name))";

export function toTransaction(row: LedgerRow): TerminalTransaction {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    amount: Number(row.amount),
    refunded_amount: Number(row.refunded_amount),
    method: row.method,
    source: row.source,
    invoice_id: row.invoice_id,
    invoice_number: row.invoice?.display_number ?? null,
    dealership: row.invoice?.dealership?.name ?? null,
    payment_id: row.payment_id,
    refund_of: row.refund_of,
    group_id: row.group_id,
    description: row.description,
    customer_name: row.customer_name,
    customer_email: row.customer_email,
    reference: row.reference,
    card_brand: row.card_brand,
    last4: row.last4,
    clover_payment_id: row.clover_payment_id,
    receipt_sent_at: row.receipt_sent_at,
    at: row.created_at,
  };
}

/** A payment recorded outside the Terminal (invoice page, pay link, Clover match), shaped like a ledger row so it gets the same receipt. */
export function paymentToTransaction(p: PaymentRow): TerminalTransaction {
  return {
    id: p.id,
    kind: "sale",
    status: "captured",
    amount: Number(p.amount),
    refunded_amount: 0,
    method: p.method,
    source: p.source,
    invoice_id: p.invoice_id,
    invoice_number: p.invoice?.display_number ?? null,
    dealership: p.invoice?.dealership?.name ?? null,
    payment_id: p.id,
    refund_of: null,
    group_id: null,
    description: p.note,
    customer_name: null,
    customer_email: null,
    reference: p.reference,
    card_brand: null,
    last4: null,
    clover_payment_id: p.clover_payment_id,
    receipt_sent_at: null,
    at: p.created_at,
  };
}
