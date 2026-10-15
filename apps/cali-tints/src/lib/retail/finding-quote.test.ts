import { describe, expect, it } from "vitest";
import { emptyRow, findingPricing, rowsPayload, rowsTotals, type FindingRow } from "./finding-quote";
import type { RetailCatalog } from "@/lib/db/types";

const catalog = {
  tax_rate: 0.0875,
  settings: { tax_all_lines: false, parts_taxable_default: true, labor_taxable_default: false, shop_supplies_pct: 0, shop_supplies_cap: null, shop_supplies_taxable: false },
  labor_rates: [{ id: "r1", company_id: "c", name: "Shop rate", rate: 120, is_default: true, active: true, sort_order: 0, created_at: "", updated_at: "" }],
} as unknown as Pick<RetailCatalog, "tax_rate" | "settings" | "labor_rates">;
const pricing = findingPricing(catalog);
const row = (p: Partial<FindingRow>): FindingRow => ({ type: "part", label: "", hours: "", rate: "", qty: "1", price: "", part_number: "", ...p });

describe("finding quote sheet", () => {
  it("takes the default labor rate", () => {
    expect(pricing.defaultRate).toBe(120);
    expect(emptyRow("labor", pricing)).toMatchObject({ hours: "1", rate: "120" });
  });
  it("prices labor, a part and a fee, with tax on the part only: subtotal + tax = total", () => {
    const t = rowsTotals([row({ type: "labor", label: "Replace pads", hours: "1.5", rate: "100" }), row({ type: "part", label: "Rotor", qty: "2", price: "40" }), row({ type: "fee", label: "Disposal", price: "12" })], pricing);
    expect(t).toMatchObject({ subtotal: 242, tax: 7, total: 249, lines: 3, error: null });
  });
  it("ignores empty rows and reports a half-filled one", () => {
    expect(rowsTotals([row({ type: "part" }), row({ type: "fee" })], pricing)).toMatchObject({ subtotal: 0, lines: 0, error: null });
    expect(rowsTotals([row({ type: "labor", label: "Pads", hours: "0", rate: "100" })], pricing).error).toBeTruthy();
  });
  it("adds shop supplies on labor when the shop charges them", () => {
    const p = findingPricing({ ...catalog, settings: { ...catalog.settings!, shop_supplies_pct: 5, shop_supplies_cap: 10 } } as typeof catalog);
    const t = rowsTotals([row({ type: "labor", label: "Pads", hours: "4", rate: "100" })], p);
    expect(t.shop_supplies).toBe(10);
    expect(t.total).toBe(410);
  });
  it("builds the payload the RPC takes", () => {
    expect(rowsPayload([row({ type: "labor", label: "Pads", hours: "1.5", rate: "100" }), row({ type: "part", label: "Pad set", qty: "1", price: "89.99", part_number: "BP-1" }), row({ type: "fee", label: "Disposal", price: "12" }), row({ type: "fee" })])).toEqual([
      { line_type: "labor", label: "Pads", hours: 1.5, rate: 100 },
      { line_type: "part", label: "Pad set", qty: 1, price: 89.99, part_number: "BP-1" },
      { line_type: "fee", label: "Disposal", price: 12 },
    ]);
  });
});

describe("a part's hidden cost on the finding sheet (0067)", () => {
  it("sends the cost with the part and the fee, never with labor", () => {
    const rows: FindingRow[] = [
      row({ type: "part", label: "Pads", qty: "2", price: "60", cost: "40" }),
      row({ type: "fee", label: "Disposal", price: "12", cost: "5" }),
      row({ type: "labor", label: "Install", hours: "1", rate: "100", cost: "99" }),
    ];
    const p = rowsPayload(rows);
    expect(p[0]).toMatchObject({ line_type: "part", price: 60, cost: 40 });
    expect(p[1]).toMatchObject({ line_type: "fee", price: 12, cost: 5 });
    expect("cost" in p[2]).toBe(false);
  });
  it("leaves the cost out when it is blank", () => {
    expect("cost" in rowsPayload([row({ label: "Belt", price: "45" })])[0]).toBe(false);
  });
});
