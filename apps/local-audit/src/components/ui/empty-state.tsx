import { cn } from "@/lib/utils";

/** Centered empty / zero-result / error state with one clear next step. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  tone = "muted",
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  tone?: "muted" | "error";
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-6 py-12 text-center", className)}>
      {Icon && (
        <div className={cn("mb-4 flex size-12 items-center justify-center rounded-full", tone === "error" ? "bg-destructive/10 text-destructive" : "bg-accent text-muted-foreground")}>
          <Icon className="size-6" />
        </div>
      )}
      <div className="text-base font-semibold">{title}</div>
      {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
