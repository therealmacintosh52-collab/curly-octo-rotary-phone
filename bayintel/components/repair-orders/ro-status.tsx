"use client";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { deleteRepairOrderAction, setRoStatusAction } from "@/app/(app)/repair-orders/actions";

const STATUSES = ["open", "in_progress", "completed", "invoiced"] as const;

export function RoStatusButtons({ id, status }: { id: string; status: string }) {
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-4 gap-2">
        {STATUSES.map((s) => (
          <Button key={s} size="sm" variant={status === s ? "default" : "outline"} disabled={pending} onClick={() => start(async () => void (await setRoStatusAction(id, s)))} className="capitalize">
            {s.replace("_", " ")}
          </Button>
        ))}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="w-full text-destructive"
        disabled={pending}
        onClick={() => {
          if (confirm("Delete this repair order?")) start(async () => void (await deleteRepairOrderAction(id)));
        }}
      >
        Delete repair order
      </Button>
    </div>
  );
}
