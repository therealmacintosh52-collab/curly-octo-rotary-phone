"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SendIcon } from "lucide-react";
import { toast } from "sonner";
import type { RetailTechnician } from "@/lib/db/types";
import { retailTechniciansAction, sendToTechAction } from "@/app/(app)/retail/estimates/actions";
import { useSession } from "@/components/app/session-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const DEMO_TECHS: RetailTechnician[] = [
  { id: "u2", name: "Victor Kim", initials: "VK" },
  { id: "u3", name: "Dee One", initials: "DO" },
];

/** The advisor picks a technician; the work order moves under that tech's name on the Workflow board. */
function SendToTechDialog({ estimateId, label, summary, onClose }: { estimateId: string; label: string; summary: string; onClose: () => void }) {
  const router = useRouter();
  const { demo } = useSession();
  const [techs, setTechs] = useState<RetailTechnician[] | null>(demo ? DEMO_TECHS : null);
  const [tech, setTech] = useState("");
  const [pending, start] = useTransition();
  useEffect(() => {
    if (demo) return;
    let live = true;
    retailTechniciansAction().then((r) => {
      if (!live) return;
      if (r.ok) setTechs(r.data);
      else {
        toast.error(r.error);
        setTechs([]);
      }
    });
    return () => {
      live = false;
    };
  }, [demo]);

  function submit() {
    start(async () => {
      if (demo) {
        toast.success("Sent to the tech", { description: "Guest preview — nothing changed" });
        onClose();
        return;
      }
      const r = await sendToTechAction(estimateId, tech);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Sent to the tech", { description: `${label} is on their list now.` });
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent data-testid="send-tech-dialog">
        <DialogHeader>
          <DialogTitle>Send {label} to a tech</DialogTitle>
          <DialogDescription>{summary}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-1.5">
          <Label htmlFor="st-tech">Technician</Label>
          <Select value={tech} onValueChange={setTech} disabled={techs === null}>
            <SelectTrigger id="st-tech" className="w-full" data-testid="send-tech-select"><SelectValue placeholder={techs === null ? "Loading…" : techs.length === 0 ? "No technicians on the team" : "Select a technician"} /></SelectTrigger>
            <SelectContent>
              {(techs ?? []).map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.name} · {t.initials}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} loading={pending} disabled={!tech} data-testid="send-tech-confirm">Send to tech</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The Send to tech button (owner, admin, advisor): on cards waiting for a tech and on the work order. */
export function SendToTechButton({ estimateId, label, summary, size = "sm", variant = "default", text = "Send to tech", className }: { estimateId: string; label: string; summary: string; size?: "sm" | "default"; variant?: "default" | "outline"; text?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant={variant} size={size} className={className} onClick={() => setOpen(true)} data-testid="send-tech-button">
        <SendIcon /> {text}
      </Button>
      {open && <SendToTechDialog estimateId={estimateId} label={label} summary={summary} onClose={() => setOpen(false)} />}
    </>
  );
}
