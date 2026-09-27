import "server-only";

import { Resend } from "resend";
import type { TerminalTransaction } from "@/lib/db/types";
import { formatMoney } from "@/lib/money";
import { receiptHtml, receiptText, receiptTitle, type ReceiptCompany } from "./receipt";

/** Email a receipt. Same provider and env as invoice emails; a clear failure when not configured. */
export async function sendReceiptEmail(tx: TerminalTransaction, company: ReceiptCompany, to: string): Promise<{ ok: true; messageId: string } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { ok: false, error: "Email is not configured: set RESEND_API_KEY and EMAIL_FROM" };
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    replyTo: company.email ?? undefined,
    subject: `${receiptTitle(tx)} — ${company.name} — ${tx.kind === "refund" ? "-" : ""}${formatMoney(tx.amount)}`,
    html: receiptHtml(tx, company),
    text: receiptText(tx, company),
    headers: { "X-Entity-Ref-ID": tx.id },
  });
  if (error || !data) return { ok: false, error: error?.message ?? "Email provider returned no message id" };
  return { ok: true, messageId: data.id };
}
