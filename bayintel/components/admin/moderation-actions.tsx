"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { moderateAction } from "@/app/(app)/fixes/actions";

export function ModerationActions({ queueId }: { queueId: string }) {
  const [pending, start] = useTransition();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const act = (d: "approve" | "reject" | "flag" | "dismiss") =>
    start(async () => {
      const res = await moderateAction(queueId, d, note);
      if (res?.error) setError(res.error);
    });
  return (
    <div className="mt-3 space-y-2">
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Resolution note (optional)" className="h-10 text-sm" />
      <div className="grid grid-cols-4 gap-2">
        <Button size="sm" variant="success" disabled={pending} onClick={() => act("approve")}>Approve</Button>
        <Button size="sm" variant="secondary" disabled={pending} onClick={() => act("flag")}>Flag</Button>
        <Button size="sm" variant="destructive" disabled={pending} onClick={() => act("reject")}>Reject</Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => act("dismiss")}>Dismiss</Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
