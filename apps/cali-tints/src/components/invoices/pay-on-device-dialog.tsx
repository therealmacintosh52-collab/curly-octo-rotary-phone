"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircleIcon, TabletSmartphoneIcon } from "lucide-react";
import { toast } from "sonner";
import { cancelDevicePaymentAction } from "@/app/(app)/invoices/actions";
import type { ActionResult } from "@/app/(app)/jobs/actions";
import { useSession } from "@/components/app/session-provider";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Hint, Label } from "@/components/ui/label";

export interface CardResult {
  amount: number;
  last4: string | null;
}

/**
 * Send the amount to the Clover terminal; the customer taps or inserts their
 * card on the device. The request stays open until the device answers.
 * `send` does the server work (invoice payment or terminal sale).
 */
export function PayOnDeviceDialog({
  subtitle,
  balance,
  lockAmount = false,
  onDone,
  send,
}: {
  subtitle: string;
  /** Maximum (and default) amount. */
  balance: number;
  /** Amount was entered elsewhere (the Terminal keypad): no amount field. */
  lockAmount?: boolean;
  onDone: (r: CardResult) => void;
  send: (input: { amount: number }) => Promise<ActionResult<CardResult>>;
}) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [cancelling, startCancel] = useTransition();
  const [amount, setAmount] = useState(balance.toFixed(2));
  const [waiting, setWaiting] = useState(false);
  const n = Number(amount);
  const valid = Number.isFinite(n) && n > 0 && n <= balance + 0.005;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setWaiting(true);
    const rounded = Math.round(n * 100) / 100;
    if (demo) {
      setTimeout(() => {
        setWaiting(false);
        toast.success(`Terminal took ${formatMoney(rounded)} · VISA 4242`, { description: "Guest preview — not actually charged" });
        onDone({ amount: rounded, last4: "4242" });
      }, 1800);
      return;
    }
    start(async () => {
      const r = await send({ amount: rounded });
      setWaiting(false);
      if (r.ok) {
        toast.success(`Terminal took ${formatMoney(r.data.amount)}${r.data.last4 ? ` · card ending ${r.data.last4}` : ""}`);
        onDone(r.data);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  function cancel() {
    if (demo) {
      setWaiting(false);
      return;
    }
    startCancel(async () => {
      const r = await cancelDevicePaymentAction();
      if (!r.ok) toast.error(r.error);
    });
  }

  return (
    <DialogContent showCloseButton={!waiting}>
      <form onSubmit={submit} className="grid gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TabletSmartphoneIcon className="size-5 text-primary" /> Pay on the Clover terminal
          </DialogTitle>
          <DialogDescription>{subtitle}. The amount appears on the device; the customer taps, inserts or swipes.</DialogDescription>
        </DialogHeader>

        {waiting ? (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-primary/30 bg-accent-soft px-4 py-8 text-center">
            <LoaderCircleIcon className="size-8 animate-spin text-primary" />
            <div className="text-lg font-semibold tabular-nums">{formatMoney(n)}</div>
            <div className="text-sm text-muted-foreground">Waiting for the card on the terminal…</div>
          </div>
        ) : lockAmount ? (
          <div className="rounded-xl border border-border bg-surface-2 px-4 py-3 text-center text-2xl font-semibold tabular-nums">{formatMoney(n)}</div>
        ) : (
          <div className="grid gap-1.5">
            <Label htmlFor="device-amount">Amount</Label>
            <Input id="device-amount" inputMode="decimal" type="number" step="0.01" min="0.01" max={balance} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
            {n > 0 && n < balance && <Hint tone="warning">Partial payment; {formatMoney(balance - n)} stays open.</Hint>}
          </div>
        )}

        <DialogFooter>
          {waiting ? (
            <Button type="button" variant="outline" loading={cancelling} onClick={cancel}>
              Cancel on device
            </Button>
          ) : (
            <Button type="submit" loading={pending} disabled={!valid}>
              Send {valid ? formatMoney(n) : ""} to terminal
            </Button>
          )}
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
