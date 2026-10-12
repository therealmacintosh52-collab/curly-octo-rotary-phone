import { describe, expect, it } from "vitest";
import { computeTotals } from "@/lib/estimates/calc";

describe("estimate totals", () => {
  it("computes parts, labor, fees and tax on parts only", () => {
    const t = computeTotals(
      [
        { kind: "part", description: "Coil", quantity: 2, unit_price: 58 },
        { kind: "labor", description: "R&R coils", quantity: 1, unit_price: 120, hours: 0.8 },
        { kind: "fee", description: "Shop supplies", quantity: 1, unit_price: 10 },
      ],
      { taxRate: 0.0825, taxParts: true, taxLabor: false },
    );
    expect(t.parts).toBe(116);
    expect(t.labor).toBe(96);
    expect(t.fees).toBe(10);
    expect(t.subtotal).toBe(222);
    expect(t.tax).toBe(9.57);
    expect(t.total).toBe(231.57);
  });
  it("respects per-line taxable overrides", () => {
    const t = computeTotals([{ kind: "labor", description: "Diag", quantity: 1, unit_price: 150, hours: 1, taxable: true }], { taxRate: 0.1, taxParts: true, taxLabor: false });
    expect(t.tax).toBe(15);
  });
});
