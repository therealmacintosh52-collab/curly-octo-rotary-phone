"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BanIcon, ChevronDownIcon, DownloadIcon, FileCheckIcon, MailIcon, MoreHorizontalIcon, PrinterIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import type { InvoiceStatus, SubmissionMethod } from "@/lib/db/types";
import { markSubmittedAction, submitInvoiceByEmailAction, voidInvoiceAction } from "@/app/(app)/invoices/actions";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Props {
  invoice: { id: string; status: InvoiceStatus; display_number: string; amount_paid: number; total: number; notes: string | null };
  dealership: { name: string; ap_emails: string[]; submission_method: SubmissionMethod };
  companyEmail: string | null;
}

export function InvoiceActions({ invoice, dealership, companyEmail }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [emailOpen, setEmailOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [voidOpen, setVoidOpen] = useState(false);
  const isVoid = invoice.status === "void";
  const canVoid = !isVoid && invoice.amount_paid === 0;
  const hasBeenSent = invoice.status !== "draft";
  const dl = (kind: string, extra = "") => `/api/invoices/${invoice.id}/${kind}${extra}`;

  function sendEmail() {
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
      {/* One primary action per state: send it (draft) or send it again. */}
      {!isVoid && (
        <Button onClick={() => setEmailOpen(true)} disabled={pending} className="flex-1 sm:flex-none">
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
