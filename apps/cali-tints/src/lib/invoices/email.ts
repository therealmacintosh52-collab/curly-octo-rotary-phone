import "server-only";

import { Resend } from "resend";
import { formatMoney } from "@/lib/money";
import { formatDateOnly } from "@/lib/dates";
import { type InvoiceBundle, invoiceFileStem } from "./load";

export interface SendResult {
  ok: true;
  messageId: string;
  to: string[];
  cc: string[];
}
export interface SendFailure {
  ok: false;
  error: string;
  to: string[];
  cc: string[];
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch] as string);
}

/** Branded, table-based HTML that renders in Outlook/Gmail; dark header with the lime accent. */
export function invoiceEmailHtml(b: InvoiceBundle, appUrl: string | null): string {
  const { invoice, company, dealership } = b;
  const e = escapeHtml;
  const period = `${formatDateOnly(invoice.period_start)} – ${formatDateOnly(invoice.period_end)}`;
  return `<!doctype html>
<html><body style="margin:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
  <tr><td style="background:#0b0d0f;padding:22px 28px;border-bottom:3px solid #82d955">
    <div style="font-size:18px;font-weight:700;color:#ffffff">${e(company.name)}</div>
    <div style="font-size:12px;color:#9aa3ab;margin-top:2px">Invoice ${e(invoice.display_number)}</div>
  </td></tr>
  <tr><td style="padding:28px">
    <p style="margin:0 0 14px;font-size:15px">Hello${dealership.ap_contact_name ? " " + e(dealership.ap_contact_name) : ""},</p>
    <p style="margin:0 0 18px;font-size:14px;line-height:1.5">Please find attached invoice <strong>${e(invoice.display_number)}</strong> from ${e(company.name)} for detailing services provided to <strong>${e(dealership.name)}</strong>. A CSV of the line items is included for your accounting import.</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;font-size:14px">
      <tr><td style="padding:10px 14px;color:#6b7280;border-bottom:1px solid #e5e7eb">Invoice</td><td style="padding:10px 14px;text-align:right;border-bottom:1px solid #e5e7eb"><strong>${e(invoice.display_number)}</strong></td></tr>
      <tr><td style="padding:10px 14px;color:#6b7280;border-bottom:1px solid #e5e7eb">Service period</td><td style="padding:10px 14px;text-align:right;border-bottom:1px solid #e5e7eb">${e(period)}</td></tr>
      ${invoice.ro_po_number ? `<tr><td style="padding:10px 14px;color:#6b7280;border-bottom:1px solid #e5e7eb">RO / PO</td><td style="padding:10px 14px;text-align:right;border-bottom:1px solid #e5e7eb">${e(invoice.ro_po_number)}</td></tr>` : ""}
      <tr><td style="padding:10px 14px;color:#6b7280;border-bottom:1px solid #e5e7eb">Payment terms</td><td style="padding:10px 14px;text-align:right;border-bottom:1px solid #e5e7eb">${e(invoice.payment_terms)}</td></tr>
      <tr><td style="padding:12px 14px;font-weight:700">Total due</td><td style="padding:12px 14px;text-align:right;font-weight:700;font-size:18px">${formatMoney(invoice.total)}</td></tr>
    </table>
    <p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:#374151">Please reference <strong>${e(invoice.display_number)}</strong> on your remittance${company.email ? ` and send remittance advice to <a href="mailto:${e(company.email)}" style="color:#3f8f1f">${e(company.email)}</a>` : ""}. Reply to this email with any questions.</p>
    <p style="margin:22px 0 0;font-size:14px">Thank you,<br><strong>${e(company.name)}</strong>${company.phone ? `<br><span style="color:#6b7280">${e(company.phone)}</span>` : ""}</p>
  </td></tr>
  <tr><td style="padding:14px 28px;background:#f9fafb;font-size:11px;color:#9ca3af">${e(company.name)}${company.ein ? ` · EIN ${e(company.ein)}` : ""}${appUrl ? ` · Sent from ${e(appUrl.replace(/^https?:\/\//, ""))}` : ""}</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export function invoiceEmailText(b: InvoiceBundle): string {
  const { invoice, company, dealership } = b;
  return [
    `Invoice ${invoice.display_number} from ${company.name}`,
    ``,
    `Dealership: ${dealership.name}`,
    `Service period: ${formatDateOnly(invoice.period_start)} – ${formatDateOnly(invoice.period_end)}`,
    invoice.ro_po_number ? `RO/PO: ${invoice.ro_po_number}` : null,
    `Payment terms: ${invoice.payment_terms}`,
    `Total due: ${formatMoney(invoice.total)}`,
    ``,
    `The PDF invoice and a CSV of line items are attached. Please reference ${invoice.display_number} on remittance.`,
    ``,
    `Thank you,`,
    company.name,
  ]
    .filter((l) => l !== null)
    .join("\n");
}

/**
 * Email the invoice (PDF + CSV) to the dealership's AP addresses, CC the
 * company. Requires RESEND_API_KEY and EMAIL_FROM; returns a clear failure
 * otherwise so the caller can record it.
 */
export async function sendInvoiceEmail(b: InvoiceBundle, attachments: { pdf: Buffer; csv: string }): Promise<SendResult | SendFailure> {
  const to = b.dealership.ap_emails.map((e) => e.trim()).filter(Boolean);
  const cc = b.company.email ? [b.company.email] : [];
  if (to.length === 0) return { ok: false, error: `${b.dealership.name} has no AP email on file (Settings → Dealerships)`, to, cc };

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { ok: false, error: "Email is not configured: set RESEND_API_KEY and EMAIL_FROM", to, cc };

  const stem = invoiceFileStem(b);
  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to,
    cc: cc.length ? cc : undefined,
    replyTo: b.company.email ?? undefined,
    subject: `Invoice ${b.invoice.display_number} — ${b.company.name} — ${formatMoney(b.invoice.total)}`,
    html: invoiceEmailHtml(b, process.env.NEXT_PUBLIC_APP_URL ?? null),
    text: invoiceEmailText(b),
    attachments: [
      { filename: `${stem}.pdf`, content: attachments.pdf, contentType: "application/pdf" },
      { filename: `${stem}.csv`, content: Buffer.from(attachments.csv, "utf8"), contentType: "text/csv" },
    ],
    headers: { "X-Entity-Ref-ID": b.invoice.id },
  });
  if (error || !data) return { ok: false, error: error?.message ?? "Email provider returned no message id", to, cc };
  return { ok: true, messageId: data.id, to, cc };
}
