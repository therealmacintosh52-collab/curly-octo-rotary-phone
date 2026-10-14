"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeftIcon } from "lucide-react";
import { toast } from "sonner";
import type { TransferCandidate } from "@/lib/db/types";
import { transferCandidatesAction, transferEstimateAction } from "@/app/(app)/retail/estimates/actions";
import { useSession } from "@/components/app/session-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const TRANSFER_STATUSES = ["Checked in", "Diagnosis / inspection", "Waiting for approval", "Needs parts ordered", "In progress", "Ready for pickup"] as const;
const DEMO_STAFF: TransferCandidate[] = [
  { id: "u2", name: "Victor Kim", initials: "VK", role: "detailer" },
  { id: "u3", name: "Dee One", initials: "DO", role: "detailer" },
  { id: "u5", name: "Sam Ortiz", initials: "SO", role: "advisor" },
];

/** Hand a visit to a coworker with a status and a note (they accept it from their dashboard). */
export function TransferDialog({ estimateId, label, summary, onClose }: { estimateId: string; label: string; summary: string; onClose: () => void }) {
  const router = useRouter();
  const { demo } = useSession();
  const [people, setPeople] = useState<TransferCandidate[] | null>(demo ? DEMO_STAFF : null);
  const [to, setTo] = useState("");
  const [status, setStatus] = useState<string>(TRANSFER_STATUSES[0]);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => {
    if (demo) return;
    let live = true;
    transferCandidatesAction().then((r) => {
      if (!live) return;
      if (r.ok) setPeople(r.data);
      else {
        toast.error(r.error);
        setPeople([]);
      }
    });
    return () => {
      live = false;
    };
  }, [demo]);

  function submit() {
    start(async () => {
      if (demo) {
        toast.success("Transfer sent", { description: "Guest preview — nothing changed" });
        onClose();
        return;
      }
      const r = await transferEstimateAction(estimateId, to, status, message);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Transfer sent", { description: "They accept it from their dashboard." });
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="transfer-dialog">
        <DialogHeader>
          <DialogTitle>Transfer {label}</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="tr-to">Transfer to</Label>
            <Select value={to} onValueChange={setTo} disabled={people === null}>
              <SelectTrigger id="tr-to" className="w-full" data-testid="transfer-to"><SelectValue placeholder={people === null ? "Loading…" : "Select a coworker"} /></SelectTrigger>
              <SelectContent>
                {(people ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name} · {p.initials}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tr-status">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="tr-status" className="w-full" data-testid="transfer-status"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TRANSFER_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tr-msg">Message</Label>
            <Textarea id="tr-msg" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={500} placeholder="What they need to know" className="min-h-20" data-testid="transfer-message" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={pending} disabled={!to} data-testid="transfer-confirm">Transfer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The Transfer button; the dialog opens on tap. Used on dashboard rows and the estimate page. */
export function TransferButton({ estimateId, label, summary, size = "sm", className }: { estimateId: string; label: string; summary: string; size?: "sm" | "default"; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" size={size} className={className} onClick={() => setOpen(true)} data-testid="transfer-button">
        <ArrowRightLeftIcon /> Transfer
      </Button>
      {open && <TransferDialog estimateId={estimateId} label={label} summary={summary} onClose={() => setOpen(false)} />}
    </>
  );
}
