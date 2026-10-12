import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TIERS, type Tier } from "@/lib/config";

export function BillingPanel({ tier, freeMonthsAvailable }: { tier: Tier; freeMonthsAvailable: number }) {
  const configured = Boolean(process.env.STRIPE_SECRET_KEY);
  if (!configured) return <p className="text-sm text-muted-foreground">Billing is not configured on this server (set STRIPE_SECRET_KEY and price ids).</p>;
  return (
    <div className="space-y-3">
      {freeMonthsAvailable > 0 && tier === "free" && (
        <p className="rounded-lg border border-success/50 bg-success/10 p-3 text-sm">
          You have {freeMonthsAvailable} earned free month{freeMonthsAvailable === 1 ? "" : "s"}. One is applied automatically at checkout.
        </p>
      )}
      {tier !== "free" ? (
        <form action="/api/stripe/portal" method="post">
          <Button type="submit" variant="outline" className="w-full">
            Manage subscription
          </Button>
        </form>
      ) : (
        <div className="grid gap-2">
          <form action="/api/stripe/checkout" method="post">
            <input type="hidden" name="tier" value="pro_tech" />
            <Button type="submit" className="w-full">
              Upgrade to {TIERS.pro_tech.label} · ${TIERS.pro_tech.price}/mo
            </Button>
          </form>
          <form action="/api/stripe/checkout" method="post" className="flex gap-2">
            <input type="hidden" name="tier" value="shop" />
            <Input name="seats" type="number" min={1} max={50} defaultValue={TIERS.shop.seats} aria-label="Seats" className="w-24" />
            <Button type="submit" variant="secondary" className="flex-1">
              {TIERS.shop.label} · ${TIERS.shop.price}/mo per 5 seats
            </Button>
          </form>
        </div>
      )}
    </div>
  );
}
