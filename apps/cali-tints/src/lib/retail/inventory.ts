import type { InventoryItem, PartOrder, PartOrderLine } from "@/lib/db/types";

export type StockTone = "ok" | "low" | "out" | "negative";

/** "5 in stock", "Low: 1 left (reorder at 2)", "Out of stock", "Count is negative (-1)": what the stock chip says, and its tone. */
export function stockLabel(i: Pick<InventoryItem, "qty_on_hand" | "reorder_at">): { text: string; tone: StockTone } {
  const q = Number(i.qty_on_hand);
  const n = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/0+$/, "").replace(/\.$/, ""));
  if (q < 0) return { text: `Count is negative (${n(q)})`, tone: "negative" };
  if (q === 0) return { text: "Out of stock", tone: "out" };
  if (i.reorder_at !== null && i.reorder_at !== undefined && q <= Number(i.reorder_at)) return { text: `Low: ${n(q)} left (reorder at ${n(Number(i.reorder_at))})`, tone: "low" };
  return { text: `${n(q)} in stock`, tone: "ok" };
}

/** What is still to arrive on a line. */
export const remaining = (l: Pick<PartOrderLine, "qty" | "received_qty">) => Math.max(Number(l.qty) - Number(l.received_qty), 0);

/** The receive screen starts with everything still outstanding filled in (one tap "Receive all"). */
export function receiveDefaults(o: Pick<PartOrder, "lines">): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of o.lines ?? []) if (remaining(l) > 0) out[l.id] = remaining(l);
  return out;
}

/** The lines the user typed → the payload (blank, zero and unknown lines dropped; never more than is outstanding). */
export function receivePayload(o: Pick<PartOrder, "lines">, typed: Record<string, number | string>): { line_id: string; qty: number }[] {
  const out: { line_id: string; qty: number }[] = [];
  for (const l of o.lines ?? []) {
    const qty = Math.min(Number(typed[l.id] ?? 0), remaining(l));
    if (qty > 0) out.push({ line_id: l.id, qty: Math.round(qty * 100) / 100 });
  }
  return out;
}

export const ORDER_STATUS_LABEL: Record<PartOrder["status"], string> = { draft: "Draft", ordered: "Ordered", received: "Received", cancelled: "Cancelled" };

/** The list price a stocked part suggests on an estimate: its list price, else cost + the shop markup, else nothing. */
export function suggestedPrice(i: Pick<InventoryItem, "list_price" | "cost">, markupPct: number | null | undefined): number | null {
  if (i.list_price !== null && i.list_price !== undefined) return Number(i.list_price);
  if (i.cost !== null && i.cost !== undefined && markupPct !== null && markupPct !== undefined) return Math.round(Number(i.cost) * (1 + markupPct / 100) * 100) / 100;
  return null;
}
