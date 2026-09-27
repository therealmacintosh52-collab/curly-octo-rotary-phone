"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Undo2Icon } from "lucide-react";
import { toast } from "sonner";
import type { TerminalTransaction } from "@/lib/db/types";
import { refundSaleAction } from "@/app/(app)/terminal/actions";
import { useSession } from "@/components/app/session-provider";
import { formatMoney } from "@/lib/money";
import { paidWith, receiptNumber } from "@/lib/terminal/receipt";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Hint, Label } from "@/components/ui/label";

/** Refund part or all of a sale. Card refunds go back to the same card through Clover. */
export function RefundDialog({ tx, onDone }: { tx: TerminalTransaction; onDone: (refund: TerminalTransaction) => void }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const remaining = Math.round((Number(tx.amount) - Number(tx.refunded_amount)) * 100) / 100;
  const [amount, setAmount] = useState(remaining.toFixed(2));
  const n = Number(amount);
  const valid = Number.isFinite(n) && n > 0 && n <= remaining + 0.005;
  // Rows straight from invoice_payments (no ledger row yet) carry their own id as payment_id.
  const unlinked = tx.payment_id === tx.id;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    const rounded = Math.min(Math.round(n * 100) / 100, remaining);
    if (demo) {
      toast.success(`Refunded ${formatMoney(rounded)}`, { description: "Guest preview — nothing refunded" });
      const stamp = Date.now();
      onDone({ ...tx, id: `${stamp.toString(16).padStart(12, "0").slice(-8)}-0000-4000-8000-${stamp.toString().padStart(12, "0").slice(-12)}`, kind: "refund", status: "captured", amount: rounded, refunded_amount: 0, refund_of: tx.id, receipt_sent_at: null, at: new Date().toISOString() });
      return;
    }
    start(async () => {
      const r = await refundSaleAction(unlinked ? { paymentId: tx.id, amount: rounded } : { saleId: tx.id, amount: rounded });
      if (r.ok) {
        toast.success(`Refunded ${formatMoney(r.data.amount)}`);
        onDone(r.data);
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <DialogContent>
      <form onSubmit={submit} className="grid gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Undo2Icon className="size-5 text-warning" /> Refund {receiptNumber(tx)}
          </DialogTitle>
          <DialogDescription>
            {formatMoney(tx.amount)} paid with {paidWith(tx)}
            {Number(tx.refunded_amount) > 0 ? `; ${formatMoney(tx.refunded_amount)} already refunded` : ""}.{tx.method === "card" ? " The money goes back to the same card." : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="refund-amount">Amount to refund</Label>
          <Input id="refund-amount" type="number" inputMode="decimal" step="0.01" min="0.01" max={remaining} value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus />
          {valid && n < remaining - 0.004 ? <Hint tone="warning">Partial refund; {formatMoney(remaining - n)} of the sale stays.</Hint> : <Hint>Up to {formatMoney(remaining)}.</Hint>}
          {tx.invoice_number && <Hint>Invoice {tx.invoice_number} goes back to unpaid for this amount.</Hint>}
        </div>
        <DialogFooter>
          <Button type="submit" variant="destructive" loading={pending} disabled={!valid}>
            Refund {valid ? formatMoney(n) : ""}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
