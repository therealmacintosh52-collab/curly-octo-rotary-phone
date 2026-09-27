/**
 * Decide which invoice a Clover payment belongs to. Pure, so it is unit
 * tested without a database. Order of confidence:
 *   1. order   – the payment was taken against the Clover order we created for the invoice
 *   2. reference – the invoice number appears in the payment's reference or note
 *   3. amount  – exactly one open invoice has this exact balance (ties never match)
 * Anything else stays unmatched for the owner to assign.
 */
export type MatchedBy = "order" | "reference" | "amount";

export interface OpenInvoice {
  id: string;
  display_number: string;
  clover_order_id: string | null;
  /** total − amount_paid, in dollars */
  balance: number;
}

export interface IncomingPayment {
  amount: number;
  orderId: string | null;
  reference: string | null;
  note: string | null;
}

export function matchPayment(p: IncomingPayment, open: OpenInvoice[]): { invoiceId: string; matchedBy: MatchedBy } | null {
  if (p.orderId) {
    const byOrder = open.find((i) => i.clover_order_id === p.orderId);
    if (byOrder) return { invoiceId: byOrder.id, matchedBy: "order" };
  }
  const text = `${p.reference ?? ""} ${p.note ?? ""}`.toUpperCase();
  if (text.trim()) {
    const byRef = open.filter((i) => i.display_number && text.includes(i.display_number.toUpperCase()));
    if (byRef.length === 1) return { invoiceId: byRef[0].id, matchedBy: "reference" };
  }
  const cents = Math.round(p.amount * 100);
  const byAmount = open.filter((i) => Math.round(i.balance * 100) === cents && cents > 0);
  if (byAmount.length === 1) return { invoiceId: byAmount[0].id, matchedBy: "amount" };
  return null;
}
