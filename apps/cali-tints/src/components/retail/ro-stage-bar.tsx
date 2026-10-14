import { CheckIcon } from "lucide-react";
import { RO_STAGES, roStage, type RoStageInput } from "@/lib/retail/stage";
import { cn } from "@/lib/utils";

const SHORT: Record<string, string> = { estimate: "Estimate", in_progress: "In progress", invoice: "Invoice", closed: "Closed" };

/**
 * Estimate → In progress → Invoice → Closed: one document, the same number
 * all the way (0052). Shown on the estimate and the invoice so everyone sees
 * where it stands.
 */
export function RoStageBar({ roNumber, className, ...input }: RoStageInput & { roNumber?: string | null; className?: string }) {
  const stage = roStage(input);
  // Paid but still on the lot is the current step; "Close job · Picked up" is what ticks the last one.
  const finished = stage.key === "closed" && input.pickedUpAt !== null;
  return (
    <div className={cn("rounded-xl border border-border bg-card px-3 py-3 sm:px-4", className)} data-testid="ro-stage" data-stage={stage.key}>
      <ol className="grid grid-cols-4 gap-1.5" aria-label="Repair order stage">
        {RO_STAGES.map((s, i) => {
          const done = i < stage.index || (s.key === "closed" && finished);
          const current = i === stage.index && !done;
          return (
            <li key={s.key} className="grid gap-1.5" aria-current={current ? "step" : undefined} data-state={done ? "done" : current ? "current" : "todo"}>
              <span className={cn("h-1.5 rounded-full", done ? "bg-primary" : current ? "bg-primary/60" : "bg-border")} />
              <span className={cn("flex items-center gap-1 text-xs", current ? "font-semibold text-foreground" : done ? "text-muted-foreground" : "text-subtle")}>
                {done && <CheckIcon className="size-3 text-primary" aria-hidden />}
                <span className="sm:hidden">{SHORT[s.key]}</span>
                <span className="hidden sm:inline">{s.label}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
        <span className="font-medium" data-testid="ro-stage-label">{stage.label}{stage.sub ? <span className="font-normal text-muted-foreground"> · {stage.sub}</span> : null}</span>
        {roNumber && <span className="text-muted-foreground" data-testid="ro-stage-number">{roNumber}</span>}
      </div>
    </div>
  );
}
