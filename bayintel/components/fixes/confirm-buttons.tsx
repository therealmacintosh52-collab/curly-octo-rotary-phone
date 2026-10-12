"use client";
import { useState, useTransition } from "react";
import { ThumbsUp, ThumbsDown, Flag, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { confirmFixAction, removeConfirmationAction, reportFixAction } from "@/app/(app)/fixes/actions";
import { cn } from "@/lib/utils";

export function ConfirmButtons({ fixId, mine, isAuthor, confirmCount, denyCount }: { fixId: string; mine: "fixed" | "not_fixed" | null; isAuthor: boolean; confirmCount: number; denyCount: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<"fixed" | "not_fixed" | "report" | null>(null);
  const [note, setNote] = useState("");

  function vote(verdict: "fixed" | "not_fixed") {
    setError(null);
    start(async () => {
      const res = mine === verdict ? await removeConfirmationAction(fixId) : await confirmFixAction(fixId, verdict, note);
      if (res?.error) setError(res.error);
      setOpen(null);
      setNote("");
    });
  }

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={mine === "fixed" ? "success" : "outline"}
          size="lg"
          disabled={pending || isAuthor}
          onClick={() => (mine === "fixed" ? vote("fixed") : setOpen("fixed"))}
          className={cn(mine === "fixed" && "ring-2 ring-success")}
        >
          {pending ? <Loader2 className="animate-spin" /> : <ThumbsUp />} This fixed it ({confirmCount})
        </Button>
        <Button
          variant={mine === "not_fixed" ? "destructive" : "outline"}
          size="lg"
          disabled={pending || isAuthor}
          onClick={() => (mine === "not_fixed" ? vote("not_fixed") : setOpen("not_fixed"))}
        >
          <ThumbsDown /> Didn&apos;t fix it ({denyCount})
        </Button>
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{isAuthor ? "You can't vote on your own fix." : mine ? "Tap again to remove your vote." : "Vote after you've tried it on a real vehicle."}</span>
        <button type="button" className="tap inline-flex items-center gap-1 px-2 hover:text-foreground" onClick={() => setOpen("report")}>
          <Flag className="size-3.5" /> Report
        </button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Dialog open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent title={open === "report" ? "Report this fix" : open === "fixed" ? "Confirm: this fixed it" : "Report: didn't fix it"}>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={open === "report" ? "Why? (copied OEM content, spam, unsafe advice...)" : "Optional: mileage, what you tested, anything different on your vehicle"}
          />
          <Button
            className="mt-3 w-full"
            disabled={pending || (open === "report" && note.trim().length < 5)}
            onClick={() => {
              if (open === "report") {
                start(async () => {
                  const res = await reportFixAction(fixId, note);
                  if (res?.error) setError(res.error);
                  setOpen(null);
                  setNote("");
                });
              } else if (open) vote(open);
            }}
          >
            {open === "report" ? "Send report" : "Submit vote"}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
