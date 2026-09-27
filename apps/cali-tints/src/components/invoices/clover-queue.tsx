"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCardIcon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import type { CloverPaymentRow } from "@/lib/db/types";
import { ignoreCloverPaymentAction, matchCloverPaymentAction, syncCloverAction } from "@/app/(app)/invoices/actions";
import { useSession } from "@/components/app/session-provider";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export interface OpenInvoiceOption {
  id: string;
  display_number: string;
  dealership: string;
  balance: number;
}

/**
 * Clover payments that could not be matched automatically. The owner picks
 * the invoice (same-balance invoices listed first) or ignores the payment.
 */
export function CloverQueue({ payments, invoices }: { payments: Pick<CloverPaymentRow, "id" | "clover_payment_id" | "amount" | "tip" | "paid_at" | "card_brand" | "last4" | "reference">[]; invoices: OpenInvoiceOption[] }) {
  const router = useRouter();
  const { demo } = useSession();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [picked, setPicked] = useState<Record<string, string>>({});
  if (payments.length === 0) return null;

  function act(label: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    if (demo) return toast.success(label, { description: "Guest preview — not actually saved" });
    start(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success(label);
        router.refresh();
      } else toast.error(r.error ?? "Failed");
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-left text-sm transition-colors hover:bg-warning/15"
      >
        <span className="flex items-center gap-2">
          <CreditCardIcon className="size-4 text-warning" />
          <span>
            <strong>{payments.length}</strong> Clover payment{payments.length === 1 ? "" : "s"} to match · {formatMoney(payments.reduce((s, p) => s + Number(p.amount), 0))}
          </span>
        </span>
        <span className="text-caption text-warning">Review</span>
      </button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="sm:max-h-[85dvh]">
          <SheetHeader>
            <SheetTitle>Clover payments to match</SheetTitle>
            <SheetDescription>These card payments came in on Clover but no invoice matched by order, reference or exact balance. Pick the invoice each one pays.</SheetDescription>
          </SheetHeader>
          <ul className="divide-y divide-border overflow-y-auto px-5 pb-4">
            {payments.map((p) => {
              const sameBalance = invoices.filter((i) => Math.round(i.balance * 100) === Math.round(Number(p.amount) * 100));
              const others = invoices.filter((i) => !sameBalance.includes(i));
              const choice = picked[p.id] ?? sameBalance[0]?.id ?? "";
              return (
                <li key={p.id} className="grid gap-3 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold tabular-nums">{formatMoney(p.amount)}</div>
                      <div className="text-caption text-muted-foreground">
                        {formatDateTime(p.paid_at)}
                        {p.card_brand || p.last4 ? ` · ${[p.card_brand, p.last4].filter(Boolean).join(" ")}` : ""}
                        {p.reference ? ` · ${p.reference}` : ""}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-muted-foreground" disabled={pending} onClick={() => act("Payment ignored", () => ignoreCloverPaymentAction(p.clover_payment_id))}>
                      Ignore
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Select value={choice} onValueChange={(v) => setPicked((s) => ({ ...s, [p.id]: v }))}>
                      <SelectTrigger aria-label="Invoice to apply this payment to" className="min-w-0 flex-1">
                        <SelectValue placeholder="Pick an invoice" />
                      </SelectTrigger>
                      <SelectContent>
                        {sameBalance.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.display_number} · {i.dealership} · {formatMoney(i.balance)} (exact)
                          </SelectItem>
                        ))}
                        {others.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {i.display_number} · {i.dealership} · {formatMoney(i.balance)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button disabled={!choice || pending} onClick={() => act("Payment applied", () => matchCloverPaymentAction(p.clover_payment_id, choice))}>
                      Apply
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** "Sync now" for the Invoices page header. */
export function CloverSyncButton({ lastSyncAt }: { lastSyncAt: string | null }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  return (
    <Button
      variant="outline"
      loading={pending}
      title={lastSyncAt ? `Last sync ${formatDateTime(lastSyncAt)}` : "Never synced"}
      onClick={() => {
        if (demo) return toast.success("Synced with Clover", { description: "2 payments pulled, 1 matched (simulated)" });
        start(async () => {
          const r = await syncCloverAction();
          if (r.ok) {
            toast.success("Synced with Clover", { description: `${r.data.pulled} pulled · ${r.data.matched} matched · ${r.data.unmatched} to review` });
            router.refresh();
          } else toast.error(r.error);
        });
      }}
    >
      <RefreshCwIcon /> Sync Clover
    </Button>
  );
}
