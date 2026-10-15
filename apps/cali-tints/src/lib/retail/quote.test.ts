import { describe, expect, it } from "vitest";
import { depositFor, quoteTotal, type QuoteModifier, type QuoteService } from "./quote";
import { renderTemplate, templateFor } from "./templates";

const services: QuoteService[] = [
  { id: "full", name: "Full detail", duration_minutes: 240, taxable: false, placeholder: true, prices: { compact: 180, sedan: 200, suv_truck: 240, xl: 290 } },
  { id: "oil", name: "Oil change", duration_minutes: 45, taxable: true, prices: { compact: 55, sedan: 60, suv_truck: 75, xl: 90 } },
  { id: "tire", name: "Tire shine", duration_minutes: 15, taxable: false, prices: { sedan: 15 }, default_price: 15 },
  { id: "other", name: "Other", duration_minutes: 60, taxable: false, open_amount: true, prices: {}, default_price: 0 },
];
const modifiers: QuoteModifier[] = [
  { code: "soil_heavy", label: "Heavy soil", kind: "percent", amount: 25 },
  { code: "pet_hair", label: "Pet hair", kind: "flat", amount: 40 },
  { code: "old", label: "Retired", kind: "flat", amount: 99, active: false },
];

describe("quoteTotal (mirrors public.quote_total)", () => {
  it("prices by size with modifiers and tax on parts only", () => {
    const q = quoteTotal({ size: "suv_truck", lines: [{ service_id: "full", modifiers: ["soil_heavy", "pet_hair", "old"] }, { service_id: "oil" }] }, { services, modifiers, taxRate: 0.0875, taxAllLines: false });
    expect(q.lines[0].unit_price).toBe(240);
    expect(q.lines[0].modifiers.map((m) => m.amount)).toEqual([60, 40]);
    expect(q.lines[0].line_total).toBe(340);
    expect(q.lines[1].line_total).toBe(75);
    expect(q.lines[1].taxable).toBe(true);
    expect(q.subtotal).toBe(415);
    expect(q.tax).toBe(6.56);
    expect(q.total).toBe(421.56);
    expect(q.duration_minutes).toBe(285);
    expect(q.placeholder).toBe(true);
  });
  it("taxes everything when the shop says so, and falls back to the default price", () => {
    const q = quoteTotal({ size: "xl", lines: [{ service_id: "tire", qty: 2 }] }, { services, modifiers, taxRate: 0.1, taxAllLines: true });
    expect(q.lines[0].unit_price).toBe(15);
    expect(q.subtotal).toBe(30);
    expect(q.tax).toBe(3);
    expect(q.total).toBe(33);
  });
  it("takes the typed amount for an open-amount line and ignores one elsewhere", () => {
    const q = quoteTotal({ size: "sedan", lines: [{ service_id: "other", price: 45, label: "Headlight resto" }, { service_id: "full", price: 1 }] }, { services, modifiers, taxRate: 0, taxAllLines: false });
    expect(q.lines[0].name).toBe("Headlight resto");
    expect(q.lines[0].line_total).toBe(45);
    expect(q.lines[1].line_total).toBe(200);
    expect(q.total).toBe(245);
  });
  it("computes the deposit", () => {
    expect(depositFor(421.56, { deposit_kind: "percent", deposit_value: 20 })).toBe(84.31);
    expect(depositFor(30, { deposit_kind: "flat", deposit_value: 50 })).toBe(30);
    expect(depositFor(100, { deposit_kind: "none", deposit_value: 20 })).toBe(0);
  });
});

describe("templates", () => {
  it("renders placeholders and blanks unknown ones", () => {
    expect(renderTemplate("Hi {{first_name}}, {{ vehicle }} at {{starts_at}} {{nope}}", { first_name: "Ana", vehicle: "Camry", starts_at: "9am" })).toBe("Hi Ana, Camry at 9am ");
  });
  it("falls back to the default per field", () => {
    const t = templateFor("reminder", { reminder: { subject: "  ", body: "Custom {{first_name}}" } });
    expect(t.subject).toBe("Reminder: {{starts_at}}");
    expect(t.body).toBe("Custom {{first_name}}");
  });
});

describe("line types and shop supplies (mirror public._estimate_price_line / _estimate_option_totals)", async () => {
  const { emptyLine, optionTotals, priceLine } = await import("./quote");
  const catalog = { services, modifiers, taxRate: 0.1, taxAllLines: false, defaultRate: 120, policy: { shop_supplies_pct: 5, shop_supplies_cap: 10, shop_supplies_taxable: false, parts_taxable_default: true, labor_taxable_default: false } };
  it("prices labor by hours × rate, parts by qty × price, fees and sublets untaxed", () => {
    const labor = priceLine(emptyLine("labor", { label: "Replace front pads", hours: 2.5 }), "sedan", catalog);
    expect(labor).toMatchObject({ line_total: 300, qty: 2.5, unit_price: 120, taxable: false, duration_minutes: 150 });
    const part = priceLine(emptyLine("part", { label: "Brake pads", qty: 2, price: 40, part_number: "BP-123" }), "sedan", catalog);
    expect(part).toMatchObject({ line_total: 80, taxable: true });
    const fee = priceLine(emptyLine("fee", { label: "Disposal fee", price: 25 }), "sedan", catalog);
    const sublet = priceLine(emptyLine("sublet", { label: "Rotors", price: 150, vendor: "Machine shop" }), "sedan", catalog);
    expect(fee.taxable).toBe(false);
    expect(sublet.line_total).toBe(150);
    const svc = priceLine(emptyLine("service", { service_id: "full" }), "sedan", catalog);
    expect(svc).toMatchObject({ line_type: "service", line_total: 200 });
    const t = optionTotals([svc, labor, part, fee, sublet], 0.1, catalog.policy);
    // 755 of lines, supplies capped at 10, tax on the parts only
    expect(t).toMatchObject({ subtotal: 755, labor_subtotal: 300, shop_supplies: 10, tax: 8, total: 773, duration_minutes: 390 });
  });
  it("drops the supplies with the labor and taxes them when told to", () => {
    const part = priceLine(emptyLine("part", { label: "Pads", price: 80 }), "sedan", catalog);
    expect(optionTotals([part], 0.1, catalog.policy)).toMatchObject({ shop_supplies: 0, tax: 8, total: 88 });
    const labor = priceLine(emptyLine("labor", { label: "Work", hours: 1 }), "sedan", catalog);
    expect(optionTotals([labor], 0.1, { shop_supplies_pct: 5, shop_supplies_cap: null, shop_supplies_taxable: true })).toMatchObject({ shop_supplies: 6, tax: 0.6, total: 126.6 });
  });
  it("refuses labor without hours and lines without a name", () => {
    expect(() => priceLine(emptyLine("labor", { label: "x" }), "sedan", catalog)).toThrow(/hours/);
    expect(() => priceLine(emptyLine("part", { price: 5 }), "sedan", catalog)).toThrow(/name/);
  });
});

describe("parts cost and list price (0067)", () => {
  it("suggests the list price from the cost and the shop's markup", async () => {
    const { listPriceFromCost } = await import("./quote");
    expect(listPriceFromCost(40, 50)).toBe(60);
    expect(listPriceFromCost(22, 40)).toBe(30.8);
    expect(listPriceFromCost(19.99, 33)).toBe(26.59);
    expect(listPriceFromCost(40, null)).toBeNull();
    expect(listPriceFromCost(Number.NaN, 40)).toBeNull();
    expect(listPriceFromCost(0, 40)).toBe(0);
  });
  it("works out the margin of a line: profit and share of the list price", async () => {
    const { marginOf } = await import("./quote");
    expect(marginOf(60, 40)).toEqual({ profit: 20, pct: 33.3 });
    expect(marginOf(60, 40, 2)).toEqual({ profit: 40, pct: 33.3 });
    expect(marginOf(30, 40)).toEqual({ profit: -10, pct: -33.3 });
    expect(marginOf(60, null)).toBeNull();
    expect(marginOf(null, 40)).toBeNull();
    expect(marginOf(0, 10)).toBeNull();
  });
});
