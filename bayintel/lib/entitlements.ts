import "server-only";
import { createClient } from "@/lib/supabase/server";
import { TIERS, type Tier } from "@/lib/config";
import type { Database } from "@/lib/database.types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export interface Entitlements {
  tier: Tier;
  aiQueriesPerMonth: number; // Infinity for unlimited
  seats: number;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
}

/** Resolves the effective tier: a shop subscription covers its members; otherwise the user's own. */
export async function getEntitlements(profile: Pick<Profile, "id" | "shop_id" | "role">): Promise<Entitlements> {
  const supabase = await createClient();
  if (profile.role === "admin") {
    return { tier: "shop", aiQueriesPerMonth: Infinity, seats: 999, subscriptionStatus: "admin", currentPeriodEnd: null };
  }
  const { data: subs } = await supabase
    .from("subscriptions")
    .select("tier, status, seats, current_period_end, user_id, shop_id")
    .or(`user_id.eq.${profile.id}${profile.shop_id ? `,shop_id.eq.${profile.shop_id}` : ""}`);
  const active = (subs ?? []).filter((s) => ["active", "trialing", "past_due"].includes(s.status));
  const best = active.sort((a, b) => rank(b.tier) - rank(a.tier))[0];
  const tier: Tier = best ? (best.tier as Tier) : "free";
  return {
    tier,
    aiQueriesPerMonth: TIERS[tier].aiQueriesPerMonth,
    seats: best?.seats ?? 1,
    subscriptionStatus: best?.status ?? null,
    currentPeriodEnd: best?.current_period_end ?? null,
  };
}

function rank(t: string) {
  return t === "shop" ? 2 : t === "pro_tech" ? 1 : 0;
}
