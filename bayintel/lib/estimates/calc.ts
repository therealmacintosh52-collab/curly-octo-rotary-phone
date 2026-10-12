export interface EstimateLineInput {
  kind: "part" | "labor" | "fee";
  description: string;
  part_number?: string | null;
  quantity: number; // parts/fees
  unit_price: number; // parts/fees: unit price; labor: rate snapshot
  hours?: number | null; // labor
  taxable?: boolean | null; // null = default by kind
}

export interface EstimateTotals {
  parts: number;
  labor: number;
  fees: number;
  subtotal: number;
  taxable: number;
  tax: number;
  total: number;
  lines: { amount: number; taxable: boolean }[];
}

export function lineAmount(l: EstimateLineInput): number {
  if (l.kind === "labor") return round2((l.hours ?? 0) * l.unit_price);
  return round2(l.quantity * l.unit_price);
}

export function computeTotals(lines: EstimateLineInput[], opts: { taxRate: number; taxParts: boolean; taxLabor: boolean }): EstimateTotals {
  let parts = 0;
  let labor = 0;
  let fees = 0;
  let taxable = 0;
  const out: EstimateTotals["lines"] = [];
  for (const l of lines) {
    const amount = lineAmount(l);
    const isTaxable = l.taxable ?? (l.kind === "part" ? opts.taxParts : l.kind === "labor" ? opts.taxLabor : false);
    if (l.kind === "part") parts += amount;
    else if (l.kind === "labor") labor += amount;
    else fees += amount;
    if (isTaxable) taxable += amount;
    out.push({ amount, taxable: isTaxable });
  }
  const subtotal = round2(parts + labor + fees);
  const tax = round2(taxable * opts.taxRate);
  return { parts: round2(parts), labor: round2(labor), fees: round2(fees), subtotal, taxable: round2(taxable), tax, total: round2(subtotal + tax), lines: out };
}

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
