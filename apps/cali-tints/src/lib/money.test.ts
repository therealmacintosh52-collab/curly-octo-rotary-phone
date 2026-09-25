import { describe, expect, it } from "vitest";
import { formatMoney, formatTaxRate, invoiceTotals, roundCents, sumPrices } from "./money";

describe("money", () => {
  it("rounds to cents without float drift", () => {
    expect(roundCents(0.1 + 0.2)).toBe(0.3);
    expect(roundCents(1.005)).toBe(1.01);
    expect(sumPrices([{ price: "150.00" }, { price: 45 }, { price: 0.1 }, { price: 0.2 }])).toBe(195.3);
  });

  it("computes invoice totals", () => {
    expect(invoiceTotals([150, 45], 0)).toEqual({ subtotal: 195, tax: 0, total: 195 });
    expect(invoiceTotals([150, 45], 0.0825)).toEqual({ subtotal: 195, tax: 16.09, total: 211.09 });
  });

  it("formats", () => {
    expect(formatMoney(1234.5)).toBe("$1,234.50");
    expect(formatMoney("12")).toBe("$12.00");
    expect(formatMoney(null)).toBe("$0.00");
    expect(formatTaxRate(0.0825)).toBe("8.25%");
    expect(formatTaxRate(0)).toBe("0%");
  });
});
