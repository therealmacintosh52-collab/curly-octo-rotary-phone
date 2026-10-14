import "server-only";

import { Resend } from "resend";
import { escapeHtml } from "@/lib/invoices/email";
import { renderTemplate, templateFor, type Template, type TemplateKey } from "./templates";

export type RetailMailResult = { ok: true; messageId: string } | { ok: false; error: string; skipped?: boolean };

/** A one-off message to the shop itself (an approval landed). Same skip rule as the templates. */
export async function sendPlainRetailEmail(opts: { to: string; subject: string; body: string; companyName: string; refId?: string }): Promise<RetailMailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { ok: false, error: "Email is not configured (RESEND_API_KEY, EMAIL_FROM)", skipped: true };
  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({ from, to: [opts.to], subject: opts.subject, text: opts.body, html: retailEmailHtml(opts.body, opts.companyName), headers: opts.refId ? { "X-Entity-Ref-ID": opts.refId } : undefined });
    if (error || !data) return { ok: false, error: error?.message ?? "Email provider returned no message id" };
    return { ok: true, messageId: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Email failed" };
  }
}

/** The public URL of the app, for links in customer emails. */
export function appUrl(): string | null {
  const u = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return u ? u.replace(/\/$/, "") : null;
}

/** Plain, phone-friendly HTML around a template body (paragraphs from blank lines, links clickable). */
export function retailEmailHtml(body: string, companyName: string): string {
  const paras = body
    .split(/\n{2,}/)
    .map((p) => escapeHtml(p).replace(/\n/g, "<br>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#3f8f1f">$1</a>'))
    .map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.5">${p}</p>`)
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111827">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden">
  <tr><td style="background:#0b0d0f;padding:18px 28px;border-bottom:3px solid #82d955"><div style="font-size:18px;font-weight:700;color:#ffffff">${escapeHtml(companyName)}</div></td></tr>
  <tr><td style="padding:28px">${paras}</td></tr>
</table></td></tr></table></body></html>`;
}

/**
 * Send one of the shop's customer emails. Missing provider keys are a
 * skip, not an error: the app runs with zero paid keys and the send log
 * records that nothing went out.
 */
export async function sendRetailEmail(opts: {
  to: string | null | undefined;
  key: TemplateKey;
  templates: Partial<Record<string, Partial<Template>>> | null | undefined;
  vars: Record<string, string | number | null | undefined>;
  companyName: string;
  replyTo?: string | null;
  refId?: string;
  /** Extra text after the template's body (a single finding the advisor is sharing). */
  append?: string;
  /** Files to attach (the frozen signed PDF). */
  attachments?: { filename: string; content: Buffer }[];
}): Promise<RetailMailResult> {
  const to = opts.to?.trim();
  if (!to) return { ok: false, error: "No email on file", skipped: true };
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return { ok: false, error: "Email is not configured (RESEND_API_KEY, EMAIL_FROM)", skipped: true };
  const t = templateFor(opts.key, opts.templates);
  const subject = renderTemplate(t.subject, opts.vars);
  const body = renderTemplate(t.body, opts.vars) + (opts.append ? `\n\n${opts.append}` : "");
  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to: [to],
      replyTo: opts.replyTo ?? undefined,
      subject,
      text: body,
      html: retailEmailHtml(body, opts.companyName),
      headers: opts.refId ? { "X-Entity-Ref-ID": opts.refId } : undefined,
      attachments: opts.attachments?.map((a) => ({ filename: a.filename, content: a.content })),
    });
    if (error || !data) return { ok: false, error: error?.message ?? "Email provider returned no message id" };
    return { ok: true, messageId: data.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Email failed" };
  }
}
