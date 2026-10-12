import { computeTotals } from "@/lib/estimates/calc";
import { formatDate, formatMoney } from "@/lib/utils";

export interface EstimateDocData {
  estimate_number: number;
  status: string;
  created_at: string;
  valid_until: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  labor_rate: number;
  tax_rate: number;
  tax_parts: boolean;
  tax_labor: boolean;
  notes: string | null;
  shop: { name: string; phone: string | null; email: string | null; address: string | null } | null;
  vehicle: { year: number; make: string; model: string; engine: string | null; vin: string | null; plate: string | null; mileage: number | null } | null;
  lines: { kind: "part" | "labor" | "fee"; description: string; part_number: string | null; quantity: number; unit_price: number; hours: number | null; taxable: boolean | null }[];
}

export function estimateTotals(e: EstimateDocData) {
  return computeTotals(e.lines, { taxRate: e.tax_rate, taxParts: e.tax_parts, taxLabor: e.tax_labor });
}

export function EstimateDoc({ e }: { e: EstimateDocData }) {
  const t = estimateTotals(e);
  return (
    <article className="rounded-xl border border-border bg-card p-5 text-sm">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-bold">{e.shop?.name ?? "Estimate"}</p>
          {e.shop?.address && <p className="text-muted-foreground">{e.shop.address}</p>}
          <p className="text-muted-foreground">{[e.shop?.phone, e.shop?.email].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="text-right">
          <p className="font-semibold">Estimate #{e.estimate_number}</p>
          <p className="text-muted-foreground">{formatDate(e.created_at)}</p>
          {e.valid_until && <p className="text-muted-foreground">Valid until {formatDate(e.valid_until)}</p>}
          <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">{e.status}</p>
        </div>
      </header>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Customer</p>
          <p>{e.customer_name ?? "—"}</p>
          <p className="text-muted-foreground">{[e.customer_phone, e.customer_email].filter(Boolean).join(" · ")}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-muted-foreground">Vehicle</p>
          {e.vehicle ? (
            <>
              <p>
                {e.vehicle.year} {e.vehicle.make} {e.vehicle.model}
                {e.vehicle.engine ? ` · ${e.vehicle.engine}` : ""}
              </p>
              <p className="font-mono text-xs text-muted-foreground">{[e.vehicle.vin, e.vehicle.plate, e.vehicle.mileage ? `${e.vehicle.mileage.toLocaleString()} mi` : null].filter(Boolean).join(" · ")}</p>
            </>
          ) : (
            <p>—</p>
          )}
        </div>
      </div>
      <table className="mt-5 w-full">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
            <th className="py-1.5 font-semibold">Item</th>
            <th className="py-1.5 text-right font-semibold">Qty / Hrs</th>
            <th className="py-1.5 text-right font-semibold">Rate</th>
            <th className="py-1.5 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {e.lines.map((l, i) => (
            <tr key={i} className="border-b border-border/60">
              <td className="py-1.5 pr-2">
                <span className="mr-1.5 rounded bg-muted px-1 text-[10px] uppercase text-muted-foreground">{l.kind}</span>
                {l.description}
                {l.part_number && <span className="ml-1 font-mono text-xs text-muted-foreground">{l.part_number}</span>}
              </td>
              <td className="py-1.5 text-right tabular-nums">{l.kind === "labor" ? `${l.hours ?? 0} h` : l.quantity}</td>
              <td className="py-1.5 text-right tabular-nums">{formatMoney(l.unit_price)}</td>
              <td className="py-1.5 text-right tabular-nums">{formatMoney(t.lines[i].amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="ml-auto mt-3 grid w-56 grid-cols-2 gap-y-0.5">
        <dt className="text-muted-foreground">Parts</dt>
        <dd className="text-right tabular-nums">{formatMoney(t.parts)}</dd>
        <dt className="text-muted-foreground">Labor</dt>
        <dd className="text-right tabular-nums">{formatMoney(t.labor)}</dd>
        {t.fees > 0 && (
          <>
            <dt className="text-muted-foreground">Fees</dt>
            <dd className="text-right tabular-nums">{formatMoney(t.fees)}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Tax ({(e.tax_rate * 100).toFixed(2).replace(/\.?0+$/, "")}%)</dt>
        <dd className="text-right tabular-nums">{formatMoney(t.tax)}</dd>
        <dt className="mt-1 border-t border-border pt-1 font-bold">Total</dt>
        <dd className="mt-1 border-t border-border pt-1 text-right font-bold tabular-nums">{formatMoney(t.total)}</dd>
      </dl>
      {e.notes && <p className="mt-4 whitespace-pre-wrap text-muted-foreground">{e.notes}</p>}
      <p className="mt-4 text-xs text-muted-foreground">This estimate is not a final invoice. Additional diagnosis may change parts and labor; you will be contacted for authorization before additional work.</p>
    </article>
  );
}
