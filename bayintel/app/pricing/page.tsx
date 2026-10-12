import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { APP_NAME, TIERS } from "@/lib/config";
import { getUser } from "@/lib/supabase/server";

export const metadata = { title: "Pricing" };

const PLANS = [
  { tier: "free", blurb: "For DIYers.", features: [`${TIERS.free.aiQueriesPerMonth} AI diagnostics / month`, "VIN decode, recalls, complaints", "DTC lookup & confirmed fixes", "Submit fixes, earn free months"] },
  { tier: "pro_tech", blurb: "For mobile mechanics and techs.", features: ["Unlimited AI diagnostics", "Repair orders & estimates with PDF", "Customer share links", "Priority on new data sources"] },
  { tier: "shop", blurb: "For independent shops.", features: ["Everything in Pro Tech", "5 seats included, add more", "Shared garage, ROs and estimates", "Shop labor rate and tax defaults"] },
] as const;

export default async function PricingPage() {
  const user = await getUser();
  return (
    <main className="mx-auto max-w-4xl px-5 py-10">
      <Link href="/" className="mb-8 flex items-center gap-2 font-semibold">
        <span className="inline-block size-7 rounded-md bg-primary" aria-hidden /> {APP_NAME}
      </Link>
      <h1 className="text-3xl font-bold">Plans</h1>
      <p className="mt-2 text-muted-foreground">Contributors earn a free month for every fix that reaches 3 net confirmations.</p>
      <div className="mt-8 grid gap-4 md:grid-cols-3">
        {PLANS.map((p) => (
          <div key={p.tier} className={`rounded-2xl border bg-card p-5 ${p.tier === "pro_tech" ? "border-primary" : "border-border"}`}>
            <p className="text-lg font-semibold">{TIERS[p.tier].label}</p>
            <p className="text-sm text-muted-foreground">{p.blurb}</p>
            <p className="mt-3 text-3xl font-bold">
              ${TIERS[p.tier].price}
              <span className="text-base font-normal text-muted-foreground">/mo</span>
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              {p.features.map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="size-4 shrink-0 text-success" /> {f}
                </li>
              ))}
            </ul>
            <div className="mt-5">
              {p.tier === "free" ? (
                <Button asChild variant="outline" className="w-full">
                  <Link href={user ? "/garage" : "/signup"}>{user ? "You're on Free" : "Start free"}</Link>
                </Button>
              ) : user ? (
                <form action="/api/stripe/checkout" method="post">
                  <input type="hidden" name="tier" value={p.tier} />
                  <Button type="submit" className="w-full" variant={p.tier === "pro_tech" ? "default" : "secondary"}>
                    Choose {TIERS[p.tier].label}
                  </Button>
                </form>
              ) : (
                <Button asChild className="w-full" variant={p.tier === "pro_tech" ? "default" : "secondary"}>
                  <Link href={`/signup?next=/pricing`}>Sign up to subscribe</Link>
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-8 text-xs text-muted-foreground">Prices are placeholders configured in lib/config.ts and Stripe. All information in the product is advisory; see the <Link href="/terms" className="underline">terms</Link>.</p>
    </main>
  );
}
