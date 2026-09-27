import { cn } from "@/lib/utils";

/**
 * Page title row. One primary action per page lives in `actions`; the
 * description is the place for the one-line summary (counts, totals, scope).
 */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Small line above the title (e.g. a parent section or status). */
  eyebrow?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="min-w-0">
        {eyebrow ? <div className="text-label mb-1.5 text-subtle">{eyebrow}</div> : null}
        <h1 className="text-title text-balance">{title}</h1>
        {description ? <p className="mt-1.5 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/** Page container with the app's standard gutters (16 on phones, 32 on desktop). */
export function Page({ children, className, narrow }: { children: React.ReactNode; className?: string; narrow?: boolean }) {
  return <div className={cn("mx-auto w-full px-4 py-5 sm:px-6 sm:py-6 lg:px-8", narrow ? "max-w-2xl" : "max-w-7xl", className)}>{children}</div>;
}

/** Section heading inside a page: heading + optional trailing control. */
export function SectionHeader({ title, aside, className }: { title: React.ReactNode; aside?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <h2 className="text-heading">{title}</h2>
      {aside ? <div className="min-w-0">{aside}</div> : null}
    </div>
  );
}
