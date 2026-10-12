"use client";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteEstimateAction, setEstimateStatusAction } from "@/app/(app)/estimates/actions";

const STATUSES = ["draft", "sent", "approved", "declined"] as const;

export function EstimateStatusButtons({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {STATUSES.map((s) => (
          <Button key={s} size="sm" variant={status === s ? "default" : "outline"} disabled={pending} onClick={() => start(async () => void (await setEstimateStatusAction(id, s)))} className="capitalize">
            {s}
          </Button>
        ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-destructive"
        disabled={pending}
        onClick={() => {
          if (confirm("Delete this estimate?")) start(async () => void (await deleteEstimateAction(id)));
        }}
      >
        Delete estimate
      </Button>
    </div>
  );
}
