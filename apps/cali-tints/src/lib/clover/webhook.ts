/**
 * Hosted-checkout webhook parsing. Clover's payloads vary by version, so
 * the session id and the status are read defensively; only a paid status
 * marks the deposit paid. The shared secret is checked in constant time.
 * Source: https://docs.clover.com/dev/docs/hosted-checkout-api (webhooks)
 */
type Loose = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/** The secret may arrive as `?secret=`, `x-clover-auth` or `Authorization: Bearer`. */
export function webhookAuthorized(secret: string, given: { query: string | null; header: string | null; bearer: string | null }): boolean {
  return [given.query, given.header, given.bearer].some((g) => !!g && constantTimeEqual(g, secret));
}

export interface WebhookEvent {
  verificationCode: string | null;
  checkoutSessionId: string | null;
  status: "paid" | "failed" | "other";
  rawStatus: string | null;
  paymentId: string | null;
  amountCents: number | null;
}

export function parseWebhook(body: unknown): WebhookEvent {
  const b = (body ?? {}) as Loose;
  const data = ((b.data as Loose | undefined) ?? b) as Loose;
  const sessionId = str(data.checkoutSessionId) ?? str(data.checkoutSession) ?? str((data.checkout as Loose | undefined)?.id) ?? str(b.checkoutSessionId);
  const rawStatus = str(data.status) ?? str(data.paymentStatus) ?? str((data.payment as Loose | undefined)?.status) ?? null;
  const up = (rawStatus ?? "").toUpperCase();
  const status: WebhookEvent["status"] = /PAID|SUCCESS|APPROVED|COMPLETE/.test(up) ? "paid" : /FAIL|DECLIN|ERROR|CANCEL/.test(up) ? "failed" : "other";
  const payment = (Array.isArray(data.payments) ? (data.payments as Loose[])[0] : (data.payment as Loose | undefined)) ?? null;
  return {
    verificationCode: str(b.verificationCode),
    checkoutSessionId: sessionId,
    status,
    rawStatus,
    paymentId: str(payment?.id) ?? str(data.paymentId) ?? str(data.id),
    amountCents: num(payment?.amount) ?? num(data.amount),
  };
}
