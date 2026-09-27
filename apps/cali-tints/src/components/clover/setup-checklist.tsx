import Link from "next/link";
import { CheckCircle2Icon, CircleDashedIcon, PlugZapIcon } from "lucide-react";
import type { Company } from "@/lib/db/types";
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

/** Work out the setup steps from the company row and which tokens are present (server side; names only). */
export function cloverSetupSteps(company: Pick<Company, "clover_enabled" | "clover_merchant_id" | "clover_verified_at" | "clover_last_sync_at" | "clover_device_id" | "clover_hosted_checkout">, env: { key: string; set: boolean }[], appUrl: string | null): CloverSetupStep[] {
  const has = (k: string) => env.some((e) => e.key === k && e.set);
  const tokensMissing = env.filter((e) => !e.set).map((e) => e.key);
  return [
    { id: "tokens", label: "Clover tokens in Vercel", done: tokensMissing.length === 0, how: `Vercel → Project → Environment Variables: ${tokensMissing.join(", ") || "all set"}. Redeploy after adding.`, href: "/settings" },
    { id: "merchant", label: "Clover turned on with the merchant ID", done: company.clover_enabled && !!company.clover_merchant_id, how: "Settings → Clover: enable, pick sandbox or production, paste the merchant ID.", href: "/settings" },
    { id: "verified", label: "Connection tested", done: !!(company.clover_verified_at || company.clover_last_sync_at), how: "Settings → Clover → Test connection.", href: "/settings" },
    { id: "device", label: "Terminal serial for Pay on terminal", done: !!company.clover_device_id, how: "Settings → Clover → device serial (Clover dashboard → Devices). Install Cloud Pay Display on the terminal.", href: "/settings" },
    { id: "card", label: "Card entry in the app", done: has("CLOVER_ECOM_PUBLIC_KEY") && has("CLOVER_ECOM_PRIVATE_TOKEN"), how: "Needs CLOVER_ECOM_PUBLIC_KEY and CLOVER_ECOM_PRIVATE_TOKEN (Clover dashboard → Ecommerce API tokens).", href: "/settings" },
    {
      id: "webhook",
      label: "Pay-by-card link confirmations",
      done: !company.clover_hosted_checkout || has("CLOVER_WEBHOOK_SECRET"),
      how: `Clover Hosted Checkout settings → webhook URL ${appUrl ? `${appUrl}/api/clover/webhook?secret=<CLOVER_WEBHOOK_SECRET>` : "https://<your-app>/api/clover/webhook?secret=<CLOVER_WEBHOOK_SECRET>"}; set CLOVER_WEBHOOK_SECRET in Vercel.`,
    },
  ];
}

/**
 * Shown until Clover is fully wired up; hidden once every step is done. Each
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
          <PlugZapIcon className="size-4 text-primary" /> Clover setup · {done} of {steps.length} done
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
                          Open settings
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
