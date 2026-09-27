import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cloverSecrets } from "@/lib/clover/env";
import { fromCents } from "@/lib/clover/money";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
  Hosted-checkout webhook. Configure in the Clover merchant dashboard with
  this URL plus `?secret=<CLOVER_WEBHOOK_SECRET>`; the same value is also
  accepted in an `x-clover-auth` or `authorization: Bearer` header.

  Payload shapes vary by Clover version, so the handler reads the session id
  and payment fields defensively, applies the payment to the invoice that owns
  the session, and never trusts the payload for the amount when Clover omits
  it (falls back to the invoice balance at the time the link was made).
*/
type Loose = Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null);

function authorized(request: NextRequest, secret: string) {
  const q = request.nextUrl.searchParams.get("secret");
  const h = request.headers.get("x-clover-auth") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
  return q === secret || h === secret;
}

export async function POST(request: NextRequest) {
  const secret = cloverSecrets().webhookSecret;
  if (!secret) return NextResponse.json({ error: "CLOVER_WEBHOOK_SECRET is not set" }, { status: 500 });
  if (!authorized(request, secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Loose;
  try {
    body = (await request.json()) as Loose;
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  // Verification handshakes echo back whatever code Clover sends.
  if (str(body.verificationCode)) return NextResponse.json({ verificationCode: body.verificationCode });

  const data = (body.data as Loose | undefined) ?? body;
  const sessionId = str(data.checkoutSessionId) ?? str(data.checkoutSession) ?? str((data.checkout as Loose | undefined)?.id);
  if (!sessionId) return NextResponse.json({ ok: true, ignored: "no checkoutSessionId" });

  const status = (str(data.status) ?? str(data.paymentStatus) ?? "").toUpperCase();
  if (status && !/PAID|SUCCESS|APPROVED|COMPLETE/.test(status)) return NextResponse.json({ ok: true, ignored: `status ${status}` });

  const admin = createAdminClient();
  const { data: invoice } = await admin.from("invoices").select("id, company_id, total, amount_paid, status, display_number").eq("clover_checkout_session_id", sessionId).maybeSingle();
  if (!invoice) return NextResponse.json({ ok: true, ignored: "unknown session" });

  const payments = Array.isArray(data.payments) ? (data.payments as Loose[]) : Array.isArray((data.payment as Loose | undefined)?.elements) ? ((data.payment as Loose).elements as Loose[]) : data.payment ? [data.payment as Loose] : [data];
  const balance = Number(invoice.total) - Number(invoice.amount_paid);
  let applied = 0;
  for (const p of payments) {
    const paymentId = str(p.id) ?? str(p.paymentId) ?? `hc_${sessionId}`;
    const cents = num(p.amount);
    const amount = cents !== null ? fromCents(cents) : balance;
    if (amount <= 0) continue;
    const card = (p.cardTransaction as Loose | undefined) ?? (p.source as Loose | undefined) ?? {};
    await admin.from("clover_payments").upsert(
      {
        company_id: invoice.company_id,
        clover_payment_id: paymentId,
        clover_order_id: str((p.order as Loose | undefined)?.id) ?? str(data.orderId),
        source: "clover_checkout",
        amount,
        tip: num(p.tipAmount) !== null ? fromCents(num(p.tipAmount) as number) : 0,
        paid_at: new Date(num(p.createdTime) ?? Date.now()).toISOString(),
        card_brand: str(card.cardType) ?? str(card.brand),
        last4: str(card.last4),
        reference: `${invoice.display_number} · pay link`,
        raw: body as never,
        status: "unmatched",
      },
      { onConflict: "company_id,clover_payment_id", ignoreDuplicates: true },
    );
    const { error } = await admin.rpc("apply_clover_payment", { p_company_id: invoice.company_id, p_clover_payment_id: paymentId, p_invoice_id: invoice.id, p_matched_by: "checkout" });
    if (error) console.warn(`clover webhook apply ${paymentId}: ${error.message}`);
    else applied += 1;
  }
  return NextResponse.json({ ok: true, invoice: invoice.display_number, applied });
}
