import "server-only";

import { CLOVER_HOSTS, CloverNotConfigured, cloverSecrets, type CloverEnv } from "./env";

/*
  Thin, typed wrappers over the three Clover surfaces we use. Every call
  throws CloverError with Clover's own message so the UI can show it.

  Endpoint shapes follow Clover's public docs; the first sandbox run against
  the owner's test merchant is the source of truth if anything differs.
*/

export class CloverError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = "CloverError";
  }
}

export interface CloverContext {
  env: CloverEnv;
  merchantId: string;
}

async function call<T>(url: string, init: RequestInit & { token: string }): Promise<T> {
  const { token, ...rest } = init;
  const res = await fetch(url, {
    ...rest,
    headers: { accept: "application/json", "content-type": "application/json", authorization: `Bearer ${token}`, ...(rest.headers ?? {}) },
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new CloverError(errorText(body) ?? `Clover returned ${res.status}`, res.status, body);
  }
  return body as T;
}

/** Clover error bodies come as {message} or {error:{message}}. */
function errorText(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { message?: unknown; error?: { message?: unknown } };
  if (typeof b.message === "string") return b.message;
  if (b.error && typeof b.error.message === "string") return b.error.message;
  return null;
}

function apiToken() {
  const t = cloverSecrets().apiToken;
  if (!t) throw new CloverNotConfigured("orders and payment sync (CLOVER_API_TOKEN)");
  return t;
}
function ecomToken() {
  const t = cloverSecrets().ecomPrivateToken;
  if (!t) throw new CloverNotConfigured("card payments (CLOVER_ECOM_PRIVATE_TOKEN)");
  return t;
}

// --- Merchant -----------------------------------------------------------------

export interface CloverMerchant {
  id: string;
  name: string;
}

export async function getMerchant(ctx: CloverContext): Promise<CloverMerchant> {
  return call<CloverMerchant>(`${CLOVER_HOSTS[ctx.env].api}/v3/merchants/${ctx.merchantId}`, { token: apiToken() });
}

// --- Orders -------------------------------------------------------------------

export interface CloverOrder {
  id: string;
  total?: number;
  state?: string;
}

/**
 * Create an open order with custom (ad-hoc) line items so the invoice shows
 * up in the Clover register and reports. Custom items are not accepted by
 * the atomic endpoint, so this is two calls.
 */
export async function createOrder(ctx: CloverContext, order: { title: string; note?: string; items: { name: string; priceCents: number; note?: string }[] }): Promise<CloverOrder> {
  const base = `${CLOVER_HOSTS[ctx.env].api}/v3/merchants/${ctx.merchantId}`;
  const created = await call<CloverOrder>(`${base}/orders`, {
    method: "POST",
    token: apiToken(),
    body: JSON.stringify({ title: order.title, note: order.note ?? "", state: "open", manualTransaction: true, total: order.items.reduce((s, i) => s + i.priceCents, 0) }),
  });
  if (order.items.length) {
    await call<unknown>(`${base}/orders/${created.id}/bulk_line_items`, {
      method: "POST",
      token: apiToken(),
      body: JSON.stringify({ items: order.items.map((i) => ({ name: i.name, price: i.priceCents, note: i.note ?? "", printed: false })) }),
    });
  }
  return created;
}

// --- Payments -----------------------------------------------------------------

export interface CloverPayment {
  id: string;
  amount: number; // cents
  tipAmount?: number;
  result?: string; // SUCCESS | FAILED | ...
  createdTime: number; // ms
  order?: { id: string };
  externalReferenceId?: string;
  note?: string;
  cardTransaction?: { cardType?: string; last4?: string; type?: string };
}

/** Payments created after `sinceMs`, newest last. Handles Clover's paging. */
export async function listPaymentsSince(ctx: CloverContext, sinceMs: number): Promise<CloverPayment[]> {
  const base = `${CLOVER_HOSTS[ctx.env].api}/v3/merchants/${ctx.merchantId}`;
  const out: CloverPayment[] = [];
  const limit = 100;
  for (let offset = 0; offset < 5000; offset += limit) {
    const url = `${base}/payments?filter=${encodeURIComponent(`createdTime>=${sinceMs}`)}&expand=cardTransaction&orderBy=createdTime%20ASC&limit=${limit}&offset=${offset}`;
    const page = await call<{ elements?: CloverPayment[] }>(url, { token: apiToken() });
    const els = page.elements ?? [];
    out.push(...els);
    if (els.length < limit) break;
  }
  return out;
}

export async function getPayment(ctx: CloverContext, id: string): Promise<CloverPayment> {
  return call<CloverPayment>(`${CLOVER_HOSTS[ctx.env].api}/v3/merchants/${ctx.merchantId}/payments/${id}?expand=cardTransaction`, { token: apiToken() });
}

// --- Ecommerce: charges and hosted checkout ------------------------------------

export interface CloverCharge {
  id: string;
  amount: number;
  status: string; // succeeded | failed | ...
  source?: { brand?: string; last4?: string };
  failure_message?: string;
}

/** Charge a single-use card token (clv_…) produced by the Clover iframe. */
export async function createCharge(ctx: CloverContext, input: { amountCents: number; source: string; description: string; externalReferenceId: string; idempotencyKey: string }): Promise<CloverCharge> {
  return call<CloverCharge>(`${CLOVER_HOSTS[ctx.env].ecom}/v1/charges`, {
    method: "POST",
    token: ecomToken(),
    headers: { "idempotency-key": input.idempotencyKey },
    body: JSON.stringify({
      amount: input.amountCents,
      currency: "usd",
      source: input.source,
      capture: true,
      description: input.description,
      external_reference_id: input.externalReferenceId,
      ecomind: "ecom",
    }),
  });
}

export interface CloverCheckoutSession {
  href: string;
  checkoutSessionId: string;
  createdTime?: number;
  expirationTime?: number;
}

/** Hosted checkout page for one invoice; the dealership pays on Clover's page. */
export async function createCheckout(ctx: CloverContext, input: { customer: { email?: string; firstName?: string; lastName?: string }; items: { name: string; priceCents: number; note?: string }[]; redirectUrls?: { success: string; failure: string; cancel: string } }): Promise<CloverCheckoutSession> {
  return call<CloverCheckoutSession>(`${CLOVER_HOSTS[ctx.env].ecom}/invoicingcheckoutservice/v1/checkouts`, {
    method: "POST",
    token: ecomToken(),
    headers: { "X-Clover-Merchant-Id": ctx.merchantId },
    body: JSON.stringify({
      customer: input.customer,
      shoppingCart: { lineItems: input.items.map((i) => ({ name: i.name, price: i.priceCents, unitQty: 1, note: i.note ?? "" })) },
      ...(input.redirectUrls ? { redirectUrls: input.redirectUrls } : {}),
    }),
  });
}

/** Deep link into the merchant dashboard for an order. */
export function orderDashboardUrl(ctx: CloverContext, orderId: string): string {
  return `${CLOVER_HOSTS[ctx.env].dashboard}/orders/m/${ctx.merchantId}/${orderId}`;
}

// --- Device: REST Pay Display (Cloud Pay Display app on the terminal) ---------

export interface DeviceTarget {
  deviceId: string; // device serial number
  posId: string;    // shown on the device while the request is active
}

export interface DevicePaymentResult {
  payment?: CloverPayment & { externalPaymentId?: string };
  error?: { message?: string } | string;
  message?: string;
}

/**
 * Ask the Clover terminal to take a payment. The call stays open while the
 * customer taps or inserts a card (Clover caps this around 90 s), so callers
 * run it from a route/action with a raised maxDuration.
 */
export async function payOnDevice(ctx: CloverContext, device: DeviceTarget, input: { amountCents: number; externalPaymentId: string; externalReferenceId: string }): Promise<DevicePaymentResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 85_000);
  try {
    return await call<DevicePaymentResult>(`${CLOVER_HOSTS[ctx.env].api}/connect/v1/payments`, {
      method: "POST",
      token: apiToken(),
      headers: { "X-Clover-Device-Id": device.deviceId, "X-POS-ID": device.posId, "Idempotency-Key": input.externalPaymentId },
      body: JSON.stringify({
        amount: input.amountCents,
        final: true,
        capture: true,
        externalPaymentId: input.externalPaymentId,
        externalReferenceId: input.externalReferenceId,
        tipMode: "NO_TIP",
        signatureEntryLocation: "NONE",
        receiptOptions: { deliveryMode: "ON_DEVICE" },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") throw new CloverError("The terminal did not answer in time. Cancel on the device and try again.", 504, null);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Cancel whatever the terminal is currently prompting for. */
export async function cancelDevice(ctx: CloverContext, device: DeviceTarget): Promise<void> {
  await call<unknown>(`${CLOVER_HOSTS[ctx.env].api}/connect/v1/device/cancel`, {
    method: "POST",
    token: apiToken(),
    headers: { "X-Clover-Device-Id": device.deviceId, "X-POS-ID": device.posId },
    body: "{}",
  });
}
