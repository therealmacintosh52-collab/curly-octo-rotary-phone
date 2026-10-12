import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cloverConfig } from "@/lib/clover/env";
import { parseWebhook, webhookAuthorized } from "@/lib/clover/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/clover/webhook — the hosted checkout result. Configure the URL in
 * the Clover merchant dashboard with `?secret=<CLOVER_WEBHOOK_SECRET>` (the
 * same value is accepted in an `x-clover-auth` or `Authorization: Bearer`
 * header). This is the system of record for a paid deposit: the row flips
 * to paid and the booking confirms itself, idempotently.
 * Source: https://docs.clover.com/dev/docs/hosted-checkout-api
 */
export async function POST(req: NextRequest) {
  const { webhookSecret } = cloverConfig();
  if (!webhookSecret) return NextResponse.json({ error: "CLOVER_WEBHOOK_SECRET is not set" }, { status: 500 });
  const ok = webhookAuthorized(webhookSecret, { query: req.nextUrl.searchParams.get("secret"), header: req.headers.get("x-clover-auth"), bearer: req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null });
  if (!ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const ev = parseWebhook(body);
  // Clover's verification handshake echoes the code back.
  if (ev.verificationCode) return NextResponse.json({ verificationCode: ev.verificationCode });
  if (!ev.checkoutSessionId) return NextResponse.json({ ok: true, ignored: "no checkoutSessionId" });
  if (ev.status === "other") return NextResponse.json({ ok: true, ignored: `status ${ev.rawStatus ?? "unknown"}` });

  const db = createAdminClient();
  const { data, error } = await db.rpc("record_payment_system_retail", {
    p: { checkout_session_id: ev.checkoutSessionId, status: ev.status, provider_ref: ev.paymentId, amount: ev.status === "paid" && ev.amountCents !== null ? ev.amountCents / 100 : undefined, raw: body },
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, result: data });
}
