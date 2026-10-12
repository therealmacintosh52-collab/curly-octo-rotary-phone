import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe, periodEnd, tierForPrice } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

/** Stripe → subscriptions table. Uses the service role; verifies the signature first. */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch (e) {
    return NextResponse.json({ error: `Invalid signature: ${e instanceof Error ? e.message : e}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;
        if (session.mode === "subscription" && session.subscription) {
          const sub = await getStripe().subscriptions.retrieve(typeof session.subscription === "string" ? session.subscription : session.subscription.id);
          await upsertSubscription(sub, session.metadata ?? undefined);
        }
        break;
      }
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        await upsertSubscription(event.data.object);
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error("stripe webhook", e);
    return NextResponse.json({ error: "Handler failed" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}

async function upsertSubscription(sub: Stripe.Subscription, meta?: Stripe.Metadata) {
  const db = createAdminClient();
  const m = { ...(sub.metadata ?? {}), ...(meta ?? {}) };
  const userId = m.user_id || null;
  const shopId = m.shop_id || null;
  if (!userId && !shopId) return;
  const item = sub.items.data[0];
  const tier = tierForPrice(item?.price?.id);
  const row = {
    user_id: shopId ? null : userId,
    shop_id: shopId || null,
    stripe_customer_id: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    tier: sub.status === "canceled" || sub.status === "unpaid" || sub.status === "incomplete_expired" ? ("free" as const) : tier,
    status: sub.status,
    seats: item?.quantity ?? 1,
    current_period_end: periodEnd(sub),
    cancel_at_period_end: sub.cancel_at_period_end,
  };
  const { error } = await db.from("subscriptions").upsert(row, { onConflict: "stripe_subscription_id" });
  if (error) throw error;
}
