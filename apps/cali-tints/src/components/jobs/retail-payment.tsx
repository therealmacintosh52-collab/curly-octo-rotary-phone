"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BanknoteIcon, CheckCircle2Icon, CopyIcon, CreditCardIcon, FileDownIcon, PenLineIcon } from "lucide-react";
import { toast } from "sonner";
import type { RetailCharge } from "@/lib/db/types";
import { receiptLinkAction, recordRetailPaymentAction, retailChargeAction, signReceiptAction } from "@/app/(app)/jobs/actions";
import { useSession } from "@/components/app/session-provider";
import { payWithClover, useCloverBridge } from "@/lib/native/clover";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SignaturePad, signatureBlob } from "@/components/retail/signature-pad";

export interface RetailPaymentInfo {
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: "clover" | "cash" | "check" | "other" | null;
  payment_ref: string | null;
}

const METHOD_LABEL = { clover: "Card on the Clover", cash: "Cash", check: "Check", other: "Other" } as const;
const LEDGER_METHOD: Record<string, string> = { clover_online: "card online", clover_flex: "card at the counter", cash: "cash", check: "check", other: "other" };

/**
 * A retail (walk-in) job is paid at the counter. The card shows the balance
 * (total minus the deposit already paid); inside the Clover app one tap opens
 * the device's payment screen for it; the owner or an admin can record cash
 * or a check. Once paid, the customer signs the receipt on the screen and the
 * receipt link / PDF are ready. Per-service prices never appear on a job.
 */
export function RetailPayment({ jobId, payment, charge, canRecordByHand, open }: { jobId: string; payment: RetailPaymentInfo; /** From retail_charge; null when unknown (demo without a charge). */ charge: RetailCharge | null; canRecordByHand: boolean; open: boolean }) {
  const router = useRouter();
  const { demo, isAdmin, canPrices } = useSession();
  const inClover = useCloverBridge();
  const [pending, start] = useTransition();
  const [manual, setManual] = useState(false);
  const [signing, setSigning] = useState(false);

  function collectOnClover() {
    start(async () => {
      if (demo) {
        toast.success("Paid on the Clover", { description: "Guest preview — a card payment was simulated" });
        return;
      }
      const c = await retailChargeAction(jobId);
      if (!c.ok) return void toast.error(c.error);
      try {
        const r = await payWithClover({ amountCents: c.data.amount_cents, externalId: jobId, note: `Cali Tint · ${c.data.tag}` });
        const rec = await recordRetailPaymentAction(jobId, { amount: r.amountCents / 100, method: "clover", reference: r.paymentId });
        if (!rec.ok) return void toast.error(rec.error);
        toast.success(`Paid on the Clover${r.last4 ? ` · card ending ${r.last4}` : ""}`);
        router.refresh();
      } catch (err) {
        const e = err as Error & { code?: string };
        if (e.code === "cancelled") toast("Payment cancelled");
        else toast.error(e.message || "The Clover did not take the payment");
      }
    });
  }
  async function copyReceipt() {
    const r = await receiptLinkAction(jobId);
    if (!r.ok) return void toast.error(r.error);
    try {
      await navigator.clipboard.writeText(r.data.url);
      toast.success("Receipt link copied");
    } catch {
      toast.error("Could not copy");
    }
  }

  if (payment.paid_at) {
    const needsSignature = !!charge && charge.signature_required && !charge.has_signature;
    return (
      <Card data-testid="retail-payment">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2Icon className="size-4 text-success" /> Paid at the counter
          </CardTitle>
          <CardDescription>
            {METHOD_LABEL[payment.payment_method ?? "other"]} · {formatDateTime(payment.paid_at)}
            {payment.paid_amount !== null ? ` · ${formatMoney(payment.paid_amount)}` : ""}
            {payment.payment_ref ? ` · ref ${payment.payment_ref}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {charge && charge.payments.length > 0 && (
            <ul className="text-caption text-subtle" data-testid="retail-ledger">
              {charge.payments.map((p) => (
                <li key={p.id}>{p.kind === "refund" ? "Refund" : p.kind === "deposit" ? "Deposit" : "Balance"} · {LEDGER_METHOD[p.method] ?? p.method}{canPrices && p.amount !== null ? ` · ${formatMoney(p.amount)}` : ""}{p.paid_at ? ` · ${formatDateTime(p.paid_at)}` : ""}</li>
              ))}
            </ul>
          )}
          {charge?.receipt_signed_name ? (
            <p className="text-sm" data-testid="receipt-signed">Receipt signed by <span className="font-medium">{charge.receipt_signed_name}</span>{charge.receipt_signed_at ? ` · ${formatDateTime(charge.receipt_signed_at)}` : ""}</p>
          ) : needsSignature ? (
            <div className="rounded-lg border border-warning/40 bg-warning/8 p-3 text-sm">
              <div className="font-medium">The customer signs the receipt at pickup.</div>
              <Button size="sm" className="mt-2" onClick={() => setSigning(true)} data-testid="sign-receipt">
                <PenLineIcon /> Sign the receipt
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="justify-self-start" onClick={() => setSigning(true)} data-testid="sign-receipt">
              <PenLineIcon /> Add a signature
            </Button>
          )}
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <Button size="sm" variant="outline" onClick={copyReceipt} data-testid="receipt-link">
                <CopyIcon /> Receipt link
              </Button>
            )}
            {canPrices && (
              <Button asChild size="sm" variant="outline">
                <a href={`/api/receipts/${jobId}/pdf`} data-testid="receipt-pdf-staff"><FileDownIcon /> Receipt PDF</a>
              </Button>
            )}
          </div>
        </CardContent>
        {signing && <SignDialog jobId={jobId} onClose={() => setSigning(false)} />}
      </Card>
    );
  }

  if (!open) return null;

  return (
    <Card data-testid="retail-payment">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCardIcon className="size-4 text-primary" /> Collect at the counter
        </CardTitle>
        <CardDescription>{inClover ? "Opens this Clover's payment screen for the balance." : "Open this job on the Clover Flex to take the card; the owner or an admin can record cash or a check here."}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        {charge && (
          <div className="mr-auto" data-testid="amount-due">
            <div className="text-caption text-muted-foreground">{charge.deposit_paid > 0 ? "Balance to collect" : "Total to collect"}</div>
            <div className="text-lg font-semibold tabular-nums">{formatMoney(charge.balance)}</div>
            {charge.deposit_paid > 0 && <div className="text-caption text-subtle" data-testid="deposit-applied">{formatMoney(charge.total)} total · {formatMoney(charge.deposit_paid)} deposit paid</div>}
          </div>
        )}
        {inClover && (
          <Button onClick={collectOnClover} loading={pending} data-testid="collect-on-clover">
            <CreditCardIcon /> Collect on this Clover
          </Button>
        )}
        {canRecordByHand && (
          <Button variant="outline" onClick={() => setManual(true)} data-testid="record-by-hand">
            <BanknoteIcon /> Record cash / check
          </Button>
        )}
        {manual && (
          <ManualDialog
            suggested={charge?.balance ?? null}
            onClose={() => setManual(false)}
            onSave={(amount, method, reference) =>
              start(async () => {
                if (demo) {
                  toast.success("Payment recorded", { description: "Guest preview — nothing changed" });
                  setManual(false);
                  return;
                }
                const r = await recordRetailPaymentAction(jobId, { amount, method, reference });
                if (!r.ok) return void toast.error(r.error);
                toast.success("Payment recorded");
                setManual(false);
                router.refresh();
              })
            }
          />
        )}
      </CardContent>
    </Card>
  );
}

/** The pickup signature: a name and a finger on the screen, saved under the job and printed on the receipt. */
function SignDialog({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [hasInk, setHasInk] = useState(false);
  const padRef = useRef<HTMLDivElement>(null);
  function submit() {
    if (name.trim().length < 2) return void toast.error("Type the customer's name");
    if (!hasInk) return void toast.error("Ask them to sign in the box");
    start(async () => {
      if (demo) {
        toast.success("Receipt signed", { description: "Guest preview — nothing changed" });
        onClose();
        return;
      }
      const blob = await signatureBlob(padRef.current);
      if (!blob) return void toast.error("Could not read the signature");
      const fd = new FormData();
      fd.append("signature", blob, "signature.png");
      const res = await fetch(`/api/jobs/${jobId}/receipt-signature`, { method: "POST", body: fd });
      const body = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
      if (!res.ok || !body.path) return void toast.error(body.error ?? "Could not save the signature");
      const r = await signReceiptAction(jobId, body.path, name);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Receipt signed");
      onClose();
      router.refresh();
    });
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign the receipt</DialogTitle>
          <DialogDescription>Hand the phone to the customer: their name and a signature go on the receipt.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="rs-name">Name</Label>
            <Input id="rs-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="off" />
          </div>
          <div ref={padRef}>
            <SignaturePad onChange={setHasInk} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Not now</Button>
          <Button onClick={submit} loading={pending} data-testid="sign-receipt-confirm">Save the signature</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ManualDialog({ suggested, onClose, onSave }: { suggested: number | null; onClose: () => void; onSave: (amount: number, method: "cash" | "check" | "other", reference: string) => void }) {
  const [amount, setAmount] = useState(suggested !== null ? String(suggested) : "");
  const [method, setMethod] = useState<"cash" | "check" | "other">("cash");
  const [reference, setReference] = useState("");
  const n = Number(amount);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a counter payment</DialogTitle>
          <DialogDescription>Cash or a check taken for this car{suggested !== null ? ` (balance ${formatMoney(suggested)})` : ""}. Card payments go through the Clover.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="rp-amount">Amount</Label>
            <Input id="rp-amount" type="number" inputMode="decimal" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rp-method">Method</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as typeof method)}>
              <SelectTrigger id="rp-method">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">Cash</SelectItem>
                <SelectItem value="check">Check</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rp-ref">Reference (optional)</Label>
            <Input id="rp-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Check number" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!(n > 0)} onClick={() => onSave(n, method, reference.trim())}>
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
