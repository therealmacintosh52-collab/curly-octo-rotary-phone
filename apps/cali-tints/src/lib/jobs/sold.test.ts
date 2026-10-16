import { describe, expect, it } from "vitest";
import { soldNeedsCharge } from "./sold";

describe("a sold car must be charged as PDI or Used", () => {
  it("needs a charge when Sold stands alone", () => {
    expect(soldNeedsCharge(["Sold"])).toBe(true);
    expect(soldNeedsCharge(["Sold", "Touch Up Detail"])).toBe(true);
    expect(soldNeedsCharge(["sold "])).toBe(true);
  });
  it("is satisfied by PDI or Used", () => {
    expect(soldNeedsCharge(["Sold", "PDI"])).toBe(false);
    expect(soldNeedsCharge(["Used", "Sold"])).toBe(false);
    expect(soldNeedsCharge(["pdi", "SOLD"])).toBe(false);
  });
  it("does not apply without Sold", () => {
    expect(soldNeedsCharge([])).toBe(false);
    expect(soldNeedsCharge(["PDI"])).toBe(false);
    expect(soldNeedsCharge(["Service Loaner Detail"])).toBe(false);
  });
});
