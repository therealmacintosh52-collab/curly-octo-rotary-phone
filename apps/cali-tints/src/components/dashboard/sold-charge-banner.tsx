import Link from "next/link";
import { ChevronRightIcon, TriangleAlertIcon } from "lucide-react";

/**
 * Owner, admin and manager. Open jobs with the Sold service and no PDI or Used (logged before the rule,
 * or left that way): the manager adjusts them before the month closes. New ones are refused at save.
 */
export function SoldChargeBanner({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6">
      <Link
        href="/jobs?status=open&sold_missing=1"
        className="group flex items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm transition-colors hover:border-warning/70"
        data-testid="sold-charge-banner"
      >
        <TriangleAlertIcon className="size-4 shrink-0 text-warning" />
        <span className="min-w-0 flex-1">
          <span className="font-medium">
            {count} sold {count === 1 ? "car needs" : "cars need"} PDI or Used
          </span>{" "}
          <span className="text-muted-foreground">· Sold is not billed on its own. Open each one and add PDI or Used.</span>
        </span>
        <ChevronRightIcon className="size-4 shrink-0 text-subtle transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}
