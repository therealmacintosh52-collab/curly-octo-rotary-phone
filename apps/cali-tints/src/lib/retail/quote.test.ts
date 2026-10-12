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
