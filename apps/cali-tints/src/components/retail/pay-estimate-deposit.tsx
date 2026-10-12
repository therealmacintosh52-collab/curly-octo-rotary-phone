"use client";

import { useTransition } from "react";
import { CreditCardIcon } from "lucide-react";
import { toast } from "sonner";
import { startEstimateDepositAction } from "@/app/e/[token]/actions";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";

/** On the estimate thank-you page: pay the deposit now (Clover), or a note that the shop takes it at drop-off. */
export function PayEstimateDeposit({ token, deposit, depositsOnline, justPaid, demo }: { token: string; deposit: number; depositsOnline: boolean; justPaid: boolean; demo: boolean }) {
  const [pending, start] = useTransition();
  if (justPaid) return <p className="rounded-xl border border-success/30 bg-success/8 px-4 py-3 text-sm" data-testid="estimate-deposit-paid">Deposit received. Pick a time below and you are booked.</p>;
  if (!depositsOnline) return <p className="text-caption text-subtle">The {formatMoney(deposit)} deposit is taken at drop-off.</p>;
  return (
    <Button
      size="lg"
      variant="secondary"
      loading={pending}
      data-testid="estimate-pay-deposit"
      onClick={() =>
        start(async () => {
          if (demo) return void toast.success("Opening Clover · guest preview");
          const r = await startEstimateDepositAction(token);
          if (!r.ok) return void toast.error(r.error);
          window.location.assign(r.data.url);
        })
      }
    >
      <CreditCardIcon /> Pay the {formatMoney(deposit)} deposit
    </Button>
  );
}
