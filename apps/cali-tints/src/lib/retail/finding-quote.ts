import type { LaborRate, RetailCatalog } from "@/lib/db/types";
import { optionTotals, priceLine, emptyLine, type EstimateLineDraft, type OptionTotals, type SuppliesPolicy } from "@/lib/retail/quote";

/**
 * Pricing a finding on the spot (0053): the shop's labor rate, tax rate and
 * supplies policy, boiled down to what the little sheet beside a finding needs.
 */
export type FindingPricing = { taxRate: number; taxAll: boolean; defaultRate: number | null; rates: { id: string; name: string; rate: number }[]; policy: SuppliesPolicy | null };

export function findingPricing(catalog: Pick<RetailCatalog, "tax_rate" | "settings" | "labor_rates">): FindingPricing {
  const active = (catalog.labor_rates ?? []).filter((r: LaborRate) => r.active);
  return {
    taxRate: Number(catalog.tax_rate ?? 0),
    taxAll: !!catalog.settings?.tax_all_lines,
    defaultRate: (active.find((r) => r.is_default) ?? active[0])?.rate ?? null,
    rates: active.map((r) => ({ id: r.id, name: r.name, rate: Number(r.rate) })),
    policy: catalog.settings ?? null,
  };
}

/** One row of the sheet: labor (hours × rate), a part (qty × price) or a fee. */
export type FindingRow = { type: "labor" | "part" | "fee"; label: string; hours: string; rate: string; qty: string; price: string; part_number: string };

export function emptyRow(type: FindingRow["type"], pricing: FindingPricing, label = ""): FindingRow {
  return { type, label, hours: type === "labor" ? "1" : "", rate: type === "labor" && pricing.defaultRate !== null ? String(pricing.defaultRate) : "", qty: "1", price: "", part_number: "" };
}

const num = (v: string) => (v.trim() === "" ? 0 : Number(v));

/** A row that has something to price (an empty row is ignored, a half-filled one is an error). */
export function rowToDraft(r: FindingRow): EstimateLineDraft | null {
  const label = r.label.trim();
  const empty = !label && !num(r.price) && !(r.type === "labor" && num(r.hours) && r.label.trim());
  if (empty) return null;
  const base = emptyLine(r.type === "labor" ? "labor" : r.type === "part" ? "part" : "fee", { label });
  if (r.type === "labor") return { ...base, hours: num(r.hours), rate: r.rate.trim() === "" ? null : num(r.rate) };
  if (r.type === "part") return { ...base, qty: num(r.qty) || 1, price: num(r.price), part_number: r.part_number.trim() || null };
  return { ...base, price: num(r.price) };
}

export type SheetTotals = OptionTotals & { lines: number; error: string | null };

/** What these rows add to the estimate: subtotal, shop supplies, tax and the total ("plus tax"). */
export function rowsTotals(rows: FindingRow[], pricing: FindingPricing): SheetTotals {
  const priced = [];
  let error: string | null = null;
  for (const r of rows) {
    const d = rowToDraft(r);
    if (!d) continue;
    try {
      priced.push(priceLine(d, "sedan", { services: [], modifiers: [], taxRate: pricing.taxRate, taxAllLines: pricing.taxAll, defaultRate: pricing.defaultRate, policy: pricing.policy }));
    } catch (e) {
      error ??= e instanceof Error ? e.message : "Check the lines";
    }
  }
  return { ...optionTotals(priced, pricing.taxRate, pricing.policy), lines: priced.length, error };
}

/** The payload add_finding_lines takes. */
export function rowsPayload(rows: FindingRow[]): { line_type: "labor" | "part" | "fee"; label: string; hours?: number; rate?: number; qty?: number; price?: number; part_number?: string }[] {
  const out = [];
  for (const r of rows) {
    const d = rowToDraft(r);
    if (!d) continue;
    if (r.type === "labor") out.push({ line_type: "labor" as const, label: r.label.trim(), hours: num(r.hours), ...(r.rate.trim() !== "" ? { rate: num(r.rate) } : {}) });
    else if (r.type === "part") out.push({ line_type: "part" as const, label: r.label.trim(), qty: num(r.qty) || 1, price: num(r.price), ...(r.part_number.trim() ? { part_number: r.part_number.trim() } : {}) });
    else out.push({ line_type: "fee" as const, label: r.label.trim(), price: num(r.price) });
  }
  return out;
}
