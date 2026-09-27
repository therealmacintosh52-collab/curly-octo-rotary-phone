"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BanIcon, BanknoteIcon, ChevronDownIcon, CreditCardIcon, DownloadIcon, FileCheckIcon, ListTreeIcon, MailIcon, MoreHorizontalIcon, PrinterIcon, SendIcon, TabletSmartphoneIcon, WalletIcon } from "lucide-react";
import { toast } from "sonner";
import type { InvoiceStatus, SubmissionMethod } from "@/lib/db/types";
import { markSubmittedAction, submitInvoiceByEmailAction, voidInvoiceAction } from "@/app/(app)/invoices/actions";
import { useSession } from "@/components/app/session-provider";
import { formatMoney, formatTaxRate } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** How the balance is made up: every car and service, tax, and every payment so far. */
export interface BalanceBreakdown {
  cars: { tag: string; vehicle: string; date: string; services: { name: string; amount: number }[] }[];
  subtotal: number;
  tax: number;
  taxRate: number;
  total: number;
  payments: { label: string; sub: string; amount: number }[];
}

interface Props {
  invoice: { id: string; status: InvoiceStatus; display_number: string; amount_paid: number; total: number; notes: string | null };
  dealership: { name: string; ap_emails: string[]; submission_method: SubmissionMethod };
  companyEmail: string | null;
  /** Which Clover routes are ready; drives the "Collect payment" menu. */
  collect?: { device: boolean; card: boolean; payLink: boolean };
  /** Enables "See breakdown" in the Collect menu. */
  breakdown?: BalanceBreakdown | null;
}

export function InvoiceActions({ invoice, dealership, companyEmail, collect = { device: false, card: false, payLink: false }, breakdown = null }: Props) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [emailOpen, setEmailOpen] = useState(false);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const isVoid = invoice.status === "void";
  const canVoid = !isVoid && invoice.amount_paid === 0;
  const hasBeenSent = invoice.status !== "draft";
  const balance = Math.round((invoice.total - invoice.amount_paid) * 100) / 100;
  const canCollect = !isVoid && balance > 0;
  const dl = (kind: string, extra = "") => `/api/invoices/${invoice.id}/${kind}${extra}`;
  const collectHref = (method?: "card" | "device") => `/terminal?invoice=${invoice.id}${method ? `&method=${method}` : ""}`;

  function sendEmail() {
    if (demo) {
      toast.success(`Emailed to ${dealership.ap_emails.join(", ") || "the dealership"}`, { description: "Guest preview — nothing sent" });
      setEmailOpen(false);
      return;
    }
    start(async () => {
      const r = await submitInvoiceByEmailAction(invoice.id);
      if (r.ok) {
        toast.success(`Emailed to ${r.data.recipients.join(", ")}`);
        setEmailOpen(false);
        router.refresh();
      } else {
        toast.error(r.error);
        router.refresh(); // the failed attempt is logged in history
      }
    });
  }

  const downloads = (
    <>
      <DropdownMenuLabel>PDF</DropdownMenuLabel>
      <DropdownMenuItem asChild>
        <a href={dl("pdf")}>
          <DownloadIcon /> Branded PDF
        </a>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <a href={dl("pdf", "?variant=print")}>
          <PrinterIcon /> Print-ready PDF (B&amp;W, letter)
        </a>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <a href={dl("pdf", "?inline=1")} target="_blank" rel="noreferrer">
          Open in browser
        </a>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>Accounting import</DropdownMenuLabel>
      <DropdownMenuItem asChild>
        <a href={dl("csv")}>CSV line items</a>
      </DropdownMenuItem>
      <DropdownMenuItem asChild>
        <a href={dl("xlsx")}>Excel workbook</a>
      </DropdownMenuItem>
    </>
  );

  return (
    <div className="flex flex-wrap gap-2">
      {/* While money is owed, collecting it is the primary action. */}
      {canCollect && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button disabled={pending} className="flex-1 sm:flex-none">
              <WalletIcon /> Collect {formatMoney(balance)} <ChevronDownIcon className="opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72">
            {breakdown && (
              <>
                <DropdownMenuItem onSelect={() => setBreakdownOpen(true)}>
                  <ListTreeIcon /> See what makes up {formatMoney(balance)}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            )}
            <DropdownMenuLabel>Charge now</DropdownMenuLabel>
            <DropdownMenuItem asChild disabled={!collect.device}>
              <Link href={collectHref("device")}>
                <TabletSmartphoneIcon /> On the Clover terminal
                {!collect.device && <span className="ml-auto text-caption text-subtle">set up</span>}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild disabled={!collect.card}>
              <Link href={collectHref("card")}>
                <CreditCardIcon /> Card typed in the app
                {!collect.card && <span className="ml-auto text-caption text-subtle">set up</span>}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={collectHref()}>
                <BanknoteIcon /> Cash, check or ACH
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Bill the dealership</DropdownMenuLabel>
            <DropdownMenuItem onSelect={() => setEmailOpen(true)}>
              <MailIcon /> Email invoice{collect.payLink ? " with pay-by-card link" : ""}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {/* Send it (draft) or send it again; secondary once a balance can be collected. */}
      {!isVoid && (
        <Button variant={canCollect ? "outline" : "default"} onClick={() => setEmailOpen(true)} disabled={pending} className={canCollect ? "hidden sm:inline-flex" : "flex-1 sm:flex-none"}>
          {hasBeenSent ? <SendIcon /> : <MailIcon />}
          {hasBeenSent ? "Resend by email" : "Submit by email"}
        </Button>
      )}

      {/* Phones: everything else behind one "More" button. */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="sm:hidden" aria-label="More actions">
            <MoreHorizontalIcon /> More
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {!isVoid && (
            <DropdownMenuItem onSelect={() => setManualOpen(true)}>
              <FileCheckIcon /> Mark as submitted
            </DropdownMenuItem>
          )}
          {!isVoid && <DropdownMenuSeparator />}
          {downloads}
          {canVoid && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setVoidOpen(true)} className="text-destructive focus:text-destructive">
                <BanIcon /> Void invoice
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Desktop: inline secondary actions. */}
      {!isVoid && (
        <Button variant="outline" className="hidden sm:inline-flex" onClick={() => setManualOpen(true)}>
          <FileCheckIcon /> Mark as submitted
        </Button>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="hidden sm:inline-flex">
            <DownloadIcon /> Download <ChevronDownIcon className="opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">{downloads}</DropdownMenuContent>
      </DropdownMenu>
      {canVoid && (
        <Button variant="ghost" className="hidden text-destructive sm:inline-flex" onClick={() => setVoidOpen(true)}>
          <BanIcon /> Void
        </Button>
      )}

      {/* Balance breakdown */}
      {breakdown && (
        <Dialog open={breakdownOpen} onOpenChange={setBreakdownOpen}>
          <BreakdownDialog number={invoice.display_number} b={breakdown} balance={balance} />
        </Dialog>
      )}

      {/* Email confirm */}
      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{hasBeenSent ? "Resend" : "Submit"} {invoice.display_number} by email</DialogTitle>
            <DialogDescription>The branded PDF and a CSV of line items are attached.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 rounded-lg border border-border p-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">To</span>
              <span className="text-right">{dealership.ap_emails.length ? dealership.ap_emails.join(", ") : <span className="text-destructive">No AP email on file</span>}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">CC</span>
              <span className="text-right">{companyEmail ?? "—"}</span>
            </div>
          </div>
          {dealership.submission_method !== "email" && (
            <p className="text-xs text-warning">
              {dealership.name} prefers {dealership.submission_method} submission. You can still email it.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailOpen(false)}>
              Cancel
            </Button>
            <Button onClick={sendEmail} loading={pending} disabled={dealership.ap_emails.length === 0}>
              {!pending && <SendIcon />} Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Manual submission */}
      <Dialog open={manualOpen} onOpenChange={setManualOpen}>
        <ManualSubmitDialog invoiceId={invoice.id} defaultMethod={dealership.submission_method === "email" ? "portal" : dealership.submission_method} onDone={() => setManualOpen(false)} />
      </Dialog>

      {/* Void */}
      <Dialog open={voidOpen} onOpenChange={setVoidOpen}>
        <VoidDialog
          onConfirm={(reason) =>
            start(async () => {
              const r = await voidInvoiceAction(invoice.id, reason);
              if (r.ok) {
                toast.success("Invoice voided; jobs are uninvoiced again");
                setVoidOpen(false);
                router.refresh();
              } else toast.error(r.error);
            })
          }
          pending={pending}
        />
      </Dialog>
    </div>
  );
}

function ManualSubmitDialog({ invoiceId, defaultMethod, onDone }: { invoiceId: string; defaultMethod: SubmissionMethod; onDone: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [method, setMethod] = useState<SubmissionMethod>(defaultMethod);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <DialogContent>
      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set("invoice_id", invoiceId);
          fd.set("method", method);
          start(async () => {
            const r = await markSubmittedAction(fd);
            if (r.ok) {
              toast.success("Marked as submitted");
              onDone();
              router.refresh();
            } else toast.error(r.error);
          });
        }}
        className="grid gap-4"
      >
        <DialogHeader>
          <DialogTitle>Mark as submitted</DialogTitle>
          <DialogDescription>For invoices uploaded to the dealer portal or handed over on paper. Attach the confirmation if you have one.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label>Method</Label>
          <Select value={method} onValueChange={(v) => setMethod(v as SubmissionMethod)}>
            <SelectTrigger aria-label="Submission method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="portal">Dealer portal</SelectItem>
              <SelectItem value="paper">Paper / in person</SelectItem>
              <SelectItem value="email">Email (sent outside this app)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ms-note">Note</Label>
          <Textarea id="ms-note" name="note" className="min-h-16" placeholder="Portal reference #, who received it…" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ms-file">Confirmation (image or PDF, optional)</Label>
          <Input id="ms-file" name="confirmation" type="file" accept="image/*,application/pdf" />
        </div>
        <DialogFooter>
          <Button type="submit" loading={pending}>
            {!pending && <FileCheckIcon />} Mark submitted
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function VoidDialog({ onConfirm, pending }: { onConfirm: (reason: string) => void; pending: boolean }) {
  const [reason, setReason] = useState("");
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Void this invoice?</DialogTitle>
        <DialogDescription>The invoice number is kept for the audit trail and its jobs become uninvoiced again so they can be re-invoiced.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="void-reason">Reason</Label>
        <Input id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Wrong period, dealer requested split…" />
      </div>
      <DialogFooter>
        <Button variant="destructive" disabled={pending} onClick={() => onConfirm(reason)}>
          Void invoice
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/** Cars and services → subtotal, tax, total → payments → balance due. Same numbers as the page, just in one column. */
function Row({ label, sub, amount, strong, tone }: { label: string; sub?: string; amount: string; strong?: boolean; tone?: "muted" | "warning" | "accent" }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5", strong && "text-base font-semibold")}>
      <div className="min-w-0">
        <div className={cn("truncate", tone === "muted" && "text-muted-foreground")}>{label}</div>
        {sub && <div className="truncate text-caption text-subtle">{sub}</div>}
      </div>
      <div className={cn("shrink-0 tabular-nums", tone === "warning" && "text-warning", tone === "accent" && "text-primary")}>{amount}</div>
    </div>
  );
}

function BreakdownDialog({ number, b, balance }: { number: string; b: BalanceBreakdown; balance: number }) {
  return (
    <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
      <DialogHeader>
        <DialogTitle>What makes up {formatMoney(balance)}</DialogTitle>
        <DialogDescription>{number} · every car and service, what has been paid, and what is left.</DialogDescription>
      </DialogHeader>
      <div className="text-sm">
        <div className="text-label text-muted-foreground">Cars detailed</div>
        <ul className="mt-1 divide-y divide-border">
          {b.cars.map((c) => (
            <li key={c.tag + c.date} className="py-2">
              <div className="flex items-baseline justify-between gap-4">
                <div className="min-w-0">
                  <span className="font-semibold">{c.tag}</span>
                  <span className="text-muted-foreground"> · {c.vehicle}</span>
                  <div className="text-caption text-subtle">{c.date}</div>
                </div>
                <div className="shrink-0 font-medium tabular-nums">{formatMoney(c.services.reduce((s, x) => s + x.amount, 0))}</div>
              </div>
              <ul className="mt-1 grid gap-0.5 pl-3 text-caption text-muted-foreground">
                {c.services.map((sv, i) => (
                  <li key={i} className="flex justify-between gap-4">
                    <span className="truncate">{sv.name}</span>
                    <span className="shrink-0 tabular-nums">{formatMoney(sv.amount)}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
        <div className="mt-2 border-t border-border pt-1">
          <Row label="Subtotal" amount={formatMoney(b.subtotal)} tone="muted" />
          <Row label={`Tax (${formatTaxRate(b.taxRate)})`} amount={formatMoney(b.tax)} tone="muted" />
          <Row label="Invoice total" amount={formatMoney(b.total)} strong />
        </div>
        <div className="mt-3 text-label text-muted-foreground">Paid so far</div>
        {b.payments.length === 0 ? (
          <p className="py-1.5 text-muted-foreground">Nothing yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {b.payments.map((p, i) => (
              <Row key={i} label={p.label} sub={p.sub} amount={`-${formatMoney(p.amount)}`} />
            ))}
          </div>
        )}
        <div className="mt-2 border-t-2 border-border pt-1">
          <Row label="Balance due" amount={formatMoney(balance)} strong tone={balance > 0 ? "warning" : "accent"} />
        </div>
      </div>
    </DialogContent>
  );
}
