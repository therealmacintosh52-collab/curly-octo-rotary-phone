"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, CircleAlertIcon, FileTextIcon, ShieldAlertIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import type { InvoiceReview, RoAuthorization } from "@/lib/db/types";
import { convertRoToInvoiceAction } from "@/app/(app)/jobs/actions";
import { useSession } from "@/components/app/session-provider";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** The button at the bottom of the job asks this card to open the convert step. */
export const RO_CONVERT_EVENT = "ro:convert";

const KIND: Record<RoAuthorization["kind"], string> = { initial: "Check-in authorization", estimate: "Estimate approved", change_order: "Change order approved" };
const HOW: Record<RoAuthorization["method"], string> = { online: "on their phone", in_person: "in person", phone: "by phone", email: "by email" };

/**
 * The authorization record of a retail repair order, and the step that turns it
 * into the customer's invoice (advisor, admin, owner). Work nobody authorized
 * is flagged and blocks the invoice: that is where the disputes come from.
 */
export function RoInvoiceCard({ jobId, authorizations, unauthorized, lineCount, invoiced, canConvert, showMoney, review }: { jobId: string; authorizations: RoAuthorization[]; unauthorized: number; lineCount: number; invoiced: boolean; canConvert: boolean; showMoney: boolean; /** The review against the approved amounts; null when the viewer may not price. */ review?: InvoiceReview | null }) {
  const router = useRouter();
  const { demo } = useSession();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  // The server decides (ro_invoice_review); without a review the older checks still gate the button.
  useEffect(() => {
    const openIt = () => setOpen(true);
    window.addEventListener(RO_CONVERT_EVENT, openIt);
    return () => window.removeEventListener(RO_CONVERT_EVENT, openIt);
  }, []);
  const blocked = review ? !review.ready : unauthorized > 0 || lineCount === 0;
  const checks: { ok: boolean; label: string }[] = review
    ? [
        { ok: review.unauthorized === 0, label: review.unauthorized === 0 ? "Every line is authorized" : `${review.unauthorized} ${review.unauthorized === 1 ? "line is" : "lines are"} not authorized` },
        { ok: review.completed, label: review.completed ? "The tech finished the work" : "The tech has not marked the work done" },
        { ok: review.jobs_not_done === 0, label: review.jobs_not_done === 0 ? "Every approved job has its cause and correction" : `${review.jobs_not_done} approved ${review.jobs_not_done === 1 ? "job is" : "jobs are"} not done` },
        { ok: review.qc, label: review.qc ? "Quality check signed off" : "Quality check not signed off" },
        { ok: review.matches, label: review.matches ? (showMoney ? `RO total ${formatMoney(review.ro_total)} matches the approved amounts` : "RO total matches the approved amounts") : "RO total does not match the approved amounts" },
      ]
    : [];

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
            {checks.length > 0 && (
              <ul className="grid gap-1 text-sm" data-testid="ro-review">
                {checks.map((c, i) => (
                  <li key={i} className={`flex items-start gap-2 ${c.ok ? "text-muted-foreground" : "text-foreground"}`} data-ok={c.ok}>
                    {c.ok ? <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-success" /> : <CircleAlertIcon className="mt-0.5 size-4 shrink-0 text-warning" />}
                    <span>{c.label}</span>
                  </li>
                ))}
              </ul>
            )}
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
            <li>{lineCount} approved {lineCount === 1 ? "line" : "lines"}, all covered by an authorization{review ? ", the work done and checked" : ""}.</li>
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
