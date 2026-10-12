import Link from "next/link";
import { Page } from "@/components/shell/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { BillingPanel } from "@/components/billing/billing-panel";
import { createClient, getProfile } from "@/lib/supabase/server";
import { getEntitlements } from "@/lib/entitlements";
import { saveShopAction, updateProfileAction } from "./actions";
import { TIERS } from "@/lib/config";

export const metadata = { title: "Settings" };

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ error?: string; saved?: string; billing?: string }> }) {
  const sp = await searchParams;
  const profile = (await getProfile())!;
  const supabase = await createClient();
  const [ent, { data: shop }, { data: fixStats }] = await Promise.all([
    getEntitlements(profile),
    profile.shop_id ? supabase.from("shops").select("*").eq("id", profile.shop_id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("fixes").select("id, verified_at", { count: "exact" }).eq("author_id", profile.id),
  ]);
  const isOwner = !shop || shop.owner_id === profile.id;

  return (
    <Page title="Settings">
      {sp.error && <p className="mb-4 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{sp.error}</p>}
      {sp.saved && <p className="mb-4 rounded-lg border border-success/50 bg-success/10 p-3 text-sm">Saved.</p>}
      {sp.billing === "success" && <p className="mb-4 rounded-lg border border-success/50 bg-success/10 p-3 text-sm">Subscription started. It can take a few seconds for the webhook to update your plan.</p>}
      <section className="mb-4 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Profile</h2>
        <form action={updateProfileAction} className="space-y-3">
          <div>
            <Label htmlFor="display_name">Display name</Label>
            <Input id="display_name" name="display_name" defaultValue={profile.display_name} required />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            {profile.role === "admin" ? (
              <p className="text-sm">
                <Badge>admin / moderator</Badge>
              </p>
            ) : (
              <Select id="role" name="role" defaultValue={profile.role}>
                <option value="technician">Technician</option>
                <option value="shop_owner">Shop owner</option>
                <option value="diy">DIYer</option>
              </Select>
            )}
          </div>
          <Button type="submit" variant="secondary" className="w-full">
            Save profile
          </Button>
        </form>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-lg bg-muted p-2">
            <dt className="text-xs text-muted-foreground">Reputation</dt>
            <dd className="text-xl font-bold">{profile.reputation}</dd>
          </div>
          <div className="rounded-lg bg-muted p-2">
            <dt className="text-xs text-muted-foreground">Fixes submitted</dt>
            <dd className="text-xl font-bold">{fixStats?.length ?? 0}</dd>
          </div>
          <div className="rounded-lg bg-muted p-2">
            <dt className="text-xs text-muted-foreground">Verified</dt>
            <dd className="text-xl font-bold">{fixStats?.filter((f) => f.verified_at).length ?? 0}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">
          Each verified fix (3+ net confirmations) earns one free month. Earned: {profile.free_months_earned} · redeemed: {profile.free_months_redeemed}.
        </p>
      </section>

      <section className="mb-4 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Shop</h2>
        {shop && !isOwner ? (
          <p className="text-sm">
            Member of <strong>{shop.name}</strong>. Labor rate {Number(shop.labor_rate)}/h, tax {(Number(shop.tax_rate) * 100).toFixed(2)}%.
          </p>
        ) : (
          <form action={saveShopAction} className="space-y-3">
            <div>
              <Label htmlFor="name">Shop name</Label>
              <Input id="name" name="name" defaultValue={shop?.name ?? ""} placeholder="Phil's Auto & Fleet" required />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="labor_rate">Labor rate ($/h)</Label>
                <Input id="labor_rate" name="labor_rate" inputMode="decimal" defaultValue={Number(shop?.labor_rate ?? 120)} />
              </div>
              <div>
                <Label htmlFor="tax_rate">Tax rate (%)</Label>
                <Input id="tax_rate" name="tax_rate" inputMode="decimal" defaultValue={shop ? (Number(shop.tax_rate) * 100).toFixed(3).replace(/\.?0+$/, "") : "8.25"} />
              </div>
            </div>
            <Input name="phone" placeholder="Phone" defaultValue={shop?.phone ?? ""} />
            <Input name="email" type="email" placeholder="Email" defaultValue={shop?.email ?? ""} />
            <Input name="address" placeholder="Address" defaultValue={shop?.address ?? ""} />
            <Button type="submit" variant="secondary" className="w-full">
              {shop ? "Save shop" : "Create shop"}
            </Button>
          </form>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Shop rates prefill new estimates. Technicians join a shop by having the owner set their shop_id (invites are a follow-up).</p>
      </section>

      <section className="mb-4 rounded-xl border border-border bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Billing</h2>
        <p className="mb-3 text-sm">
          Current plan: <Badge variant={ent.tier === "free" ? "muted" : "default"}>{TIERS[ent.tier].label}</Badge>
          {ent.subscriptionStatus && ent.subscriptionStatus !== "admin" && <span className="ml-2 text-xs text-muted-foreground">({ent.subscriptionStatus})</span>}
        </p>
        <BillingPanel tier={ent.tier} freeMonthsAvailable={profile.free_months_earned - profile.free_months_redeemed} />
      </section>

      <p className="text-center text-xs text-muted-foreground">
        <Link href="/terms" className="underline">
          Terms & data sources
        </Link>
      </p>
    </Page>
  );
}
