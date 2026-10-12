import Link from "next/link";
import { ChevronRightIcon, TagIcon } from "lucide-react";

/**
 * Owner only. Someone logged "Other" on an open job; the price is still 0
 * until the owner sets it. Shown above the dashboard until the list is empty.
 */
export function NeedsPriceBanner({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6">
      <Link
        href="/jobs?status=open&needs_price=1"
        className="group flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm transition-colors hover:border-warning/70"
        data-testid="needs-price-banner"
      >
        <TagIcon className="size-4 shrink-0 text-warning" />
        <span className="min-w-0 flex-1">
          <span className="font-medium">
            {count} {count === 1 ? "job needs" : "jobs need"} a price
          </span>{" "}
          <span className="text-muted-foreground">· logged as Other without an amount. Set it before the month closes.</span>
        </span>
        <ChevronRightIcon className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
