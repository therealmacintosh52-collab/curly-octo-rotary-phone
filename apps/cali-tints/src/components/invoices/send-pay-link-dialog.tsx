"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, CopyIcon, LinkIcon, SendIcon, Share2Icon } from "lucide-react";
import { toast } from "sonner";
import { getPaymentLinkAction, sendPaymentLinkAction } from "@/app/(app)/invoices/actions";
import { useSession } from "@/components/app/session-provider";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * Send the pay-by-card link on its own: by email to the AP contact (or any
 * address typed in), copied, or shared to Messages on a phone. The link is
 * made on the spot if the invoice has none.
 */
export function SendPayLinkDialog({ invoiceId, number, dealership, apEmails, balance, onDone }: { invoiceId: string; number: string; dealership: string; apEmails: string[]; balance: number; onDone: () => void }) {
  const router = useRouter();
  const { demo } = useSession();
  const [to, setTo] = useState(apEmails.join(", "));
  const [note, setNote] = useState("");
  // Guests get a stand-in link at once; otherwise the link is made (or fetched) as soon as the dialog opens so Copy and Share are instant.
  const [link, setLink] = useState<string | null>(demo ? "https://checkout.sandbox.dev.clover.com/pay/example" : null);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const [linking, setLinking] = useState(!demo);
  const recipients = to.split(/[,;\s]+/).map((s) => s.trim()).filter(Boolean);
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  useEffect(() => {
    if (demo) return;
    let alive = true;
    getPaymentLinkAction(invoiceId)
      .then((r) => {
        if (!alive) return;
        if (r.ok) setLink(r.data.url);
        else toast.error(r.error);
      })
      .finally(() => alive && setLinking(false));
    return () => {
      alive = false;
    };
  }, [invoiceId, demo]);

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy; long-press the link instead");
    }
  }

  async function share() {
    if (!link) return;
    try {
      await navigator.share({ title: `Invoice ${number}`, text: `Pay ${formatMoney(balance)} for invoice ${number} by card:`, url: link });
    } catch {
      /* the person closed the share sheet */
    }
  }

  function send() {
    if (recipients.length === 0) return toast.error("Add an email address");
    if (demo) {
      toast.success(`Payment link sent to ${recipients.join(", ")}`, { description: "Guest preview — nothing sent" });
      onDone();
      return;
    }
    start(async () => {
      const r = await sendPaymentLinkAction({ invoiceId, to: recipients, note: note.trim() || undefined });
      if (r.ok) {
        toast.success(`Payment link sent to ${r.data.recipients.join(", ")}`);
        onDone();
        router.refresh();
      } else toast.error(r.error);
    });
  }

  return (
    <DialogContent data-testid="pay-link-dialog">
      <DialogHeader>
        <DialogTitle>Send a payment link</DialogTitle>
        <DialogDescription>
          {number} · {dealership} · {formatMoney(balance)} due. A secure Clover checkout page; card only, no PDF attached.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4">
        <div className="grid gap-1.5">
          <Label htmlFor="pl-to">Email to</Label>
          <Input id="pl-to" value={to} onChange={(e) => setTo(e.target.value)} placeholder="ap@dealer.com, controller@dealer.com" inputMode="email" autoCapitalize="none" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="pl-note">Message (optional)</Label>
          <Textarea id="pl-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Thanks again for today, here is the link for the GLE." className="min-h-16" maxLength={500} />
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
          <LinkIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-caption text-muted-foreground">{linking ? "Making the link…" : (link ?? "No link yet")}</span>
          <Button type="button" size="sm" variant="outline" disabled={!link} onClick={copy} aria-label="Copy payment link">
            {copied ? <CheckIcon className="text-success" /> : <CopyIcon />} Copy
          </Button>
          {canShare && (
            <Button type="button" size="sm" variant="outline" disabled={!link} onClick={share} aria-label="Share payment link">
              <Share2Icon /> Text it
            </Button>
          )}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button onClick={send} loading={pending} disabled={recipients.length === 0 || linking}>
          {!pending && <SendIcon />} Send by email
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
