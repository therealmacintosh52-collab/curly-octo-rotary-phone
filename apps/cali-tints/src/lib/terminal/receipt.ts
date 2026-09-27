import type { Company, PaymentMethod, TerminalTransaction } from "@/lib/db/types";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";

/*
  Receipt content for a Terminal transaction. Pure functions (no server-only
  imports) so the same text renders in the email, the print view and tests.
*/

export const METHOD_LABELS: Record<PaymentMethod, string> = { card: "Card", cash: "Cash", check: "Check", ach: "ACH / wire", other: "Other" };

export type ReceiptCompany = Pick<Company, "name" | "email" | "phone" | "address_line1" | "address_line2" | "city" | "state" | "postal_code">;

function esc(s: string) {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] as string);
}

/** Short human id for a ledger row, printed on receipts: TX-8 hex chars. */
export function receiptNumber(tx: Pick<TerminalTransaction, "id">): string {
  return `TX-${tx.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function paidWith(tx: Pick<TerminalTransaction, "method" | "card_brand" | "last4">): string {
  if (tx.method === "card") return [tx.card_brand ?? "Card", tx.last4 ? `····${tx.last4}` : null].filter(Boolean).join(" ");
  return METHOD_LABELS[tx.method];
}

export function receiptTitle(tx: Pick<TerminalTransaction, "kind">): string {
  return tx.kind === "refund" ? "Refund receipt" : "Receipt";
}

/** What the receipt is for: the invoice, or the quick-sale description. */
/** The sale rows of one combined payment (several invoices, one tap). */
export type ReceiptGroup = Pick<TerminalTransaction, "id" | "kind" | "invoice_number" | "dealership" | "amount" | "status" | "refunded_amount">[];

export function groupSales(group: ReceiptGroup | null | undefined): ReceiptGroup {
  return (group ?? []).filter((g) => g.kind === "sale");
}

/** What a receipt is worth: the row's amount, or the whole group's. */
export function receiptTotal(tx: Pick<TerminalTransaction, "amount">, group?: ReceiptGroup | null): number {
  const sales = groupSales(group);
  return sales.length > 1 ? sales.reduce((s, g) => s + Number(g.amount), 0) : Number(tx.amount);
}

export function receiptSubject(tx: Pick<TerminalTransaction, "invoice_number" | "dealership" | "description">, group?: ReceiptGroup | null): string {
  const sales = groupSales(group);
  if (sales.length > 1) {
    const dealers = [...new Set(sales.map((g) => g.dealership).filter(Boolean))];
    return `${sales.length} invoices${dealers.length === 1 ? ` · ${dealers[0]}` : dealers.length > 1 ? ` · ${dealers.length} dealerships` : ""}`;
  }
  if (tx.invoice_number) return `Invoice ${tx.invoice_number}${tx.dealership ? ` · ${tx.dealership}` : ""}`;
  return tx.description ?? "Detailing services";
}

export function companyAddress(c: ReceiptCompany): string {
  return [c.address_line1, c.address_line2, [c.city, c.state].filter(Boolean).join(", ") + (c.postal_code ? ` ${c.postal_code}` : "")].filter((x) => x && x.trim()).join(" · ");
}

export function receiptLines(tx: TerminalTransaction, c: ReceiptCompany, group?: ReceiptGroup | null): { label: string; value: string }[] {
  const sales = groupSales(group);
  const lines: { label: string; value: string }[] = [
    { label: "Receipt", value: receiptNumber(tx) },
    { label: "Date", value: formatDateTime(tx.at) },
    { label: "For", value: receiptSubject(tx, group) },
    { label: tx.kind === "refund" ? "Refunded to" : "Paid with", value: paidWith(tx) },
  ];
  if (tx.reference && tx.method !== "card") lines.push({ label: "Reference", value: tx.reference });
  if (tx.customer_name) lines.push({ label: "Customer", value: tx.customer_name });
  if (sales.length > 1) {
    for (const g of sales) lines.push({ label: `Invoice ${g.invoice_number ?? "—"}`, value: formatMoney(g.amount) });
    const refunded = sales.reduce((s, g) => s + Number(g.refunded_amount), 0);
    if (refunded > 0) lines.push({ label: "Refunded since", value: `-${formatMoney(refunded)}` });
  } else if (tx.kind === "sale" && Number(tx.refunded_amount) > 0) lines.push({ label: "Refunded since", value: `-${formatMoney(tx.refunded_amount)}` });
  void c;
  return lines;
}

export function receiptText(tx: TerminalTransaction, c: ReceiptCompany, group?: ReceiptGroup | null): string {
  const amount = `${tx.kind === "refund" ? "-" : ""}${formatMoney(receiptTotal(tx, group))}`;
  return [
    `${c.name} — ${receiptTitle(tx)}`,
    companyAddress(c),
    c.phone ?? null,
    ``,
    ...receiptLines(tx, c, group).map((l) => `${l.label}: ${l.value}`),
    ``,
    `${tx.kind === "refund" ? "Refund" : "Total"}: ${amount}`,
    ``,
    tx.kind === "refund" ? `Refunds to a card take 5–10 business days to appear.` : `Thank you for your business.`,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

/** Table-based HTML that renders in Outlook/Gmail; same header as the invoice email. */
export function receiptHtml(tx: TerminalTransaction, c: ReceiptCompany, group?: ReceiptGroup | null): string {
  const amount = `${tx.kind === "refund" ? "-" : ""}${formatMoney(receiptTotal(tx, group))}`;
  const rows = receiptLines(tx, c, group)
    .map((l) => `<tr><td style="padding:9px 14px;color:#6b7280;border-bottom:1px solid #e5e7eb">${esc(l.label)}</td><td style="padding:9px 14px;text-align:right;border-bottom:1px solid #e5e7eb">${esc(l.value)}</td></tr>`)
    .join("");
  return `<!doctype html>
<html><body style="margin:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden">
  <tr><td style="background:#0b0d0f;padding:22px 28px;border-bottom:3px solid #82d955">
    <div style="font-size:18px;font-weight:700;color:#ffffff">${esc(c.name)}</div>
    <div style="font-size:12px;color:#9aa3ab;margin-top:2px">${esc(receiptTitle(tx))} · ${esc(receiptNumber(tx))}</div>
  </td></tr>
  <tr><td style="padding:24px 28px">
    <div style="font-size:30px;font-weight:700;letter-spacing:-0.01em;margin-bottom:16px">${esc(amount)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;font-size:14px">${rows}</table>
    <p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#374151">${tx.kind === "refund" ? "Refunds to a card take 5–10 business days to appear." : "Thank you for your business."}${c.email ? ` Questions: <a href="mailto:${esc(c.email)}" style="color:#3f8f1f">${esc(c.email)}</a>` : ""}</p>
  </td></tr>
  <tr><td style="padding:14px 28px;background:#f9fafb;font-size:11px;color:#9ca3af">${esc(c.name)}${companyAddress(c) ? ` · ${esc(companyAddress(c))}` : ""}${c.phone ? ` · ${esc(c.phone)}` : ""}</td></tr>
</table>
</td></tr></table>
</body></html>`;
}
