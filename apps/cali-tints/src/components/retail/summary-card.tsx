import { DollarSignIcon } from "lucide-react";
import type { EstimateOptionView, EstimateView } from "@/lib/db/types";
import { bucketOf } from "@/lib/retail/job-financials";
import { formatMoney, formatTaxRate } from "@/lib/money";

const money = (n: number | null | undefined) => (n === null || n === undefined ? "" : formatMoney(n));

/**
 * The money of a visit in the shop's own order: labor, parts, fees, sublets, shop supplies, subtotal,
 * tax and the grand total in a dark bar. Owner, admin and advisor only.
 */
export function SummaryCard({ e, option, accepted }: { e: EstimateView; option: EstimateOptionView | null; accepted: boolean }) {
  const lines = (option?.lines ?? []).filter((l) => !(accepted && option?.tier === "single" && l.customer_approved === false));
  const sum = (b: "labor" | "parts" | "fees" | "sublet") => lines.filter((l) => bucketOf(l.line_type ?? "service") === b).reduce((s, l) => s + (l.line_total ?? 0), 0);
  const row = (label: string, value: React.ReactNode, testId?: string) => (
    <div className="flex justify-between gap-3"><span className="text-muted-foreground">{label}</span><span className="tabular-nums" data-testid={testId}>{value}</span></div>
  );
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card surface-raised" data-testid="estimate-money">
      <header className="flex items-center gap-2 border-b border-border bg-muted/50 px-3 py-2.5 text-base font-semibold"><DollarSignIcon className="size-4 text-muted-foreground" /> Summary</header>
      <div className="grid gap-1.5 px-4 py-3 text-sm">
        {row("Total labor", money(sum("labor")), "summary-labor")}
        {row("Total parts", money(sum("parts")), "summary-parts")}
        {row("Total fees", money(sum("fees")), "summary-fees")}
        {row("Total sublets", money(sum("sublet")), "summary-sublet")}
        {(e.shop_supplies ?? 0) > 0 && row("Shop supplies", money(e.shop_supplies), "estimate-supplies")}
        <div className="flex justify-between gap-3 border-t border-border pt-1.5 font-semibold"><span>{accepted || e.options.length === 1 ? "Subtotal" : "Subtotal (recommended)"}</span><span className="tabular-nums" data-testid="summary-subtotal">{money(e.subtotal)}</span></div>
        {row(`Sales tax (${formatTaxRate(Number(e.tax_rate ?? 0))})`, money(e.tax), "summary-tax")}
      </div>
      <div className="flex items-center justify-between bg-[#2b2f33] px-4 py-2.5 text-white">
        <span className="font-semibold">Grand total</span>
        <span className="text-lg font-semibold tabular-nums" data-testid="estimate-total">{money(e.total)}</span>
      </div>
      {((e.deposit_required ?? 0) > 0 || e.po_number) && (
        <div className="grid gap-1 px-4 py-2.5 text-caption text-subtle">
          {(e.deposit_required ?? 0) > 0 && <div className="flex justify-between"><span>Deposit to book</span><span className="tabular-nums">{money(e.deposit_required)}</span></div>}
          {e.po_number && <div className="flex justify-between"><span>PO</span><span>{e.po_number}</span></div>}
        </div>
      )}
    </section>
  );
}
