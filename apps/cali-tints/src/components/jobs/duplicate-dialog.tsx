"use client";

import { AlertTriangleIcon, ReceiptIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate } from "@/lib/dates";

export interface DuplicateHit {
  id: string;
  tag_number: string;
  vin: string | null;
  performed_at: string;
  model: string | null;
  detailer_name: string;
  services?: string | null;
  /** Present when the earlier job is already on a live invoice. */
  invoice_number?: string | null;
}

export function DuplicateDialog({ hits, onCancel, onContinue }: { hits: DuplicateHit[] | null; onCancel: () => void; onContinue: () => void }) {
  const billed = (hits ?? []).some((h) => h.invoice_number);
  return (
    <Dialog open={!!hits} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="size-5 text-warning" /> Possible duplicate
          </DialogTitle>
          <DialogDescription>
            This tag or VIN was already logged in the last 7 days.
            {billed ? " At least one of those jobs has already been invoiced to the dealer." : ""}
          </DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {(hits ?? []).map((h) => (
            <li key={h.id} className="px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-semibold">
                  {h.tag_number}
                  {h.invoice_number && (
                    <Badge variant="destructive">
                      <ReceiptIcon /> Billed on {h.invoice_number}
                    </Badge>
                  )}
                </span>
                <span className="text-muted-foreground">{formatDate(h.performed_at)}</span>
              </div>
              <div className="text-muted-foreground">
                {[h.model, h.vin, h.detailer_name].filter(Boolean).join(" · ")}
                {h.services ? ` · ${h.services}` : ""}
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">If this is a second, different job on the same car (e.g. PDI earlier, full detail now), continue. The owner will see it flagged again before it is invoiced.</p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Go back
          </Button>
          <Button onClick={onContinue}>Continue anyway</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
