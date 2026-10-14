"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2Icon, ChevronRightIcon } from "lucide-react";
import { toast } from "sonner";
import { closeRoAction } from "@/app/(app)/jobs/actions";
import { useSession } from "@/components/app/session-provider";
import { nextJobAction, type JobAction, type JobActionInput } from "@/lib/retail/job-action";
import { RO_EVENTS } from "./retail-payment";
import { RO_CONVERT_EVENT } from "./ro-invoice-card";
import { Button } from "@/components/ui/button";

/**
 * The one button at the bottom of a retail job. It changes with the stage:
 * Mark the work done → Sign off the work → Convert to invoice → Collect payment →
 * Customer signs → Close job · Picked up. Closing needs the payment and the
 * customer's signature; it is what ends the job (and starts the reminder for any
 * work they put off).
 */
export function JobStageBar({ jobId, input, override, leading, trailing }: { jobId?: string; input?: JobActionInput; /** Before there is a visit to work on (a draft, an estimate out with the customer) the page supplies the step itself. */ override?: { action: NonNullable<JobAction>; onClick?: () => void }; /** Left of the bar: Edit, + Service. */ leading?: ReactNode; /** Beside the main button: Share. */ trailing?: ReactNode }) {
  const router = useRouter();
  const { demo } = useSession();
  const [pending, start] = useTransition();
  const action = override ? override.action : input ? nextJobAction(input) : null;
  if (!action) return null;

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  function go() {
    if (!action) return;
    if (override) return override.onClick?.();
    switch (action.key) {
      case "complete":
      case "qc":
        return scrollTo("ro-work");
      case "convert":
        return void window.dispatchEvent(new Event(RO_CONVERT_EVENT));
      case "collect":
        return void window.dispatchEvent(new Event(RO_EVENTS.collect));
      case "sign":
        return void window.dispatchEvent(new Event(RO_EVENTS.sign));
      case "close":
        return start(async () => {
          if (demo) return void toast.success("Closed · picked up", { description: "Guest preview — nothing changed" });
          const r = await closeRoAction(jobId!);
          if (!r.ok) return void toast.error(r.error);
          toast.success("Closed · picked up");
          router.refresh();
        });
    }
  }

  const closed = action.key === "closed";
  return (
    <div className="sticky bottom-[5.25rem] z-30 mt-5 lg:bottom-4" data-testid="job-stage-bar" data-action={action.key}>
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card/95 p-3 shadow-xl shadow-black/30 backdrop-blur">
        {action.hint && <p className="px-1 text-caption text-muted-foreground" data-testid="job-stage-hint">{action.hint}</p>}
        {(leading || trailing) && (
          <div className="flex items-center justify-between gap-2" data-testid="stage-bar-tools">
            <div className="flex items-center gap-2">{leading}</div>
            <div className="flex items-center gap-2">{trailing}</div>
          </div>
        )}
        <Button size="lg" className="w-full justify-between" onClick={go} disabled={!action.enabled || closed} loading={pending} variant={closed ? "outline" : "default"} data-testid="job-stage-button">
          <span className="inline-flex items-center gap-2">{closed && <CheckCircle2Icon />} {action.label}</span>
          {!closed && <ChevronRightIcon />}
        </Button>
      </div>
    </div>
  );
}
