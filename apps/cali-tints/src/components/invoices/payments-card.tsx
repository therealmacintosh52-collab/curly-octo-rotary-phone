"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { toast } from "sonner";
import type { InvoicePayment, InvoiceStatus, PaymentMethod } from "@/lib/db/types";
import { deletePaymentAction, recordPaymentAction } from "@/app/(app)/invoices/actions";
import { formatMoney } from "@/lib/money";
import { formatDateOnly, toDateInput } from "@/lib/dates";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "check", label: "Check" },
  { value: "ach", label: "ACH / wire" },
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
  { value: "other", label: "Other" },
];

export function PaymentsCard({ invoiceId, payments, balance, status }: { invoiceId: string; payments: InvoicePayment[]; balance: number; status: InvoiceStatus }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payments</CardTitle>
        <CardAction>
          {status !== "void" && balance > 0 && (
            <Button size="sm" onClick={() => setOpen(true)}>
              <PlusIcon /> Record
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent>
        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments recorded.</p>
        ) : (
          <ul className="divide-y divide-border text-sm">
            {payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                <div>
                  <div className="font-medium tabular-nums">{formatMoney(p.amount)}</div>
                  <div className="text-xs text-muted-foreground">
                    {formatDateOnly(p.paid_at)} · {METHODS.find((m) => m.value === p.method)?.label}
                    {p.reference ? ` #${p.reference}` : ""}
                    {p.note ? ` · ${p.note}` : ""}
                  </div>
                </div>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Remove payment"
                  className="text-muted-foreground hover:text-destructive"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(`Remove the ${formatMoney(p.amount)} payment?`)) return;
                    start(async () => {
                      const r = await deletePaymentAction(p.id, invoiceId);
                      if (r.ok) router.refresh();
                      else toast.error(r.error);
                    });
                  }}
                >
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <PaymentDialog invoiceId={invoiceId} balance={balance} onDone={() => setOpen(false)} />
      </Dialog>
    </Card>
  );
}

function PaymentDialog({ invoiceId, balance, onDone }: { invoiceId: string; balance: number; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState(balance.toFixed(2));
  const [paidAt, setPaidAt] = useState(toDateInput(new Date()));
  const [method, setMethod] = useState<PaymentMethod>("check");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const n = Number(amount);
  const partial = n > 0 && n < balance;

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Record payment</DialogTitle>
        <DialogDescription>Balance due {formatMoney(balance)}. Partial payments are fine; the invoice shows as paid once the balance hits zero.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="pay-amount">Amount</Label>
          <Input id="pay-amount" type="number" inputMode="decimal" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pay-date">Date</Label>
          <Input id="pay-date" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label>Method</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as PaymentMethod)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pay-ref">Check / ref #</Label>
          <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
        </div>
        <div className="col-span-2 grid gap-1.5">
          <Label htmlFor="pay-note">Note</Label>
          <Input id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Short-paid line 3, etc." />
        </div>
      </div>
      {partial && <p className="text-xs text-warning">This is a partial payment: {formatMoney(balance - n)} will remain outstanding.</p>}
      <DialogFooter>
        <Button
          disabled={pending || !(n > 0)}
          onClick={() =>
            start(async () => {
              const r = await recordPaymentAction({ invoice_id: invoiceId, amount: Math.round(n * 100) / 100, paid_at: paidAt, method, reference, note });
              if (r.ok) {
                toast.success("Payment recorded");
                onDone();
                router.refresh();
              } else toast.error(r.error);
            })
          }
        >
          Save payment
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
