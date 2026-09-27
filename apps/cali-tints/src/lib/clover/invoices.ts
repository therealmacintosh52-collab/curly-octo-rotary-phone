import "server-only";

import type { Company } from "@/lib/db/types";
import type { InvoiceBundle } from "@/lib/invoices/load";
import { createCheckout, createOrder, type CloverContext } from "./client";
import { toCents } from "./money";

/** Context for API calls from the company's stored settings; null when Clover is off or unconfigured. */
export function cloverContext(company: Pick<Company, "clover_enabled" | "clover_env" | "clover_merchant_id">): CloverContext | null {
  if (!company.clover_enabled || !company.clover_merchant_id) return null;
  return { env: company.clover_env, merchantId: company.clover_merchant_id };
}

/** Line items as Clover sees them: one per invoice line, price in cents, tag in the note. */
export function invoiceLineItems(b: InvoiceBundle): { name: string; priceCents: number; note: string }[] {
  const items = b.items.map((it) => ({
    name: `${it.service_name} · ${it.tag_number}`,
    priceCents: toCents(it.price),
    note: [it.year, it.make, it.model].filter(Boolean).join(" "),
  }));
  if (Number(b.invoice.tax) > 0) items.push({ name: "Sales tax", priceCents: toCents(b.invoice.tax), note: "" });
  return items;
}

/** Mirror the invoice as an open Clover order. Returns the Clover order id. */
export async function pushInvoiceOrder(ctx: CloverContext, b: InvoiceBundle): Promise<string> {
  const order = await createOrder(ctx, {
    title: `${b.invoice.display_number} · ${b.dealership.name}`,
    note: `Invoice ${b.invoice.display_number} · ${b.dealership.name} · ${b.invoice.period_start} to ${b.invoice.period_end}`,
    items: invoiceLineItems(b),
  });
  return order.id;
}

/** Hosted checkout for the open balance (one line, so partial payments and tax stay simple). */
export async function createInvoiceCheckout(ctx: CloverContext, b: InvoiceBundle, appUrl: string | null): Promise<{ sessionId: string; url: string; expiresAt: string | null }> {
  const balance = Number(b.invoice.total) - Number(b.invoice.amount_paid);
  const [firstName, ...rest] = (b.dealership.ap_contact_name ?? b.dealership.name).split(" ");
  const session = await createCheckout(ctx, {
    customer: { email: b.dealership.ap_emails[0], firstName, lastName: rest.join(" ") || undefined },
    items: [{ name: `Invoice ${b.invoice.display_number} · ${b.company.name}`, priceCents: toCents(balance), note: `${b.dealership.name} · ${b.invoice.period_start} to ${b.invoice.period_end}` }],
    redirectUrls: appUrl ? { success: `${appUrl}/pay/done?ok=1&inv=${encodeURIComponent(b.invoice.display_number)}`, failure: `${appUrl}/pay/done?ok=0`, cancel: `${appUrl}/pay/done?ok=0` } : undefined,
  });
  return { sessionId: session.checkoutSessionId, url: session.href, expiresAt: session.expirationTime ? new Date(session.expirationTime).toISOString() : null };
}
