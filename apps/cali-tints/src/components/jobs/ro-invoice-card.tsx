"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileTextIcon, ShieldAlertIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import type { RoAuthorization } from "@/lib/db/types";
import { convertRoToInvoiceAction } from "@/app/(app)/jobs/actions";
import { useSession } from "@/components/app/session-provider";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const KIND: Record<RoAuthorization["kind"], string> = { initial: "Check-in authorization", estimate: "Estimate approved", change_order: "Change order approved" };
const HOW: Record<RoAuthorization["method"], string> = { online: "on their phone", in_person: "in person", phone: "by phone", email: "by email" };

/**
 * The authorization record of a retail repair order, and the step that turns it
 * into the customer's invoice (advisor, admin, owner). Work nobody authorized
 * is flagged and blocks the invoice: that is where the disputes come from.
 */
export function RoInvoiceCard({ jobId, authorizations, unauthorized, lineCount, invoiced, canConvert, showMoney }: { jobId: string; authorizations: RoAuthorization[]; unauthorized: number; lineCount: number; invoiced: boolean; canConvert: boolean; showMoney: boolean }) {
  const router = useRouter();
  const { demo } = useSession();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const blocked = unauthorized > 0 || lineCount === 0;

  function convert() {
    start(async () => {
      if (demo) {
        toast.success("Invoice made", { description: "Guest preview — nothing changed" });
        setOpen(false);
        return;
      }
      const r = await convertRoToInvoiceAction(jobId);
      if (!r.ok) return void toast.error(r.error);
      toast.success(`Invoice ${r.data.invoice_number} made`);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Card data-testid="ro-authorizations">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          {unauthorized > 0 ? <ShieldAlertIcon className="size-4 text-warning" /> : <ShieldCheckIcon className="size-4 text-success" />} Authorization
        </CardTitle>
        {unauthorized > 0 ? <Badge variant="warning" data-testid="ro-unauthorized">{unauthorized} not authorized</Badge> : authorizations.length > 0 ? <Badge variant="success">Covered</Badge> : null}
      </CardHeader>
      <CardContent className="grid gap-3">
        {authorizations.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing is authorized yet. Check the car in with the customer, or get an estimate approved, before the work starts.</p>
        ) : (
          <ul className="divide-y divide-border text-sm" data-testid="ro-authorization-list">
            {authorizations.map((a) => (
              <li key={a.id} className="grid gap-0.5 py-2" data-kind={a.kind}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">{KIND[a.kind]}</span>
                  {showMoney && a.amount !== null && <span className="tabular-nums">{formatMoney(a.amount)}</span>}
                </div>
                <div className="text-caption text-muted-foreground">
                  {a.name} · {HOW[a.method]} · {formatDateTime(a.authorized_at)}{a.has_signature ? " · signature on file" : ""}
                </div>
              </li>
            ))}
          </ul>
        )}
        {unauthorized > 0 && <p className="text-caption text-warning">Work on this RO is not covered by an approval. Write an estimate for it and get the customer to approve before it is invoiced.</p>}
        {!invoiced && canConvert && (
          <>
            <Button onClick={() => setOpen(true)} disabled={blocked} data-testid="ro-convert"><FileTextIcon /> Convert to invoice</Button>
            {lineCount === 0 && <p className="text-caption text-subtle">No approved work on this RO yet.</p>}
          </>
        )}
        {invoiced && canConvert && (
          <Button asChild variant="outline"><Link href={`/retail/invoices/${jobId}`}><FileTextIcon /> Open the invoice</Link></Button>
        )}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="ro-convert-dialog">
          <DialogHeader>
            <DialogTitle>Convert to invoice</DialogTitle>
            <DialogDescription>The invoice is made from the approved lines on this RO, nothing retyped. After this the customer can pay at the counter.</DialogDescription>
          </DialogHeader>
          <ul className="grid gap-1 text-sm text-muted-foreground">
            <li>{lineCount} approved {lineCount === 1 ? "line" : "lines"}, all covered by an authorization.</li>
            <li>It gets the next RI- number; it never goes to QuickBooks.</li>
          </ul>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Not yet</Button>
            <Button onClick={convert} loading={pending} data-testid="ro-convert-confirm">Make the invoice</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
