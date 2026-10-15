"use client";

import { PrintButton } from "@/components/retail/print-button";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BanknoteIcon, CheckCircle2Icon, CopyIcon, CreditCardIcon, FileDownIcon, PenLineIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import type { RetailCharge } from "@/lib/db/types";
import { receiptLinkAction, recordRetailPaymentAction, retailChargeAction, signReceiptAction } from "@/app/(app)/jobs/actions";
import { useSession } from "@/components/app/session-provider";
import { payWithClover, useCloverBridge } from "@/lib/native/clover";
import { formatDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { paymentMethod } from "@/lib/retail/payment-labels";
import { detectPlatform, smsHref } from "@/lib/retail/phone";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad, signatureBlob } from "@/components/retail/signature-pad";

export interface RetailPaymentInfo {
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: "clover" | "cash" | "check" | "other" | null;
  payment_ref: string | null;
}

/** The methods the counter takes, what the reference box asks for, and the word the server expects. */
const METHODS = [
  { value: "card", label: "Card", ask: "Last 4 digits or approval code" },
  { value: "cash", label: "Cash", ask: "Note (optional)" },
  { value: "check", label: "Check", ask: "Check number" },
  { value: "zelle", label: "Zelle", ask: "Name or confirmation number" },
  { value: "venmo", label: "Venmo", ask: "@handle or confirmation" },
  { value: "other", label: "Other", ask: "How was it paid?" },
] as const;
type Method = (typeof METHODS)[number]["value"];

/** Other parts of the screen ask this card to open a step (the button at the bottom of the job). */
export const RO_EVENTS = { collect: "ro:collect", sign: "ro:sign" } as const;

/**
 * A retail (walk-in) job is paid at the counter, in as many payments as it
 * takes (part card, part cash). The card shows what is owed, how each part was
 * paid, and, once the balance is zero, the customer's signature for the car.
 * Inside the Clover app one tap opens the device's payment screen; the owner,
 * an admin or the advisor records cash, check, Zelle, Venmo or a card by hand.
 */
export function RetailPayment({ jobId, payment, charge, canRecordByHand, open, customerPhone = null }: { jobId: string; payment: RetailPaymentInfo; /** From retail_charge; null when unknown (demo without a charge). */ charge: RetailCharge | null; canRecordByHand: boolean; open: boolean; /** For the "Send to sign" text; without it the text opens with no recipient. */ customerPhone?: string | null }) {
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
  // The button at the bottom of the job asks this card to open the payment or the signature step.
  useEffect(() => {
    const collect = () => (inClover ? collectOnClover() : canRecordByHand ? setManual(true) : toast("Open this job on the Clover Flex to take the card"));
    const sign = () => setSigning(true);
    window.addEventListener(RO_EVENTS.collect, collect);
    window.addEventListener(RO_EVENTS.sign, sign);
    return () => {
      window.removeEventListener(RO_EVENTS.collect, collect);
      window.removeEventListener(RO_EVENTS.sign, sign);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inClover, canRecordByHand, jobId, demo]);

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

  /** A customer who is not at the counter signs the paid invoice from their own link (text it, or copy it). */
  async function sendToSign() {
    const r = await receiptLinkAction(jobId);
    if (!r.ok) return void toast.error(r.error);
    const body = `Your invoice from Cali Tints is paid. Please sign to confirm you received your vehicle: ${r.data.url}`;
    const href = smsHref(customerPhone, body, detectPlatform(navigator.userAgent)) ?? `sms:${detectPlatform(navigator.userAgent) === "ios" ? "&" : "?"}body=${encodeURIComponent(body)}`;
    window.location.href = href;
  }

  const paid = !!payment.paid_at;
  const ledger = charge?.payments ?? [];
  const received = ledger.filter((p) => p.kind === "balance").length;
  const partial = !paid && !!charge && received > 0;
  if (!paid && !open) return null;

  const ledgerList = ledger.length > 0 && (
    <div data-testid="retail-ledger">
      <div className="mb-1 text-caption font-medium text-muted-foreground">How it was paid</div>
      <ul className="divide-y divide-border rounded-lg border border-border text-sm">
        {ledger.map((p) => (
          <li key={p.id} className="flex items-baseline justify-between gap-3 px-3 py-2" data-method={p.method}>
            <div className="min-w-0">
              <div className="font-medium">{p.kind === "refund" ? "Refund" : p.kind === "deposit" ? "Deposit" : "Payment"} · {paymentMethod(p.method)}</div>
              <div className="text-caption text-subtle">
                {[p.note, p.provider_ref ? `ref ${p.provider_ref}` : null, p.paid_at ? formatDateTime(p.paid_at) : null].filter(Boolean).join(" · ")}
              </div>
            </div>
            {canPrices && p.amount !== null && <span className="shrink-0 font-semibold tabular-nums">{p.kind === "refund" ? "−" : ""}{formatMoney(p.amount)}</span>}
          </li>
        ))}
      </ul>
    </div>
  );

  if (paid) {
    const needsSignature = !!charge && !!charge.signature_required && !charge.has_signature;
    const pickedUp = !!charge?.picked_up_at;
    return (
      <Card data-testid="retail-payment">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2Icon className="size-4 text-success" /> Paid{pickedUp ? " · picked up" : ""}
          </CardTitle>
          <CardDescription>
            {formatDateTime(payment.paid_at)}
            {payment.paid_amount !== null && canPrices ? ` · ${formatMoney(payment.paid_amount)} in all` : ""}
            {pickedUp ? ` · picked up ${formatDateTime(charge!.picked_up_at)}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {ledgerList}
          {charge?.receipt_signed_name ? (
            <p className="text-sm" data-testid="receipt-signed">Signed for the car by <span className="font-medium">{charge.receipt_signed_name}</span>{charge.receipt_signed_at ? ` · ${formatDateTime(charge.receipt_signed_at)}` : ""}</p>
          ) : needsSignature ? (
            <div className="rounded-lg border border-warning/40 bg-warning/8 p-3 text-sm">
              <div className="font-medium">Paid. Now the customer signs for the car.</div>
              <Button size="sm" className="mt-2" onClick={() => setSigning(true)} data-testid="sign-receipt">
                <PenLineIcon /> Customer signs here
              </Button>
              {isAdmin && (
                <Button size="sm" variant="outline" className="ml-2 mt-2" onClick={sendToSign} data-testid="send-to-sign">
                  <SendIcon /> Send to sign
                </Button>
              )}
              <p className="mt-2 text-caption text-subtle">Not at the counter? Text them the link: they sign from their phone.</p>
            </div>
          ) : !pickedUp ? (
            <Button size="sm" variant="outline" className="justify-self-start" onClick={() => setSigning(true)} data-testid="sign-receipt">
              <PenLineIcon /> Add a signature
            </Button>
          ) : null}
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
            {canPrices && <PrintButton href={`/api/receipts/${jobId}/pdf`} size="sm" label="Print" testId="receipt-print-staff" />}
          </div>
        </CardContent>
        {signing && <SignDialog jobId={jobId} paidAmount={payment.paid_amount} paidAt={payment.paid_at} showMoney={!!canPrices} onClose={() => setSigning(false)} />}
      </Card>
    );
  }

  return (
    <Card data-testid="retail-payment">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCardIcon className="size-4 text-primary" /> {partial ? "Part paid" : "Collect at the counter"}
        </CardTitle>
        <CardDescription>{inClover ? "Opens this Clover's payment screen for what is left." : "Open this job on the Clover Flex to take the card, or record how they paid below. Part card and part cash is fine."}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {charge && (
          <div data-testid="amount-due">
            <div className="text-caption text-muted-foreground">{partial ? "Left to collect" : charge.deposit_paid > 0 ? "Balance to collect" : "Total to collect"}</div>
            <div className="text-lg font-semibold tabular-nums">{formatMoney(charge.balance)}</div>
            {(partial || charge.deposit_paid > 0) && <div className="text-caption text-subtle" data-testid="deposit-applied">{formatMoney(charge.total)} total{charge.deposit_paid > 0 ? ` · ${formatMoney(charge.deposit_paid)} deposit paid` : ""}{charge.paid > 0 ? ` · ${formatMoney(charge.paid)} paid so far` : ""}</div>}
          </div>
        )}
        {ledgerList}
        <div className="flex flex-wrap gap-2">
          {inClover && (
            <Button onClick={collectOnClover} loading={pending} data-testid="collect-on-clover">
              <CreditCardIcon /> Collect on this Clover
            </Button>
          )}
          {canRecordByHand && (
            <Button variant={inClover ? "outline" : "default"} onClick={() => setManual(true)} data-testid="record-by-hand">
              <BanknoteIcon /> Record a payment
            </Button>
          )}
        </div>
        {manual && (
          <PayDialog
            balance={charge?.balance ?? null}
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

/** The customer signs for the car after paying: a name and a finger on the screen, kept with the job and printed on the invoice. */
function SignDialog({ jobId, paidAmount, paidAt, showMoney, onClose }: { jobId: string; paidAmount: number | null; paidAt: string | null; showMoney: boolean; onClose: () => void }) {
  const [agree, setAgree] = useState(false);
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [hasInk, setHasInk] = useState(false);
  const padRef = useRef<HTMLDivElement>(null);
  function submit() {
    if (name.trim().length < 2) return void toast.error("Type the customer's name");
    if (!hasInk) return void toast.error("Ask them to sign in the box");
    if (!agree) return void toast.error("They agree to sign electronically first");
    start(async () => {
      if (demo) {
        toast.success("Signed", { description: "Guest preview — nothing changed" });
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
      toast.success("Signed");
      onClose();
      router.refresh();
    });
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Customer signs for the car</DialogTitle>
          <DialogDescription>
            I received my vehicle, the work was done as described, and I paid{showMoney && paidAmount !== null ? ` ${formatMoney(paidAmount)}` : " in full"}{paidAt ? ` on ${formatDateTime(paidAt)}` : ""}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="rs-name">Name</Label>
            <Input id="rs-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} autoComplete="off" />
          </div>
          <label className="flex items-start gap-2 text-sm" data-testid="sign-consent">
            <input type="checkbox" checked={agree} onChange={(ev) => setAgree(ev.target.checked)} className="mt-1 size-4 accent-[var(--primary)]" />
            <span>I agree to sign electronically.</span>
          </label>
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

/** One payment by hand: how it was paid, how much (the rest stays open), and a reference. */
function PayDialog({ balance, onClose, onSave }: { balance: number | null; onClose: () => void; onSave: (amount: number, method: Method, reference: string) => void }) {
  const [amount, setAmount] = useState(balance !== null ? String(balance) : "");
  const [method, setMethod] = useState<Method>("cash");
  const [reference, setReference] = useState("");
  const n = Number(amount);
  const m = METHODS.find((x) => x.value === method)!;
  const left = balance !== null && n > 0 ? Math.round((balance - n) * 100) / 100 : null;
  const tooMuch = left !== null && left < 0;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto" data-testid="pay-dialog">
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>How they paid{balance !== null ? ` (left to collect ${formatMoney(balance)})` : ""}. Part now and part later is fine.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Paid by</Label>
            <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Paid by">
              {METHODS.map((x) => (
                <button key={x.value} type="button" role="radio" aria-checked={method === x.value} onClick={() => setMethod(x.value)} data-testid={`pay-method-${x.value}`} className={cn("min-h-11 rounded-lg border text-sm font-medium transition-colors", method === x.value ? "border-primary bg-accent-soft text-primary" : "border-border text-muted-foreground hover:text-foreground")}>
                  {x.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rp-amount">Amount</Label>
            <Input id="rp-amount" data-testid="pay-amount" type="number" inputMode="decimal" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={tooMuch} />
            {tooMuch && <p className="text-caption text-destructive">That is more than what is left.</p>}
            {left !== null && left > 0 && <p className="text-caption text-subtle" data-testid="pay-left">{formatMoney(left)} will still be left.</p>}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rp-ref">{m.ask}</Label>
            <Input id="rp-ref" data-testid="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={80} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={!(n > 0) || tooMuch} onClick={() => onSave(n, method, reference.trim())} data-testid="pay-save">
            Record {n > 0 ? formatMoney(n) : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
