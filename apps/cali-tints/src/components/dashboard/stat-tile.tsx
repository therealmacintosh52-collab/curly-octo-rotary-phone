import { cn } from "@/lib/utils";

/** KPI tile: label, big proportional-figure value, optional sub line. */
export function StatTile({ label, value, sub, tone, className }: { label: string; value: string; sub?: string; tone?: "accent" | "warning" | "info"; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card px-4 py-4 surface-gradient", className)}>
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1.5 text-2xl font-semibold leading-none sm:text-3xl", tone === "accent" && "text-primary", tone === "warning" && "text-warning", tone === "info" && "text-info")}>
        {value}
      </div>
      {sub ? <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div> : null}
    </div>
  );
}
