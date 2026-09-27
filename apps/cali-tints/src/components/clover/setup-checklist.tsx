import Link from "next/link";
import { CheckCircle2Icon, CircleDashedIcon, PlugZapIcon } from "lucide-react";
import type { Company } from "@/lib/db/types";
import type { CloverStatus } from "@/lib/clover/status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface CloverSetupStep {
  id: string;
  label: string;
  done: boolean;
  /** What to do when not done. */
  how: string;
  href?: string;
}

/** The steps between "fresh install" and "charging customers", from the company row and the live Clover status. */
export function cloverSetupSteps(company: Pick<Company, "name" | "address_line1" | "city" | "phone" | "email">, status: CloverStatus, appUrl: string | null): CloverSetupStep[] {
  const detailsDone = !!(company.name && company.address_line1 && company.city && (company.phone || company.email));
  const signedIn = status.connected || (status.manualTokens && status.enabled && !!status.merchantId);
  const steps: CloverSetupStep[] = [
    { id: "details", label: "Invoice details", done: detailsDone, how: "Business name, address and phone as they print on invoices and receipts.", href: "/settings#invoice-details" },
    {
      id: "signin",
      label: "Signed in to Clover",
      done: signedIn,
      how: status.signInAvailable ? "Settings → Clover → Sign in with Clover, log in with the Clover account, done." : "Vercel → Environment Variables: add CLOVER_APP_ID and CLOVER_APP_SECRET (README → Clover), redeploy, then Settings → Clover → Sign in with Clover.",
      href: "/settings",
    },
    {
      id: "healthy",
      label: "Connection working",
      done: signedIn && status.healthy,
      how: status.needsReconnect ? `Clover rejected the sign-in${status.lastError ? ` (${status.lastError})` : ""}. Settings → Clover → Reconnect.` : "Settings → Clover → Check connection.",
      href: "/settings",
    },
    { id: "device", label: "Terminal serial for Pay on terminal", done: status.device, how: "Settings → Clover → device serial (Clover dashboard → Devices). Install Cloud Pay Display on the terminal.", href: "/settings" },
  ];
  if (!status.cardEntry) steps.push({ id: "card", label: "Card entry in the app", done: false, how: status.connected ? "Clover did not hand back a card-entry key for this merchant. Reconnect, or set CLOVER_ECOM_PUBLIC_KEY + CLOVER_ECOM_PRIVATE_TOKEN." : "Sign in with Clover (automatic), or set CLOVER_ECOM_PUBLIC_KEY + CLOVER_ECOM_PRIVATE_TOKEN.", href: "/settings" });
  if (status.hostedCheckout)
    steps.push({
      id: "webhook",
      label: "Pay-by-card link confirmations",
      done: status.webhook,
      how: `Clover Hosted Checkout settings → webhook URL ${appUrl ? `${appUrl}/api/clover/webhook?secret=<CLOVER_WEBHOOK_SECRET>` : "https://<your-app>/api/clover/webhook?secret=<CLOVER_WEBHOOK_SECRET>"}; set CLOVER_WEBHOOK_SECRET in Vercel. Or turn the pay link off in Settings → Clover.`,
    });
  return steps;
}

/**
 * Shown until everything is wired up; hidden once every step is done. Each
 * step says exactly where to click, so nothing is silently missing.
 */
export function CloverSetupChecklist({ steps, className }: { steps: CloverSetupStep[]; className?: string }) {
  const open = steps.filter((s) => !s.done);
  if (open.length === 0) return null;
  const done = steps.length - open.length;
  return (
    <Card className={cn("border-primary/30", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlugZapIcon className="size-4 text-primary" /> Getting set up · {done} of {steps.length} done
        </CardTitle>
        <CardDescription>Cash, check and ACH work now. Card and Pay on terminal switch on as these are completed.</CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="grid gap-2.5">
          {steps.map((s) => (
            <li key={s.id} className="flex items-start gap-3">
              {s.done ? <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-success" /> : <CircleDashedIcon className="mt-0.5 size-4 shrink-0 text-warning" />}
              <div className="min-w-0 text-sm">
                <div className={cn("font-medium", s.done && "text-muted-foreground line-through decoration-border")}>{s.label}</div>
                {!s.done && (
                  <div className="text-caption text-subtle">
                    {s.how}
                    {s.href && (
                      <>
                        {" "}
                        <Link href={s.href} className="text-primary underline-offset-4 hover:underline">
                          Open
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
