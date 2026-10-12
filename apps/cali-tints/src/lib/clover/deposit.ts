import "server-only";

import type { DepositStart } from "@/lib/db/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { appUrl } from "@/lib/retail/email";
import { cloverConfig, depositsOnline } from "./env";
import { checkoutBody, checkoutHeaders, checkoutUrl, parseCheckoutResponse } from "./checkout";

export type DepositLink = { ok: true; url: string; expiresAt: string | null } | { ok: false; error: string };

/**
 * Make the Clover hosted checkout session for a pending deposit row and
 * remember its id on the row. Called the moment the customer taps Pay (the
 * session lives 15 minutes). Never called when DEPOSITS_ONLINE is off.
 */
export async function createDepositLink(start: DepositStart, returnTo: string): Promise<DepositLink> {
  if (!depositsOnline()) return { ok: false, error: "Online deposits are not turned on; the shop takes the deposit at drop-off" };
  const c = cloverConfig();
  const base = appUrl() ?? "";
  const sep = returnTo.includes("?") ? "&" : "?";
  let body: Record<string, unknown>;
  try {
    body = checkoutBody({
      amountCents: start.amount_cents,
      name: `Deposit · ${start.display_number}`,
      note: start.vehicle ?? undefined,
      customer: { firstName: start.customer.first_name, lastName: start.customer.last_name, email: start.customer.email, phoneNumber: start.customer.phone },
      redirect: { success: `${base}${returnTo}${sep}paid=1`, failure: `${base}${returnTo}${sep}failed=1`, cancel: `${base}${returnTo}` },
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not build the payment" };
  }
  let res: Response;
  try {
    res = await fetch(checkoutUrl(c.env), { method: "POST", headers: checkoutHeaders(c.ecomPrivateKey!, c.merchantId!), body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(20_000) });
  } catch {
    return { ok: false, error: "Could not reach Clover; try again in a moment" };
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { message: text };
  }
  if (!res.ok) return { ok: false, error: `Clover refused the payment link (${res.status})` };
  let session;
  try {
    session = parseCheckoutResponse(json);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Clover did not return a payment link" };
  }
  const db = createAdminClient();
  const { error } = await db.rpc("attach_checkout_session", { p_payment: start.payment_id, p_session_id: session.checkoutSessionId, p_raw: { href: session.href, expirationTime: session.expirationTime ?? null } });
  if (error) return { ok: false, error: error.message };
  return { ok: true, url: session.href, expiresAt: session.expirationTime ? new Date(session.expirationTime).toISOString() : null };
}
