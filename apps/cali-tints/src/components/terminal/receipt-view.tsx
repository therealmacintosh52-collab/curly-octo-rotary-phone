"use client";

import { useState, useTransition } from "react";
import { MailIcon, PrinterIcon, Undo2Icon } from "lucide-react";
import { toast } from "sonner";
import type { TerminalTransaction } from "@/lib/db/types";
import { emailReceiptAction } from "@/app/(app)/terminal/actions";
import { useSession } from "@/components/app/session-provider";
import { formatMoney } from "@/lib/money";
import { companyAddress, receiptLines, receiptNumber, receiptTitle, type ReceiptCompany } from "@/lib/terminal/receipt";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * The receipt as the customer sees it (also what prints), with the actions
 * around it: email, print, refund. `data-print-root` makes it the only thing
 * on the page when printing (see globals.css).
 */
export function ReceiptView({ tx, company, onRefund, onNew, className }: { tx: TerminalTransaction; company: ReceiptCompany; onRefund?: () => void; onNew?: () => void; className?: string }) {
  const { demo } = useSession();
  const [sending, start] = useTransition();
  const [to, setTo] = useState(tx.customer_email ?? "");
  const [sent, setSent] = useState<string | null>(tx.receipt_sent_at ? (tx.customer_email ?? "sent") : null);
  const refund = tx.kind === "refund";
  const remaining = Number(tx.amount) - Number(tx.refunded_amount);
  const canRefund = !!onRefund && tx.kind === "sale" && remaining > 0.004 && tx.source !== "clover_checkout";

  function email(e: React.FormEvent) {
    e.preventDefault();
    if (!to) return;
    if (demo) {
      setSent(to);
      toast.success(`Receipt emailed to ${to}`, { description: "Guest preview — nothing sent" });
      return;
    }
    start(async () => {
      const r = await emailReceiptAction({ id: tx.id, to });
      if (r.ok) {
        setSent(r.data.to);
        toast.success(`Receipt emailed to ${r.data.to}`);
      } else toast.error(r.error);
    });
  }

  return (
    <div className={cn("grid gap-4", className)}>
      <div data-print-root className="rounded-xl border border-border bg-surface-2 px-5 py-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-base font-semibold">{company.name}</div>
            <div className="text-caption text-subtle">{companyAddress(company)}</div>
            {company.phone && <div className="text-caption text-subtle">{company.phone}</div>}
          </div>
          <div className="shrink-0 text-right whitespace-nowrap">
            <div className="text-label text-muted-foreground">{receiptTitle(tx)}</div>
            <div className="text-caption text-subtle">{receiptNumber(tx)}</div>
          </div>
        </div>
        <div className={cn("mt-5 text-[2rem] leading-9 font-semibold tracking-tight tabular-nums", refund && "text-warning")}>
          {refund ? "-" : ""}
          {formatMoney(tx.amount)}
        </div>
        <dl className="mt-4 grid gap-1.5 text-sm">
          {receiptLines(tx, company).map((l) => (
            <div key={l.label} className="flex justify-between gap-4">
              <dt className="text-muted-foreground">{l.label}</dt>
              <dd className="text-right">{l.value}</dd>
            </div>
          ))}
        </dl>
        {tx.status !== "captured" && tx.kind === "sale" && (
          <Badge variant={tx.status === "refunded" ? "muted" : "warning"} className="mt-4">
            {tx.status === "refunded" ? "Refunded" : `Partially refunded · ${formatMoney(remaining)} left`}
          </Badge>
        )}
        <p className="mt-5 text-caption text-subtle">{refund ? "Refunds to a card take 5–10 business days to appear." : "Thank you for your business."}</p>
      </div>

      <form onSubmit={email} className="flex gap-2">
        <Input type="email" inputMode="email" placeholder="customer@email.com" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Email receipt to" className="flex-1" />
        <Button type="submit" variant="outline" loading={sending} disabled={!to}>
          <MailIcon /> Email
        </Button>
      </form>
      {sent && <p className="-mt-2 text-caption text-success">Receipt emailed to {sent}.</p>}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => window.print()}>
          <PrinterIcon /> Print
        </Button>
        {canRefund && (
          <Button type="button" variant="outline" className="text-warning hover:text-warning" onClick={onRefund}>
            <Undo2Icon /> Refund
          </Button>
        )}
        {onNew && (
          <Button type="button" className="ml-auto" onClick={onNew}>
            New sale
          </Button>
        )}
      </div>
      {tx.kind === "sale" && tx.source === "clover_checkout" && <p className="text-caption text-subtle">Paid through the pay-by-card link: refund it from the Clover dashboard.</p>}
    </div>
  );
}
