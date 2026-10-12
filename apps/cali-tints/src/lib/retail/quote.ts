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
