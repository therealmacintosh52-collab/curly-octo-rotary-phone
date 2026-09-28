"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MailIcon, SendIcon } from "lucide-react";
import { toast } from "sonner";
import { sendInvoicesAction } from "@/app/(app)/invoices/actions";
import { useSession } from "@/components/app/session-provider";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

/** Unsent invoices for one dealership: what "Send invoices" would email. */
export interface UnsentGroup {
  dealership_id: string;
  name: string;
  emails: string[];
  ids: string[];
  total: number;
}

/**
 * Email every unsent invoice to its dealership in one go: each invoice goes
 * as its own email with the PDF and CSV attached, exactly as "Submit by
 * email" does one at a time. Dealerships with no AP email are listed but
 * cannot be sent to until Settings has an address.
 */
export function SendInvoicesButton({ groups }: { groups: UnsentGroup[] }) {
  const router = useRouter();
  const { demo } = useSession();
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set(groups.filter((g) => g.emails.length > 0).map((g) => g.dealership_id)));
  const [pending, start] = useTransition();
  const count = groups.reduce((s, g) => s + g.ids.length, 0);
  if (count === 0) return null;
  const chosen = groups.filter((g) => picked.has(g.dealership_id) && g.emails.length > 0);
  const chosenIds = chosen.flatMap((g) => g.ids);
  const chosenTotal = chosen.reduce((s, g) => s + g.total, 0);

  function send() {
    if (demo) {
      toast.success(`Sent ${chosenIds.length} ${chosenIds.length === 1 ? "invoice" : "invoices"}`, { description: "Guest preview — nothing sent" });
      setOpen(false);
      return;
    }
    start(async () => {
      const r = await sendInvoicesAction(chosenIds);
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
        <MailIcon /> Send invoices · {count}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send {count === 1 ? "the unsent invoice" : `${count} unsent invoices`}</DialogTitle>
            <DialogDescription>Each invoice is emailed to the dealership&apos;s AP contact with the PDF and a CSV attached, and marked as sent.</DialogDescription>
          </DialogHeader>
          <ul className="min-w-0 divide-y divide-border overflow-hidden rounded-lg border border-border text-sm">
            {groups.map((g) => {
              const can = g.emails.length > 0;
              const on = can && picked.has(g.dealership_id);
              return (
                <li key={g.dealership_id}>
                  <label className="flex min-w-0 cursor-pointer items-start gap-3 px-3 py-2.5">
                    <Checkbox
                      checked={on}
                      disabled={!can}
                      onCheckedChange={(v) =>
                        setPicked((prev) => {
                          const next = new Set(prev);
                          if (v) next.add(g.dealership_id);
                          else next.delete(g.dealership_id);
                          return next;
                        })
                      }
                      className="mt-0.5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="font-medium">{g.name}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">
                          {g.ids.length} · {formatMoney(g.total)}
                        </span>
                      </span>
                      <span className="block truncate text-caption text-muted-foreground">{can ? `to ${g.emails.join(", ")}` : <span className="text-warning">No AP email · add one in Settings → Dealerships</span>}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={send} loading={pending} disabled={chosenIds.length === 0}>
              {!pending && <SendIcon />} Send {chosenIds.length} · {formatMoney(chosenTotal)}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
