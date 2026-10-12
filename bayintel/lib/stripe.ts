import "server-only";
import Stripe from "stripe";
import type { Tier } from "@/lib/config";

let client: Stripe | null = null;

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY is not set");
  client ??= new Stripe(process.env.STRIPE_SECRET_KEY);
  return client;
}

export const PRICE_BY_TIER: Record<Exclude<Tier, "free">, string | undefined> = {
  pro_tech: process.env.STRIPE_PRICE_PRO_TECH,
  shop: process.env.STRIPE_PRICE_SHOP,
};

export function tierForPrice(priceId: string | null | undefined): Tier {
  if (!priceId) return "free";
  if (priceId === PRICE_BY_TIER.shop) return "shop";
  if (priceId === PRICE_BY_TIER.pro_tech) return "pro_tech";
  return "free";
}

/** Stripe moved current_period_end from the subscription to its items in newer API versions; support both. */
export function periodEnd(sub: Stripe.Subscription): string | null {
  const s = sub as unknown as { current_period_end?: number };
  const ts = s.current_period_end ?? sub.items.data[0]?.current_period_end;
  return ts ? new Date(ts * 1000).toISOString() : null;
}
