"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangleIcon, CheckCircle2Icon, CircleDashedIcon, LogInIcon, PlugZapIcon, RefreshCwIcon, UnplugIcon } from "lucide-react";
import { toast } from "sonner";
import type { CloverEnv, Company } from "@/lib/db/types";
import type { CloverStatus } from "@/lib/clover/status";
import { checkCloverConnectionAction, disconnectCloverAction, testCloverConnectionAction, updateCloverSettingsAction } from "@/app/(app)/settings/actions";
import { useSession } from "@/components/app/session-provider";
import { formatDateTime } from "@/lib/dates";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
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

type CompanyClover = Pick<Company, "clover_enabled" | "clover_env" | "clover_merchant_id" | "clover_push_orders" | "clover_hosted_checkout" | "clover_last_sync_at" | "clover_device_id" | "clover_pos_id" | "clover_connected_at" | "clover_merchant_name">;

/**
 * Clover (Fiserv) settings. The easy path is one button: Sign in with Clover.
 * The merchant id, tokens and card-entry key all come back from Clover and
 * are stored server-side (tokens encrypted). Manual API tokens remain as an
 * advanced fallback.
 */
export function CloverCard({ company, envStatus, status, notice = null }: { company: CompanyClover; envStatus: CloverEnvStatus[]; status: CloverStatus; notice?: { kind: "connected" | "error"; message: string | null } | null }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [testing, startTest] = useTransition();
  const [disconnecting, startDisconnect] = useTransition();
  const [advanced, setAdvanced] = useState(!status.connected && status.manualTokens);
  const [f, setF] = useState({
    clover_enabled: company.clover_enabled,
    clover_env: company.clover_env as CloverEnv,
    clover_merchant_id: company.clover_merchant_id ?? "",
    clover_push_orders: company.clover_push_orders,
    clover_hosted_checkout: company.clover_hosted_checkout,
    clover_device_id: company.clover_device_id ?? "",
    clover_pos_id: company.clover_pos_id || "Cali Tints app",
  });
  const manualEnv = envStatus.filter((e) => !e.key.startsWith("CLOVER_APP_"));

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

  function check() {
    if (demo) return toast.success("Clover answered in 180 ms", { description: "Merchant: Cali Tints (sandbox) · simulated" });
    startTest(async () => {
      const r = status.connected || status.manualTokens ? await checkCloverConnectionAction() : await testCloverConnectionAction({ clover_env: f.clover_env, clover_merchant_id: f.clover_merchant_id });
      if (r.ok) {
        toast.success(`Clover answered${"ms" in r.data ? ` in ${r.data.ms} ms` : ""}`, { description: `Merchant: ${r.data.name}` });
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function disconnect() {
    if (!confirm("Disconnect Clover? Card and terminal payments stop until you sign in again.")) return;
    if (demo) return toast.success("Clover disconnected", { description: "Guest preview — nothing changed" });
    startDisconnect(async () => {
      const r = await disconnectCloverAction();
      if (r.ok) {
        toast.success("Clover disconnected");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  // Full navigations (the route answers with a redirect to Clover's login page).
  const signInHref = (env: CloverEnv) => `/api/clover/connect?env=${env}`;
  const demoSignIn = (env: CloverEnv) => (e: React.MouseEvent) => {
    if (!demo) return;
    e.preventDefault();
    toast.success(`Signing in with Clover (${env})`, { description: "Guest preview — opens Clover's login on the real app" });
  };

  return (
    <Card id="clover" className="scroll-mt-24">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlugZapIcon className="size-4 text-primary" /> Clover payments
        </CardTitle>
        <CardDescription>Take cards on the Clover terminal or in the app, send pay-by-card links, and keep Clover and your invoices in step.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5">
        {notice?.kind === "connected" && (
          <Alert variant="success">
            <CheckCircle2Icon />
            <AlertTitle>Connected to Clover{notice.message ? ` · ${notice.message}` : ""}</AlertTitle>
            <AlertDescription>Cards, the terminal and pay links are ready. Nothing else to paste.</AlertDescription>
          </Alert>
        )}
        {notice?.kind === "error" && (
          <Alert variant="destructive">
            <AlertTriangleIcon />
            <AlertTitle>Clover sign-in did not finish</AlertTitle>
            <AlertDescription>{notice.message ?? "Try again."}</AlertDescription>
          </Alert>
        )}

        {/* ---- Sign in / connection state ---- */}
        {status.connected ? (
          <div className={`rounded-xl border px-4 py-4 ${status.needsReconnect ? "border-warning/40 bg-warning/8" : "border-success/30 bg-success/8"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {status.needsReconnect ? <AlertTriangleIcon className="size-4 text-warning" /> : <CheckCircle2Icon className="size-4 text-success" />}
                  <span className="font-medium">{status.needsReconnect ? "Clover needs a fresh sign-in" : `Signed in as ${status.merchantName ?? status.merchantId}`}</span>
                  <Badge variant={status.env === "production" ? "success" : "warning"}>{status.env}</Badge>
                </div>
                <div className="mt-1 text-caption text-subtle">
                  {status.needsReconnect ? (status.lastError ?? "The sign-in expired or was revoked.") : `Connected ${company.clover_connected_at ? formatDateTime(company.clover_connected_at) : ""}${status.lastOkAt ? ` · last OK ${formatDateTime(status.lastOkAt)}` : ""}`}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {status.needsReconnect ? (
                  <Button asChild size="sm">
                    <a href={signInHref(status.env)} onClick={demoSignIn(status.env)}>
                      <LogInIcon /> Reconnect
                    </a>
                  </Button>
                ) : (
                  <Button type="button" size="sm" variant="outline" loading={testing} onClick={check}>
                    <RefreshCwIcon /> Check connection
                  </Button>
                )}
                <Button type="button" size="sm" variant="ghost" loading={disconnecting} onClick={disconnect} className="text-muted-foreground">
                  <UnplugIcon /> Disconnect
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface-2 px-4 py-4">
            <div className="text-sm font-medium">Sign in with Clover</div>
            <p className="mt-1 text-caption text-muted-foreground">One login at Clover connects the merchant account: orders, payments, card entry and the terminal, with nothing to copy and paste. Tokens are stored encrypted and refreshed automatically.</p>
            {status.signInAvailable || demo ? (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild>
                  <a href={signInHref("production")} onClick={demoSignIn("production")}>
                    <LogInIcon /> Sign in with Clover
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={signInHref("sandbox")} onClick={demoSignIn("sandbox")}>
                    Sandbox (test cards)
                  </a>
                </Button>
              </div>
            ) : (
              <Hint tone="warning" className="mt-3">
                One-time setup: register the app in Clover&rsquo;s developer dashboard and add <code className="font-mono">CLOVER_APP_ID</code> and <code className="font-mono">CLOVER_APP_SECRET</code> in Vercel (README → Clover). Until then, API tokens below still work.
              </Hint>
            )}
          </div>
        )}

        <form onSubmit={save} className="grid gap-5">
          <div className="grid gap-3">
            <label className="flex items-center justify-between gap-4">
              <span>
                <span className="block text-sm font-medium">Mirror invoices as Clover orders</span>
                <span className="block text-caption text-muted-foreground">Each invoice becomes an open order, so it shows in the register and reports and can be paid on the device.</span>
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
              <Label htmlFor="clover-device">Clover terminal serial</Label>
              <Input id="clover-device" value={f.clover_device_id} onChange={(e) => setF((s) => ({ ...s, clover_device_id: e.target.value.trim() }))} placeholder="e.g. C030UQ12345678" autoCapitalize="characters" spellCheck={false} />
              <Hint>Turns on &ldquo;Pay on terminal&rdquo;. Clover dashboard → Devices shows the serial; the device needs the Cloud Pay Display app.</Hint>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="clover-pos">Name shown on the device</Label>
              <Input id="clover-pos" value={f.clover_pos_id} onChange={(e) => setF((s) => ({ ...s, clover_pos_id: e.target.value }))} />
            </div>
          </div>

          {/* ---- Advanced: manual tokens ---- */}
          <div className="rounded-lg border border-border">
            <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left text-sm" onClick={() => setAdvanced((a) => !a)} aria-expanded={advanced}>
              <span className="font-medium">Advanced: API tokens instead of sign-in</span>
              <span className="text-caption text-subtle">{advanced ? "hide" : "show"}</span>
            </button>
            {advanced && (
              <div className="grid gap-4 border-t border-border px-4 py-4">
                <label className="flex items-center justify-between gap-4">
                  <span>
                    <span className="block text-sm font-medium">Clover integration</span>
                    <span className="block text-caption text-muted-foreground">On automatically after sign-in; toggle here when using tokens.</span>
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
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="clover-mid">Merchant ID</Label>
                    <Input id="clover-mid" value={f.clover_merchant_id} onChange={(e) => setF((s) => ({ ...s, clover_merchant_id: e.target.value.trim() }))} placeholder="e.g. 7G9V9DP834ZY2" autoCapitalize="characters" spellCheck={false} />
                  </div>
                </div>
                <div>
                  <div className="mb-2 text-label text-muted-foreground">Tokens in the hosting environment</div>
                  <ul className="grid gap-1.5 text-sm">
                    {manualEnv.map((e) => (
                      <li key={e.key} className="flex items-center gap-2">
                        {e.set ? <CheckCircle2Icon className="size-4 text-success" /> : <CircleDashedIcon className="size-4 text-subtle" />}
                        <code className="font-mono text-[12px]">{e.key}</code>
                        <span className="text-caption text-subtle">· {e.purpose}</span>
                      </li>
                    ))}
                  </ul>
                  <Hint className="mt-2">Set these in Vercel → Project → Environment Variables, then redeploy. Values are never stored in the app database.</Hint>
                </div>
                {!status.connected && (
                  <Button type="button" variant="outline" size="sm" loading={testing} onClick={check} disabled={!f.clover_merchant_id} className="justify-self-start">
                    <RefreshCwIcon /> Test tokens
                  </Button>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button type="submit" loading={pending}>
              Save Clover settings
            </Button>
            {company.clover_last_sync_at && <span className="text-caption text-subtle">Last payment sync {formatDateTime(company.clover_last_sync_at)}</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
