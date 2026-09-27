import "server-only";

import { CLOVER_HOSTS, CloverNotConfigured, cloverSecrets, type CloverEnv } from "./env";
import { getCredentials, markConnection } from "./connection";

/*
  Thin, typed wrappers over the three Clover surfaces we use. Every call
  throws CloverError with Clover's own message so the UI can show it.

  Credentials: the merchant's "Sign in with Clover" tokens when the company
  connected that way, else the manual tokens from the environment.
  Reliability: every request has a timeout, transient failures (network,
  429, 5xx) are retried with backoff, and an expired sign-in is flagged so
  the UI offers "Reconnect" instead of a cryptic error.

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
  /** Lets calls use the company's Clover sign-in and record connection health. */
  companyId?: string;
}

const DEFAULT_TIMEOUT_MS = 20_000;
const RETRY_DELAYS_MS = [400, 1200];

function retryable(status: number) {
  return status === 429 || status === 502 || status === 503 || status === 504;
}

async function call<T>(url: string, init: RequestInit & { token: string; ctx?: CloverContext; retry?: boolean; timeoutMs?: number }): Promise<T> {
  const { token, ctx, retry = true, timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init;
  const attempts = retry ? RETRY_DELAYS_MS.length + 1 : 1;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt - 1]));
    let res: Response;
    try {
      res = await fetch(url, {
        ...rest,
        headers: { accept: "application/json", "content-type": "application/json", authorization: `Bearer ${token}`, ...(rest.headers ?? {}) },
        cache: "no-store",
        signal: rest.signal ?? AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      lastErr = err;
      if (err instanceof Error && err.name === "AbortError" && rest.signal) throw err; // caller-owned abort (device wait)
      if (attempt < attempts - 1) continue;
      throw new CloverError("Could not reach Clover. Check the internet connection and try again.", 0, null);
    }
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (res.ok) {
      if (ctx?.companyId && attempt === 0) void markConnectionOk(ctx.companyId);
      return body as T;
    }
    if (retryable(res.status) && attempt < attempts - 1) {
      lastErr = new CloverError(errorText(body) ?? `Clover returned ${res.status}`, res.status, body);
      continue;
    }
    if ((res.status === 401 || res.status === 403) && ctx?.companyId && (await getCredentials(ctx.companyId))) {
      await markConnection(ctx.companyId, false, errorText(body) ?? `Clover returned ${res.status}`);
      throw new CloverError("Clover sign-in expired or was revoked. Settings → Clover → Reconnect.", res.status, body);
    }
    throw new CloverError(errorText(body) ?? `Clover returned ${res.status}`, res.status, body);
  }
  throw lastErr instanceof Error ? lastErr : new CloverError("Clover did not answer", 0, null);
}

// Health writes are throttled so a burst of calls is one DB update.
const lastOkWrite = new Map<string, number>();
async function markConnectionOk(companyId: string) {
  const now = Date.now();
  if ((lastOkWrite.get(companyId) ?? 0) > now - 60_000) return;
  lastOkWrite.set(companyId, now);
  try {
    await markConnection(companyId, true);
  } catch {
    /* health is best effort */
  }
}

/** Clover error bodies come as {message} or {error:{message}}. */
function errorText(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { message?: unknown; error?: { message?: unknown } };
  if (typeof b.message === "string") return b.message;
  if (b.error && typeof b.error.message === "string") return b.error.message;
  return null;
}

async function signedIn(ctx: CloverContext) {
  return ctx.companyId ? getCredentials(ctx.companyId) : null;
}
async function apiToken(ctx: CloverContext) {
  const creds = await signedIn(ctx);
  const t = creds?.accessToken ?? cloverSecrets().apiToken;
  if (!t) throw new CloverNotConfigured("orders and payments: sign in with Clover in Settings, or set CLOVER_API_TOKEN");
  return t;
}
async function ecomToken(ctx: CloverContext) {
  const creds = await signedIn(ctx);
  const t = creds?.accessToken ?? cloverSecrets().ecomPrivateToken;
  if (!t) throw new CloverNotConfigured("card payments: sign in with Clover in Settings, or set CLOVER_ECOM_PRIVATE_TOKEN");
  return t;
}
/** Public (PAKMS) key for the card iframe: from the sign-in, else the environment. */
export async function cloverPublicKey(ctx: CloverContext): Promise<string | null> {
  const creds = await signedIn(ctx);
  return creds?.pakmsKey ?? cloverSecrets().ecomPublicKey;
}

// --- Merchant -----------------------------------------------------------------

export interface CloverMerchant {
  id: string;
  name: string;
}

export async function getMerchant(ctx: CloverContext): Promise<CloverMerchant> {
  return call<CloverMerchant>(`${CLOVER_HOSTS[ctx.env].api}/v3/merchants/${ctx.merchantId}`, { token: await apiToken(ctx), ctx });
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
    token: await apiToken(ctx),
    ctx,
    body: JSON.stringify({ title: order.title, note: order.note ?? "", state: "open", manualTransaction: true, total: order.items.reduce((s, i) => s + i.priceCents, 0) }),
  });
  if (order.items.length) {
    await call<unknown>(`${base}/orders/${created.id}/bulk_line_items`, {
      method: "POST",
      token: await apiToken(ctx),
    ctx,
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
    const page = await call<{ elements?: CloverPayment[] }>(url, { token: await apiToken(ctx), ctx });
    const els = page.elements ?? [];
    out.push(...els);
    if (els.length < limit) break;
  }
  return out;
}

export async function getPayment(ctx: CloverContext, id: string): Promise<CloverPayment> {
  return call<CloverPayment>(`${CLOVER_HOSTS[ctx.env].api}/v3/merchants/${ctx.merchantId}/payments/${id}?expand=cardTransaction`, { token: await apiToken(ctx), ctx });
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
    token: await ecomToken(ctx),
    ctx,
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
    token: await ecomToken(ctx),
    ctx,
    headers: { "X-Clover-Merchant-Id": ctx.merchantId },
    body: JSON.stringify({
      customer: input.customer,
      shoppingCart: { lineItems: input.items.map((i) => ({ name: i.name, price: i.priceCents, unitQty: 1, note: i.note ?? "" })) },
      ...(input.redirectUrls ? { redirectUrls: input.redirectUrls } : {}),
    }),
  });
}

export interface CloverRefund {
  id: string;
  amount?: number;
  status?: string;
  failure_message?: string;
}

/*
  Refund endpoints. Both are used only from the Terminal tab; the paths live
  here so a sandbox correction is a one-line change.
    REST: refund (part of) a payment taken on the device / register.
    Ecom: refund (part of) a card-not-present charge made with createCharge.
*/
const REST_REFUND_PATH = (ctx: CloverContext) => `${CLOVER_HOSTS[ctx.env].api}/v3/merchants/${ctx.merchantId}/refunds`;
const ECOM_REFUND_PATH = (ctx: CloverContext) => `${CLOVER_HOSTS[ctx.env].ecom}/v1/refunds`;

/** Refund part or all of a payment taken on the terminal (REST Pay Display / register). */
export async function refundPayment(ctx: CloverContext, input: { paymentId: string; amountCents: number }): Promise<CloverRefund> {
  return call<CloverRefund>(REST_REFUND_PATH(ctx), {
    method: "POST",
    token: await apiToken(ctx),
    ctx,
    body: JSON.stringify({ payment: { id: input.paymentId }, amount: input.amountCents }),
  });
}

/** Refund part or all of a card charge made through the Ecommerce API. */
export async function refundCharge(ctx: CloverContext, input: { chargeId: string; amountCents: number; idempotencyKey: string }): Promise<CloverRefund> {
  return call<CloverRefund>(ECOM_REFUND_PATH(ctx), {
    method: "POST",
    token: await ecomToken(ctx),
    ctx,
    headers: { "idempotency-key": input.idempotencyKey },
    body: JSON.stringify({ charge: input.chargeId, amount: input.amountCents }),
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

/** Pages that call payOnDevice set `maxDuration = 60`; give up before the function does. */
const DEVICE_WAIT_MS = 55_000;

/**
 * Ask the Clover terminal to take a payment. The call stays open while the
 * customer taps or inserts a card, so callers run it from a page with a
 * raised maxDuration (see DEVICE_WAIT_MS).
 */
export async function payOnDevice(ctx: CloverContext, device: DeviceTarget, input: { amountCents: number; externalPaymentId: string; externalReferenceId: string }): Promise<DevicePaymentResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEVICE_WAIT_MS);
  try {
    return await call<DevicePaymentResult>(`${CLOVER_HOSTS[ctx.env].api}/connect/v1/payments`, {
      method: "POST",
      token: await apiToken(ctx),
    ctx,
      retry: false,
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
    token: await apiToken(ctx),
    ctx,
    headers: { "X-Clover-Device-Id": device.deviceId, "X-POS-ID": device.posId },
    body: "{}",
  });
}
