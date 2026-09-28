"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { EyeIcon, MailIcon, PaperclipIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import { previewInvoiceEmailAction, sendInvoicesAction } from "@/app/(app)/invoices/actions";
import { useSession } from "@/components/app/session-provider";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** The email is laid out at 600px like every invoice email; on a phone, let it shrink the way Gmail does. */
function fitToPhone(html: string) {
  return html.replace("<html>", '<html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>table[width="600"]{width:100%!important}</style></head>');
}

/** Drop the make when it is the default one, so "4821 · 2024 GLE 450" fits a phone row. */
const shortVehicle = (v: string | null) => v?.replace(/^(\d{4} )?Mercedes-Benz /, "$1") ?? null;

/** One unsent invoice as the Send dialog lists it. */
export interface UnsentInvoice {
  id: string;
  number: string;
  tag: string;
  vehicle: string | null;
  total: number;
}

/** Unsent invoices for one dealership: what "Send invoices" would email. */
export interface UnsentGroup {
  dealership_id: string;
  name: string;
  emails: string[];
  invoices: UnsentInvoice[];
}

/** The email exactly as it will go out, for the preview. */
export interface EmailPreview {
  to: string[];
  cc: string[];
  subject: string;
  html: string;
  attachments: { name: string; href: string | null }[];
}

/**
 * Email unsent invoices to their dealerships. Every invoice is a checkbox
 * (a dealership header ticks all of its cars), the eye shows the email as
 * the dealership will see it, and each goes out as its own email with the
 * PDF and CSV attached, exactly like "Submit by email" one at a time.
 */
export function SendInvoicesButton({ groups, previews = null }: { groups: UnsentGroup[]; /** Demo: prebuilt previews by invoice id (no server call). */ previews?: Record<string, EmailPreview> | null }) {
  const router = useRouter();
  const { demo } = useSession();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(groups.filter((g) => g.emails.length > 0).flatMap((g) => g.invoices.map((i) => i.id))));
  const [preview, setPreview] = useState<(EmailPreview & { number: string }) | null>(null);
  const [loadingPreview, setLoadingPreview] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const all = groups.flatMap((g) => g.invoices);
  if (all.length === 0) return null;
  const sendable = new Set(groups.filter((g) => g.emails.length > 0).flatMap((g) => g.invoices.map((i) => i.id)));
  const chosen = all.filter((i) => picked.has(i.id) && sendable.has(i.id));
  const chosenTotal = chosen.reduce((s, i) => s + i.total, 0);

  function toggle(ids: string[], on: boolean) {
    setPicked((prev) => {
      const next = new Set(prev);
      for (const id of ids) if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function showPreview(inv: UnsentInvoice) {
    if (previews?.[inv.id]) {
      setPreview({ ...previews[inv.id], number: inv.number });
      return;
    }
    setLoadingPreview(inv.id);
    try {
      const r = await previewInvoiceEmailAction(inv.id);
      if (r.ok) setPreview({ ...r.data, number: inv.number });
      else toast.error(r.error);
    } finally {
      setLoadingPreview(null);
    }
  }

  function send() {
    if (demo) {
      toast.success(`Sent ${chosen.length} ${chosen.length === 1 ? "invoice" : "invoices"}`, { description: "Guest preview — nothing sent" });
      setOpen(false);
      return;
    }
    start(async () => {
      const r = await sendInvoicesAction(chosen.map((i) => i.id));
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      if (r.data.failed.length === 0) toast.success(`Sent ${r.data.sent} ${r.data.sent === 1 ? "invoice" : "invoices"}`);
      else toast.warning(`Sent ${r.data.sent}, ${r.data.failed.length} failed`, { description: r.data.failed.map((f) => `${f.number}: ${f.error}`).join(" · ") });
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="soft" onClick={() => setOpen(true)} data-testid="send-invoices">
        <MailIcon /> Send invoices · {all.length}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send {all.length === 1 ? "the unsent invoice" : `unsent invoices`}</DialogTitle>
            <DialogDescription>Tick the ones to send. Each goes to the dealership&apos;s AP contact as its own email with the PDF and a CSV attached, then shows as Sent to dealer. The eye shows the email first.</DialogDescription>
          </DialogHeader>
          <div className="grid min-w-0 gap-3">
            {groups.map((g) => {
              const can = g.emails.length > 0;
              const ids = g.invoices.map((i) => i.id);
              const on = ids.filter((id) => picked.has(id)).length;
              return (
                <div key={g.dealership_id} className="min-w-0 overflow-hidden rounded-lg border border-border text-sm">
                  <label className={cn("flex min-w-0 items-start gap-3 bg-muted/40 px-3 py-2.5", can ? "cursor-pointer" : "opacity-70")}>
                    <Checkbox checked={!can ? false : on === ids.length ? true : on > 0 ? "indeterminate" : false} disabled={!can} onCheckedChange={(v) => toggle(ids, v === true)} className="mt-0.5" aria-label={`All ${g.name}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">{g.name}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {on}/{ids.length}
                        </span>
                      </span>
                      <span className="block truncate text-caption text-muted-foreground">{can ? `to ${g.emails.join(", ")}` : <span className="text-warning">No AP email · add one in Settings → Dealerships</span>}</span>
                    </span>
                  </label>
                  <ul className="divide-y divide-border">
                    {g.invoices.map((inv) => (
                      <li key={inv.id} className="flex min-w-0 items-center gap-3 px-3 py-2" data-testid="send-row">
                        <Checkbox checked={can && picked.has(inv.id)} disabled={!can} onCheckedChange={(v) => toggle([inv.id], v === true)} aria-label={`Send ${inv.number}`} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-3">
                            <span className="truncate">
                              <span className="font-semibold tracking-wide">{inv.tag}</span>
                              {inv.vehicle && <span className="text-muted-foreground"> · {shortVehicle(inv.vehicle)}</span>}
                            </span>
                            <span className="shrink-0 tabular-nums">{formatMoney(inv.total)}</span>
                          </span>
                          <span className="block text-caption tabular-nums text-subtle">{inv.number}</span>
                        </span>
                        <Button size="icon-sm" variant="ghost" aria-label={`Preview email for ${inv.number}`} title="See the email as the dealership will" loading={loadingPreview === inv.id} onClick={() => showPreview(inv)}>
                          {loadingPreview !== inv.id && <EyeIcon />}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={send} loading={pending} disabled={chosen.length === 0}>
              {!pending && <SendIcon />} Send {chosen.length} · {formatMoney(chosenTotal)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* The email, as it will arrive */}
      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto p-0 sm:max-w-2xl" data-testid="email-preview">
          {preview && (
            <>
              <DialogHeader className="px-5 pt-5">
                <DialogTitle>How {preview.number} arrives</DialogTitle>
                <DialogDescription>This is the email the dealership gets. The attachments open in a new tab.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-1 border-y border-border bg-muted/30 px-5 py-3 text-sm">
                <div className="flex gap-3">
                  <span className="w-14 shrink-0 text-muted-foreground">To</span>
                  <span className="min-w-0 break-words">{preview.to.join(", ")}</span>
                </div>
                {preview.cc.length > 0 && (
                  <div className="flex gap-3">
                    <span className="w-14 shrink-0 text-muted-foreground">CC</span>
                    <span className="min-w-0 break-words">{preview.cc.join(", ")}</span>
                  </div>
                )}
                <div className="flex gap-3">
                  <span className="w-14 shrink-0 text-muted-foreground">Subject</span>
                  <span className="min-w-0 font-medium break-words">{preview.subject}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {preview.attachments.map((a) =>
                    a.href ? (
                      <a key={a.name} href={a.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-caption hover:border-border-strong hover:text-primary">
                        <PaperclipIcon className="size-3.5" /> {a.name}
                      </a>
                    ) : (
                      <span key={a.name} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-caption text-muted-foreground">
                        <PaperclipIcon className="size-3.5" /> {a.name}
                      </span>
                    ),
                  )}
                </div>
              </div>
              <iframe title={`Email preview for ${preview.number}`} srcDoc={fitToPhone(preview.html)} sandbox="" className="h-[60dvh] w-full bg-[#f3f4f6]" />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
