"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BanknoteIcon, CheckCircle2Icon, CreditCardIcon } from "lucide-react";
import { toast } from "sonner";
import { recordRetailPaymentAction, retailChargeAction } from "@/app/(app)/jobs/actions";
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

export interface RetailPaymentInfo {
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: "clover" | "cash" | "check" | "other" | null;
  payment_ref: string | null;
}

const METHOD_LABEL = { clover: "Card on the Clover", cash: "Cash", check: "Check", other: "Other" } as const;

/**
 * A retail (walk-in) job is paid at the counter. Inside the Clover app one
 * tap opens the device's payment screen for the job's total; the result is
 * written back to the job. The owner or an admin can also record cash or a
 * check by hand. Nobody but owner/admin sees the amount in the app itself.
 */
export function RetailPayment({ jobId, payment, canRecordByHand, showMoney, open }: { jobId: string; payment: RetailPaymentInfo; canRecordByHand: boolean; showMoney: boolean; open: boolean }) {
  const router = useRouter();
  const { demo } = useSession();
  const inClover = useCloverBridge();
  const [pending, start] = useTransition();
  const [manual, setManual] = useState(false);

  function collectOnClover() {
    start(async () => {
      if (demo) {
        toast.success("Paid on the Clover", { description: "Guest preview — a card payment was simulated" });
        return;
      }
      const charge = await retailChargeAction(jobId);
      if (!charge.ok) return void toast.error(charge.error);
      try {
        const r = await payWithClover({ amountCents: charge.data.amount_cents, externalId: jobId, note: `Cali Tint · Stock ${charge.data.tag}` });
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

  if (payment.paid_at) {
    return (
      <Card data-testid="retail-payment">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2Icon className="size-4 text-success" /> Paid at the counter
          </CardTitle>
          <CardDescription>
            {METHOD_LABEL[payment.payment_method ?? "other"]} · {formatDateTime(payment.paid_at)}
            {showMoney && payment.paid_amount !== null ? ` · ${formatMoney(payment.paid_amount)}` : ""}
            {payment.payment_ref ? ` · ref ${payment.payment_ref}` : ""}
          </CardDescription>
        </CardHeader>
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
        <CardDescription>{inClover ? "Opens this Clover's payment screen for the job's total." : "Open this job on the Clover Flex to take the card; the owner can record cash or a check here."}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
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

function ManualDialog({ onClose, onSave }: { onClose: () => void; onSave: (amount: number, method: "cash" | "check" | "other", reference: string) => void }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<"cash" | "check" | "other">("cash");
  const [reference, setReference] = useState("");
  const n = Number(amount);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a counter payment</DialogTitle>
          <DialogDescription>Cash or a check taken for this car. Card payments go through the Clover.</DialogDescription>
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
