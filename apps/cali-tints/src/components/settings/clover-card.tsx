"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, CircleDashedIcon, PlugZapIcon } from "lucide-react";
import { toast } from "sonner";
import type { CloverEnv, Company } from "@/lib/db/types";
import { testCloverConnectionAction, updateCloverSettingsAction } from "@/app/(app)/settings/actions";
import { useSession } from "@/components/app/session-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Hint, Label } from "@/components/ui/label";
import { Segmented } from "@/components/ui/segmented";
import { Switch } from "@/components/ui/switch";

export interface CloverEnvStatus {
  key: string;
  set: boolean;
  purpose: string;
}

/**
 * Clover (Fiserv) settings. Only the merchant id, environment and toggles are
 * stored; the tokens live in the hosting environment and are shown here as
 * present / missing so the owner knows what still needs pasting.
 */
export function CloverCard({ company, envStatus }: { company: Pick<Company, "clover_enabled" | "clover_env" | "clover_merchant_id" | "clover_push_orders" | "clover_hosted_checkout" | "clover_last_sync_at" | "clover_device_id" | "clover_pos_id">; envStatus: CloverEnvStatus[] }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [testing, startTest] = useTransition();
  const [f, setF] = useState({
    clover_enabled: company.clover_enabled,
    clover_env: company.clover_env as CloverEnv,
    clover_merchant_id: company.clover_merchant_id ?? "",
    clover_push_orders: company.clover_push_orders,
    clover_hosted_checkout: company.clover_hosted_checkout,
    clover_device_id: company.clover_device_id ?? "",
    clover_pos_id: company.clover_pos_id || "Cali Tints app",
  });
  const allSet = envStatus.every((e) => e.set);

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (demo) return toast.success("Clover settings saved", { description: "Guest preview — not actually saved" });
    start(async () => {
      const r = await updateCloverSettingsAction(f);
      if (r.ok) {
        toast.success("Clover settings saved");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function test() {
    if (demo) return toast.success("Connected to Clover sandbox", { description: "Merchant: Cali Tints Demo (simulated)" });
    startTest(async () => {
      const r = await testCloverConnectionAction({ clover_env: f.clover_env, clover_merchant_id: f.clover_merchant_id });
      if (r.ok) toast.success(`Connected to Clover ${f.clover_env}`, { description: `Merchant: ${r.data.name}` });
      else toast.error(r.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlugZapIcon className="size-4 text-primary" /> Clover payments
        </CardTitle>
        <CardDescription>Pull card payments from your Clover account onto invoices, send pay-by-card links, charge cards from the app, and mirror invoices as Clover orders.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="grid gap-5">
          <label className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-2 px-4 py-3">
            <span>
              <span className="block text-sm font-medium">Clover integration</span>
              <span className="block text-caption text-muted-foreground">Turn everything below on or off in one place.</span>
            </span>
            <Switch checked={f.clover_enabled} onCheckedChange={(v) => setF((s) => ({ ...s, clover_enabled: v }))} aria-label="Enable Clover" />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label>Environment</Label>
              <Segmented
                aria-label="Clover environment"
                items={[
                  { value: "sandbox", label: "Sandbox" },
                  { value: "production", label: "Production" },
                ]}
                value={f.clover_env}
                onValueChange={(v) => setF((s) => ({ ...s, clover_env: v as CloverEnv }))}
                className="w-full"
              />
              <Hint>Start in sandbox with test cards; switch to production when the real tokens are in place.</Hint>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="clover-mid">Merchant ID</Label>
              <Input id="clover-mid" value={f.clover_merchant_id} onChange={(e) => setF((s) => ({ ...s, clover_merchant_id: e.target.value.trim() }))} placeholder="e.g. 7G9V9DP834ZY2" autoCapitalize="characters" spellCheck={false} />
              <Hint>Clover dashboard → Account &amp; Setup → Business information.</Hint>
            </div>
          </div>

          <div className="grid gap-3">
            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block text-sm font-medium">Mirror invoices as Clover orders</span>
                <span className="block text-caption text-muted-foreground">Each generated invoice becomes an open order, so it shows in the register and reports and can be paid on the device.</span>
              </span>
              <Switch checked={f.clover_push_orders} onCheckedChange={(v) => setF((s) => ({ ...s, clover_push_orders: v }))} aria-label="Mirror invoices as Clover orders" />
            </label>
            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block text-sm font-medium">Pay-by-card link in invoice emails</span>
                <span className="block text-caption text-muted-foreground">Adds a secure Clover checkout link under the total. Card payments land on the invoice automatically.</span>
              </span>
              <Switch checked={f.clover_hosted_checkout} onCheckedChange={(v) => setF((s) => ({ ...s, clover_hosted_checkout: v }))} aria-label="Pay-by-card link in invoice emails" />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="clover-device">Clover device serial (optional)</Label>
              <Input id="clover-device" value={f.clover_device_id} onChange={(e) => setF((s) => ({ ...s, clover_device_id: e.target.value.trim() }))} placeholder="e.g. C030UQ12345678" autoCapitalize="characters" spellCheck={false} />
              <Hint>Turns on &ldquo;Pay on terminal&rdquo;: the amount is sent to this device and the customer taps their card. Needs the Cloud Pay Display app installed on it (Clover dashboard → Settings → Devices shows the serial).</Hint>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="clover-pos">Name shown on the device</Label>
              <Input id="clover-pos" value={f.clover_pos_id} onChange={(e) => setF((s) => ({ ...s, clover_pos_id: e.target.value }))} />
            </div>
          </div>

          <div className="rounded-lg border border-border p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-label text-muted-foreground">Tokens in the hosting environment</span>
              {allSet ? <span className="text-caption text-success">all set</span> : <span className="text-caption text-warning">missing</span>}
            </div>
            <ul className="grid gap-1.5 text-sm">
              {envStatus.map((e) => (
                <li key={e.key} className="flex items-center gap-2">
                  {e.set ? <CheckCircle2Icon className="size-4 text-success" /> : <CircleDashedIcon className="size-4 text-subtle" />}
                  <code className="font-mono text-[12px]">{e.key}</code>
                  <span className="text-caption text-subtle">· {e.purpose}</span>
                </li>
              ))}
            </ul>
            <Hint className="mt-2">Set these in Vercel → Project → Environment Variables, then redeploy. Values are never stored in the app database.</Hint>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" loading={pending}>
              Save Clover settings
            </Button>
            <Button type="button" variant="outline" loading={testing} onClick={test} disabled={!f.clover_merchant_id}>
              Test connection
            </Button>
            {company.clover_last_sync_at && <span className="text-caption text-subtle">Last payment sync {new Date(company.clover_last_sync_at).toLocaleString()}</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
