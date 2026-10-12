import { NextResponse } from "next/server";
import { handleError, HttpError, requireUser } from "@/lib/api";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { APP_URL } from "@/lib/config";

export async function POST() {
  try {
    const { supabase, user } = await requireUser();
    if (!stripeConfigured()) throw new HttpError(503, "Billing is not configured on this server.");
    const { data: profile } = await supabase.from("profiles").select("shop_id").eq("id", user.id).single();
    const { data: subs } = await supabase
      .from("subscriptions")
      .select("stripe_customer_id, user_id, shop_id")
      .or(`user_id.eq.${user.id}${profile?.shop_id ? `,shop_id.eq.${profile.shop_id}` : ""}`);
    const customer = subs?.find((s) => s.user_id === user.id)?.stripe_customer_id ?? subs?.[0]?.stripe_customer_id;
    if (!customer) throw new HttpError(404, "No billing account yet.");
    const session = await getStripe().billingPortal.sessions.create({ customer, return_url: `${APP_URL}/settings` });
    return NextResponse.redirect(session.url, { status: 303 });
  } catch (e) {
    return handleError(e);
  }
}
