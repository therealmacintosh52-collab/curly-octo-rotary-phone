import { NextResponse } from "next/server";
import { handleError, HttpError, requireUser } from "@/lib/api";
import { getStripe, PRICE_BY_TIER, stripeConfigured } from "@/lib/stripe";
import { APP_URL, TIERS } from "@/lib/config";

/** Starts a Stripe Checkout session. Accepts form posts (tier, seats) so it works without JS. */
export async function POST(req: Request) {
  try {
    const { supabase, user } = await requireUser();
    if (!stripeConfigured()) throw new HttpError(503, "Billing is not configured on this server.");
    const form = await req.formData();
    const tier = String(form.get("tier") ?? "");
    const seats = Math.min(50, Math.max(1, Number(form.get("seats") ?? 1) || 1));
    if (tier !== "pro_tech" && tier !== "shop") throw new HttpError(400, "Unknown plan");
    const price = PRICE_BY_TIER[tier];
    if (!price) throw new HttpError(503, `No Stripe price configured for ${TIERS[tier].label}.`);

    const { data: profile } = await supabase.from("profiles").select("shop_id, free_months_earned, free_months_redeemed").eq("id", user.id).single();
    const { data: existing } = await supabase.from("subscriptions").select("stripe_customer_id").eq("user_id", user.id).maybeSingle();

    // Contributors redeem one earned free month per checkout via a 100%-off-one-month coupon.
    let coupon: string | undefined;
    if (process.env.STRIPE_COUPON_FREE_MONTH && profile && profile.free_months_earned > profile.free_months_redeemed) {
      const { data: ok } = await supabase.rpc("redeem_free_month");
      if (ok) coupon = process.env.STRIPE_COUPON_FREE_MONTH;
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price, quantity: tier === "shop" ? seats : 1 }],
      customer: existing?.stripe_customer_id ?? undefined,
      customer_email: existing?.stripe_customer_id ? undefined : user.email,
      client_reference_id: user.id,
      metadata: { user_id: user.id, tier, shop_id: tier === "shop" ? (profile?.shop_id ?? "") : "" },
      subscription_data: { metadata: { user_id: user.id, tier, shop_id: tier === "shop" ? (profile?.shop_id ?? "") : "" } },
      discounts: coupon ? [{ coupon }] : undefined,
      allow_promotion_codes: coupon ? undefined : true,
      success_url: `${APP_URL}/settings?billing=success`,
      cancel_url: `${APP_URL}/pricing?billing=cancelled`,
    });
    return NextResponse.redirect(session.url!, { status: 303 });
  } catch (e) {
    return handleError(e);
  }
}
