import type { VehicleSize } from "./size-class";

/**
 * Retail quote maths, the same as public.quote_total() in migration 0038 so
 * the public pages can show a live total without a round trip. Prices come
 * from the size matrix (never typed here); modifiers are percent of the line
 * or flat per unit; tax applies to taxable lines, or to every line when the
 * shop says so. Both sides are tested against the same numbers.
 */
export interface QuoteService {
  id: string;
  name: string;
  benefit_text?: string | null;
  duration_minutes: number;
  taxable: boolean;
  placeholder?: boolean;
  open_amount?: boolean;
  /** Price per size class; a missing size falls back to `default_price`. */
  prices: Partial<Record<VehicleSize, number>>;
  default_price?: number | null;
}

export interface QuoteModifier {
  code: string;
  label: string;
  kind: "percent" | "flat";
  amount: number;
  active?: boolean;
}

export interface QuoteLineInput {
  service_id: string;
  qty?: number;
  label?: string | null;
  /** Open-amount ("Other") lines only: the amount typed. */
  price?: number | null;
  modifiers?: string[];
}

export interface QuoteLine {
  service_id: string;
  name: string;
  unit_price: number;
  qty: number;
  modifiers: { code: string; label: string; kind: "percent" | "flat"; amount: number }[];
  line_total: number;
  taxable: boolean;
  duration_minutes: number;
  placeholder: boolean;
}

export interface Quote {
  size_class: VehicleSize;
  lines: QuoteLine[];
  subtotal: number;
  tax_rate: number;
  tax: number;
  total: number;
  duration_minutes: number;
  placeholder: boolean;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function retailPrice(service: QuoteService, size: VehicleSize): number {
  const p = service.prices[size];
  if (typeof p === "number") return p;
  return Number(service.default_price ?? 0);
}

export function quoteTotal(
  input: { size: VehicleSize; lines: QuoteLineInput[] },
  catalog: { services: QuoteService[]; modifiers: QuoteModifier[]; taxRate: number; taxAllLines: boolean },
): Quote {
  const lines: QuoteLine[] = [];
  let subtotal = 0;
  let taxableSum = 0;
  for (const l of input.lines) {
    const svc = catalog.services.find((s) => s.id === l.service_id);
    if (!svc) throw new Error(`Unknown service ${l.service_id}`);
    const qty = Math.max(l.qty ?? 1, 0);
    const unit = svc.open_amount ? Math.max(Number(l.price ?? 0), 0) : retailPrice(svc, input.size);
    let lineTotal = round2(unit * qty);
    const applied: QuoteLine["modifiers"] = [];
    for (const code of l.modifiers ?? []) {
      const m = catalog.modifiers.find((x) => x.code === code && x.active !== false);
      if (!m) continue;
      const amount = m.kind === "percent" ? round2((unit * qty * m.amount) / 100) : round2(m.amount * qty);
      lineTotal += amount;
      applied.push({ code: m.code, label: m.label, kind: m.kind, amount });
    }
    const taxable = catalog.taxAllLines || svc.taxable;
    subtotal += lineTotal;
    if (taxable) taxableSum += lineTotal;
    lines.push({ service_id: svc.id, name: l.label || svc.name, unit_price: unit, qty, modifiers: applied, line_total: lineTotal, taxable, duration_minutes: svc.duration_minutes, placeholder: !!svc.placeholder });
  }
  const tax = round2(taxableSum * catalog.taxRate);
  return {
    size_class: input.size,
    lines,
    subtotal: round2(subtotal),
    tax_rate: catalog.taxRate,
    tax,
    total: round2(subtotal + tax),
    duration_minutes: lines.reduce((s, l) => s + l.duration_minutes * Math.max(l.qty, 1), 0),
    placeholder: lines.some((l) => l.placeholder),
  };
}

/** Deposit due for a total under the shop's policy. */
export function depositFor(total: number, policy: { deposit_kind: "percent" | "flat" | "none"; deposit_value: number }): number {
  if (policy.deposit_kind === "none" || total <= 0) return 0;
  if (policy.deposit_kind === "flat") return round2(Math.min(policy.deposit_value, total));
  return round2((total * policy.deposit_value) / 100);
}

// ---------------------------------------------------------------------------
// 0044: labor, parts, fees, sublets and shop supplies, the same maths as
// public._estimate_price_line() and public._estimate_option_totals().
// ---------------------------------------------------------------------------
export type LineType = "service" | "labor" | "part" | "fee" | "sublet";

/** What the builder holds per line before the server prices it. */
export type EstimateLineDraft = {
  line_type: LineType;
  service_id: string | null;
  qty: number;
  label: string | null;
  /** Open-amount services, parts, fees, sublets: the typed price. */
  price: number | null;
  modifiers: string[];
  hours: number | null;
  rate: number | null;
  part_number: string | null;
  vendor: string | null;
  taxable: boolean | null;
  cost: number | null;
  finding_id: string | null;
  /** Itemized under Diagnosis or Repairs. */
  section: "diagnosis" | "repair";
};

export interface SuppliesPolicy {
  shop_supplies_pct?: number | null;
  shop_supplies_cap?: number | null;
  shop_supplies_taxable?: boolean | null;
  parts_taxable_default?: boolean | null;
  labor_taxable_default?: boolean | null;
}

export interface PricedLine extends QuoteLine {
  line_type: LineType;
  hours: number | null;
  rate: number | null;
}

export const emptyLine = (line_type: LineType, patch: Partial<EstimateLineDraft> = {}): EstimateLineDraft => ({ line_type, service_id: null, qty: 1, label: null, price: null, modifiers: [], hours: null, rate: null, part_number: null, vendor: null, taxable: null, cost: null, finding_id: null, section: "repair", ...patch });

/** Price one line: a service through the matrix, labor = hours × rate, the rest qty × price. Throws on a bad line. */
export function priceLine(
  line: EstimateLineDraft,
  size: VehicleSize,
  catalog: { services: QuoteService[]; modifiers: QuoteModifier[]; taxRate: number; taxAllLines: boolean; defaultRate?: number | null; policy?: SuppliesPolicy | null },
): PricedLine {
  if (line.line_type === "service") {
    if (!line.service_id) throw new Error("A service line needs a service");
    const q = quoteTotal({ size, lines: [{ service_id: line.service_id, qty: line.qty, label: line.label, price: line.price, modifiers: line.modifiers }] }, catalog);
    return { ...q.lines[0], line_type: "service", hours: null, rate: null };
  }
  const name = (line.label ?? "").trim();
  if (!name) throw new Error(`A ${line.line_type} line needs a name`);
  if (line.line_type === "labor") {
    const hours = Number(line.hours ?? 0);
    const rate = line.rate ?? catalog.defaultRate ?? null;
    if (!(hours > 0)) throw new Error("Labor needs hours");
    if (rate === null || rate < 0) throw new Error("Pick a labor rate");
    const taxable = catalog.taxAllLines || (line.taxable ?? !!catalog.policy?.labor_taxable_default);
    return { line_type: "labor", service_id: "", name, unit_price: rate, qty: hours, modifiers: [], line_total: round2(hours * rate), taxable, duration_minutes: Math.round(hours * 60), placeholder: false, hours, rate };
  }
  const qty = Math.max(Number(line.qty ?? 1), 0.01);
  const unit = Math.max(Number(line.price ?? 0), 0);
  const taxable = catalog.taxAllLines || (line.taxable ?? (line.line_type === "part" ? (catalog.policy?.parts_taxable_default ?? true) : false));
  return { line_type: line.line_type, service_id: "", name, unit_price: unit, qty, modifiers: [], line_total: round2(unit * qty), taxable, duration_minutes: 0, placeholder: false, hours: null, rate: null };
}

export interface OptionTotals {
  subtotal: number;
  labor_subtotal: number;
  shop_supplies: number;
  tax: number;
  total: number;
  duration_minutes: number;
}

/** Shop supplies = min(pct × labor, cap); tax on the taxable lines (and the supplies when the shop says so). */
export function optionTotals(lines: { line_type?: LineType | null; line_total: number | null; taxable: boolean; duration_minutes: number; qty: number }[], taxRate: number, policy: SuppliesPolicy | null | undefined): OptionTotals {
  const subtotal = round2(lines.reduce((s, l) => s + (l.line_total ?? 0), 0));
  const labor = round2(lines.filter((l) => l.line_type === "labor").reduce((s, l) => s + (l.line_total ?? 0), 0));
  let supplies = 0;
  const pct = Number(policy?.shop_supplies_pct ?? 0);
  if (pct > 0 && labor > 0) {
    supplies = round2((labor * pct) / 100);
    if (policy?.shop_supplies_cap !== null && policy?.shop_supplies_cap !== undefined) supplies = Math.min(supplies, Number(policy.shop_supplies_cap));
  }
  let taxable = lines.filter((l) => l.taxable).reduce((s, l) => s + (l.line_total ?? 0), 0);
  if (policy?.shop_supplies_taxable) taxable += supplies;
  const tax = round2(taxable * taxRate);
  return {
    subtotal,
    labor_subtotal: labor,
    shop_supplies: supplies,
    tax,
    total: round2(subtotal + supplies + tax),
    duration_minutes: lines.reduce((s, l) => s + ((l.line_type ?? "service") === "service" ? l.duration_minutes * Math.max(l.qty, 1) : l.duration_minutes), 0),
  };
}
