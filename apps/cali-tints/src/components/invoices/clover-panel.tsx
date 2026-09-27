"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, CopyIcon, ExternalLinkIcon, LinkIcon, PlugZapIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { createCheckoutLinkAction, pushInvoiceToCloverAction } from "@/app/(app)/invoices/actions";
import { useSession } from "@/components/app/session-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, nowMs } from "@/lib/dates";

interface Props {
  invoice: { id: string; status: string; balance: number; clover_order_id: string | null; clover_pushed_at: string | null; clover_checkout_url: string | null; clover_checkout_expires_at: string | null };
  /** Deep link to the order in the Clover dashboard, computed server-side. */
  orderUrl: string | null;
  /** Whether the company has Clover on and configured. */
  enabled: boolean;
  hostedCheckout: boolean;
}

/** Invoice ↔ Clover status: the mirrored order and the pay-by-card link. */
export function CloverPanel({ invoice, orderUrl, enabled, hostedCheckout }: Props) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  if (!enabled || invoice.status === "void") return null;

  const expired = !!invoice.clover_checkout_expires_at && new Date(invoice.clover_checkout_expires_at).getTime() < nowMs();
  const canPay = invoice.balance > 0;

  function push() {
    if (demo) return toast.success("Sent to Clover as order ABC123 (simulated)");
    start(async () => {
      const r = await pushInvoiceToCloverAction(invoice.id);
      if (r.ok) {
        toast.success(`Clover order ${r.data.orderId} created`);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function makeLink() {
    if (demo) return toast.success("Pay-by-card link created (simulated)");
    start(async () => {
      const r = await createCheckoutLinkAction(invoice.id);
      if (r.ok) {
        toast.success("Pay-by-card link ready");
        router.refresh();
      } else toast.error(r.error);
    });
  }

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy; long-press the link instead");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <PlugZapIcon className="size-4 text-primary" /> Clover
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="font-medium">Clover order</div>
            <div className="text-caption text-muted-foreground">
              {invoice.clover_order_id ? (
                <>
                  <span className="font-mono">{invoice.clover_order_id}</span>
                  {invoice.clover_pushed_at ? ` · ${formatDateTime(invoice.clover_pushed_at)}` : ""}
                </>
              ) : (
                "Not in Clover yet"
              )}
            </div>
          </div>
          {invoice.clover_order_id && orderUrl ? (
            <Button asChild variant="outline" size="sm">
              <a href={orderUrl} target="_blank" rel="noreferrer">
                Open <ExternalLinkIcon />
              </a>
            </Button>
          ) : (
            <Button variant="outline" size="sm" loading={pending} onClick={push}>
              Push to Clover
            </Button>
          )}
        </div>

        {hostedCheckout && (
          <div className="flex items-center justify-between gap-3 border-t border-border pt-3">
            <div className="min-w-0">
              <div className="font-medium">Pay-by-card link</div>
              <div className="truncate text-caption text-muted-foreground">
                {!canPay ? "Paid in full" : invoice.clover_checkout_url ? (expired ? "Expired · make a new one" : `Active${invoice.clover_checkout_expires_at ? ` until ${formatDateTime(invoice.clover_checkout_expires_at)}` : ""}`) : "Included automatically when you email the invoice"}
              </div>
            </div>
            {canPay &&
              (invoice.clover_checkout_url && !expired ? (
                <div className="flex shrink-0 gap-1">
                  <Button variant="outline" size="icon-sm" aria-label="Copy pay link" onClick={() => copy(invoice.clover_checkout_url!)}>
                    {copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
                  </Button>
                  <Button asChild variant="outline" size="icon-sm" aria-label="Open pay link">
                    <a href={invoice.clover_checkout_url} target="_blank" rel="noreferrer">
                      <ExternalLinkIcon />
                    </a>
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" loading={pending} onClick={makeLink}>
                  {invoice.clover_checkout_url ? <RefreshCwIcon /> : <LinkIcon />} {invoice.clover_checkout_url ? "New link" : "Make link"}
                </Button>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
