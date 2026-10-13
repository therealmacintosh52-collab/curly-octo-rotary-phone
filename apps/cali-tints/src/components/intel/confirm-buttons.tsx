"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ThumbsDownIcon, ThumbsUpIcon } from "lucide-react";
import { toast } from "sonner";
import { confirmFixAction, unconfirmFixAction } from "@/app/(app)/intel/actions";
import { useSession } from "@/components/app/session-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";

/** "This fixed it" / "Didn't fix it" with an optional note; tap your vote again to take it back. Nobody votes on their own fix. */
export function ConfirmButtons({ fixId, mine, isAuthor, confirmCount, denyCount }: { fixId: string; mine: "fixed" | "not_fixed" | null; isAuthor: boolean; confirmCount: number; denyCount: number }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState<"fixed" | "not_fixed" | null>(null);
  const [note, setNote] = useState("");

  function vote(verdict: "fixed" | "not_fixed", withNote?: string) {
    start(async () => {
      if (demo) {
        toast.success(mine === verdict ? "Vote removed" : "Vote recorded", { description: "Guest preview — nothing changed" });
        setOpen(null);
        return;
      }
      const r = mine === verdict ? await unconfirmFixAction(fixId) : await confirmFixAction(fixId, verdict, withNote);
      if (!r.ok) toast.error(r.error);
      setOpen(null);
      setNote("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-2" data-testid="fix-vote">
      <div className="grid grid-cols-2 gap-2">
        <Button variant={mine === "fixed" ? "default" : "outline"} disabled={pending || isAuthor} onClick={() => (mine === "fixed" ? vote("fixed") : setOpen("fixed"))} data-testid="fix-vote-fixed">
          <ThumbsUpIcon /> This fixed it ({confirmCount})
        </Button>
        <Button variant={mine === "not_fixed" ? "destructive" : "outline"} disabled={pending || isAuthor} onClick={() => (mine === "not_fixed" ? vote("not_fixed") : setOpen("not_fixed"))} data-testid="fix-vote-not">
          <ThumbsDownIcon /> Didn&apos;t fix it ({denyCount})
        </Button>
      </div>
      <p className="text-caption text-muted-foreground">{isAuthor ? "You can't vote on your own fix." : mine ? "Tap your vote again to take it back." : "Vote after you've tried it on a car."}</p>
      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{open === "fixed" ? "This fixed it" : "It didn't fix it"}</DialogTitle>
            <DialogDescription>Optional: the mileage, what you tested, anything different on your car.</DialogDescription>
          </DialogHeader>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className="min-h-20" data-testid="fix-vote-note" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(null)}>
              Cancel
            </Button>
            <Button onClick={() => open && vote(open, note)} loading={pending} data-testid="fix-vote-submit">
              Save my vote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
