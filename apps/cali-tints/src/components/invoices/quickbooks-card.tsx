"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpenCheckIcon, ExternalLinkIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import type { Invoice } from "@/lib/db/types";
import { pushInvoiceToQuickBooksAction } from "@/app/(app)/invoices/actions";
import { useSession } from "@/components/app/session-provider";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Where this invoice stands in QuickBooks: sent (with its id and balance there), failed, or waiting. Owner only. */
export function InvoiceQuickBooksCard({ invoice, connected, appUrl }: { invoice: Invoice; connected: boolean; appUrl: string | null }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const synced = !!invoice.quickbooks_invoice_id;
  const canSend = connected && invoice.status !== "void";

  function send() {
    if (demo) return toast.success("Sent to QuickBooks", { description: "Guest preview — nothing changed" });
    start(async () => {
      const r = await pushInvoiceToQuickBooksAction(invoice.id);
      if (r.ok) {
        toast.success(`${synced ? "Updated" : "Created"} in QuickBooks${r.data.docNumber ? ` as ${r.data.docNumber}` : ""}`);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <Card data-testid="invoice-quickbooks">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpenCheckIcon className="size-4 text-primary" /> QuickBooks
          {synced && !invoice.quickbooks_error && <Badge variant="success">Sent</Badge>}
          {invoice.quickbooks_error && <Badge variant="destructive">Failed</Badge>}
        </CardTitle>
        {canSend && (
          <CardAction>
            <Button size="sm" variant={synced ? "ghost" : "outline"} loading={pending} onClick={send} data-testid="quickbooks-send">
              <SendIcon /> {synced ? "Resend" : "Send to QuickBooks"}
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="text-sm">
        {!connected ? (
          <p className="text-muted-foreground">
            Not connected.{" "}
            <Link href="/settings#quickbooks" className="text-primary underline-offset-4 hover:underline">
              Connect QuickBooks in Settings
            </Link>{" "}
            and every invoice goes over on its own.
          </p>
        ) : synced ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <dt className="text-muted-foreground">Invoice</dt>
            <dd className="flex items-center gap-2">
              {invoice.quickbooks_doc_number ?? invoice.display_number}
              {appUrl && (
                <a href={`${appUrl}/app/invoice?txnId=${invoice.quickbooks_invoice_id}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  Open <ExternalLinkIcon className="size-3.5" />
                </a>
              )}
            </dd>
            <dt className="text-muted-foreground">Balance there</dt>
            <dd className="tabular-nums">{invoice.quickbooks_balance === null ? "—" : formatMoney(invoice.quickbooks_balance)}</dd>
            <dt className="text-muted-foreground">Last sync</dt>
            <dd>{invoice.quickbooks_balance_at ? formatDateTime(invoice.quickbooks_balance_at) : invoice.quickbooks_synced_at ? formatDateTime(invoice.quickbooks_synced_at) : "—"}</dd>
          </dl>
        ) : (
          <p className="text-muted-foreground">{invoice.status === "void" ? "Void invoices are not sent." : "Not in QuickBooks yet. The daily sync sends it, or send it now."}</p>
        )}
        {invoice.quickbooks_error && <p className="mt-2 text-destructive">{invoice.quickbooks_error}</p>}
      </CardContent>
    </Card>
  );
}
