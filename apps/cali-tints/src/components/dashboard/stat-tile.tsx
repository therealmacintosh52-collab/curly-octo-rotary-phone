import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** KPI tile: label, big proportional-figure value, optional sub line. With `href` the whole tile drills into the detail list. */
export function StatTile({
  label,
  value,
  sub,
  tone,
  href,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "accent" | "warning" | "info";
  href?: string;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
        {href && <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />}
      </div>
      <div className={cn("mt-1.5 text-2xl font-semibold leading-none sm:text-3xl", tone === "accent" && "text-primary", tone === "warning" && "text-warning", tone === "info" && "text-info")}>
        {value}
      </div>
      {sub ? <div className="mt-1.5 text-xs text-muted-foreground">{sub}</div> : null}
    </>
  );
  const classes = cn("block rounded-2xl border border-border bg-card px-4 py-4 surface-gradient", href && "group transition-colors hover:border-primary/50 hover:bg-accent/40", className);
  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
