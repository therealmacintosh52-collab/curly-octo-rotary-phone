import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import type { RetailDashboard } from "@/lib/db/types";
import { formatMoney } from "@/lib/money";
import { StatTile } from "./stat-tile";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * The shop's own side, on the same dashboard as the dealerships but in a block
 * of its own: retail cars, what was collected at the counter, the retail
 * invoices still open. Counts for every admin-side role; the money only for
 * whoever may see it (`data.money`). The dealership numbers above never
 * include any of this.
 */
export function RetailBlock({ data, shopName }: { data: RetailDashboard | null; shopName?: string }) {
  if (!data) return null;
  const m = data.money;
  return (
    <section className="mt-10 border-t border-border pt-6" aria-labelledby="retail-block-title" data-testid="retail-block">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="retail-block-title" className="text-heading">Retail</h2>
          <p className="text-caption text-subtle">{shopName ? `${shopName} · ` : ""}the shop&apos;s own customers, separate from the dealerships above</p>
        </div>
        <Link href="/retail" className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-medium text-primary hover:underline" data-testid="retail-block-open">
          Open Retail <ArrowRightIcon className="size-4" />
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile size="sm" label="Cars today" value={String(data.today.cars)} sub={data.appointments_today > 0 ? `${plural(data.appointments_today, "appointment", "appointments")} on the calendar` : "no appointments today"} href="/retail" />
        <StatTile size="sm" label="Cars this month" value={String(data.month.cars)} sub={`${plural(data.open_jobs, "repair order", "repair orders")} not paid yet`} href="/retail/jobs" />
        {m ? (
          <>
            <StatTile size="sm" label="Collected this week" value={formatMoney(m.collected_week)} sub={`${formatMoney(m.collected_month)} this month`} tone="accent" href="/retail/invoices?status=paid" />
            <StatTile size="sm" label="Retail to collect" value={formatMoney(m.unpaid_total)} sub={`${plural(m.unpaid_invoices, "invoice", "invoices")}${m.deposits_outstanding > 0 ? ` · ${formatMoney(m.deposits_outstanding)} deposits due` : ""}`} tone={m.unpaid_invoices > 0 ? "warning" : undefined} href="/retail/invoices" />
          </>
        ) : null}
      </div>
    </section>
  );
}
