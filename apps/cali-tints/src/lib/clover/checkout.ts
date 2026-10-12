import { CLOVER_HOSTS, type CloverEnv } from "./env";

/**
 * Pure builders for the hosted checkout request so they can be unit-tested
 * without a key; the server action around them does the fetch.
 * Source: https://docs.clover.com/dev/docs/creating-a-hosted-checkout-session
 */
export interface CheckoutInput {
  amountCents: number;
  name: string;
  note?: string;
  customer: { firstName?: string | null; lastName?: string | null; email?: string | null; phoneNumber?: string | null };
  redirect: { success: string; failure: string; cancel: string };
}

export interface CheckoutSession {
  href: string;
  checkoutSessionId: string;
  createdTime?: number;
  expirationTime?: number;
}

export function checkoutUrl(env: CloverEnv): string {
  return `${CLOVER_HOSTS[env].ecom}/invoicingcheckoutservice/v1/checkouts`;
}

export function checkoutBody(input: CheckoutInput): Record<string, unknown> {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) throw new Error("Amount must be a positive number of cents");
  const customer: Record<string, string> = {};
  if (input.customer.firstName) customer.firstName = input.customer.firstName.slice(0, 60);
  if (input.customer.lastName) customer.lastName = input.customer.lastName.slice(0, 60);
  if (input.customer.email) customer.email = input.customer.email.slice(0, 120);
  if (input.customer.phoneNumber) customer.phoneNumber = input.customer.phoneNumber.replace(/[^\d+]/g, "").slice(0, 20);
  return {
    customer,
    shoppingCart: { lineItems: [{ name: input.name.slice(0, 120), price: input.amountCents, unitQty: 1, note: (input.note ?? "").slice(0, 200) }] },
    redirectUrls: input.redirect,
  };
}

export function checkoutHeaders(privateKey: string, merchantId: string): Record<string, string> {
  return { accept: "application/json", "content-type": "application/json", authorization: `Bearer ${privateKey}`, "X-Clover-Merchant-Id": merchantId };
}

/** Pulls the fields we rely on out of Clover's response; throws on anything that is not a session. */
export function parseCheckoutResponse(body: unknown): CheckoutSession {
  const b = (body ?? {}) as Record<string, unknown>;
  const href = typeof b.href === "string" ? b.href : null;
  const id = typeof b.checkoutSessionId === "string" ? b.checkoutSessionId : null;
  if (!href || !id) throw new Error(typeof b.message === "string" ? b.message : "Clover did not return a checkout session");
  return { href, checkoutSessionId: id, createdTime: typeof b.createdTime === "number" ? b.createdTime : undefined, expirationTime: typeof b.expirationTime === "number" ? b.expirationTime : undefined };
}
