import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * KPI tile. `size="lg"` for the primary row (the four numbers the owner checks
 * daily), `size="sm"` for the supporting row. With `href` the whole tile
 * drills into the list behind the number.
 */
export function StatTile({
  label,
  value,
  sub,
  tone,
  href,
  size = "lg",
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "accent" | "warning" | "info";
  href?: string;
  size?: "lg" | "sm";
  className?: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <div className="text-label text-muted-foreground">{label}</div>
        {href && <ChevronRightIcon className="size-4 shrink-0 text-subtle transition-[transform,color] duration-150 group-hover:translate-x-0.5 group-hover:text-primary" />}
      </div>
      <div
        className={cn(
          "mt-2 tabular-nums font-semibold tracking-tight",
          size === "lg" ? "text-[1.75rem] leading-8 sm:text-[2rem] sm:leading-9" : "text-xl leading-7",
          tone === "accent" && "text-primary",
          tone === "warning" && "text-warning",
          tone === "info" && "text-info",
        )}
      >
        {value}
      </div>
      {sub ? <div className="mt-1 text-caption text-subtle">{sub}</div> : null}
    </>
  );
  const classes = cn(
    "block rounded-xl border border-border bg-card surface-raised",
    size === "lg" ? "px-4 py-4 sm:px-5" : "px-4 py-3.5",
    href && "group transition-[border-color,background-color,transform] duration-150 ease-out hover:-translate-y-px hover:border-border-strong hover:bg-accent/40 motion-reduce:transform-none",
    className,
  );
  return href ? (
    <Link href={href} className={classes}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}
