"use client";

import { AlertTriangleIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDateTime } from "@/lib/dates";

export interface DuplicateHit {
  id: string;
  tag_number: string;
  vin: string | null;
  performed_at: string;
  model: string | null;
  detailer_name: string;
  services?: string | null;
}

export function DuplicateDialog({
  hits,
  onCancel,
  onContinue,
}: {
  hits: DuplicateHit[] | null;
  onCancel: () => void;
  onContinue: () => void;
}) {
  return (
    <Dialog open={!!hits} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangleIcon className="size-5 text-warning" /> Possible duplicate
          </DialogTitle>
          <DialogDescription>This tag or VIN was already logged in the last 7 days.</DialogDescription>
        </DialogHeader>
        <ul className="divide-y divide-border rounded-lg border border-border">
          {(hits ?? []).map((h) => (
            <li key={h.id} className="px-3 py-2.5 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{h.tag_number}</span>
                <span className="text-muted-foreground">{formatDateTime(h.performed_at)}</span>
              </div>
              <div className="text-muted-foreground">
                {[h.model, h.vin, h.detailer_name].filter(Boolean).join(" · ")}
                {h.services ? ` · ${h.services}` : ""}
              </div>
            </li>
          ))}
        </ul>
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
