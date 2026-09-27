import { describe, expect, it } from "vitest";
import { DEFAULT_ASSUMPTIONS, ctrAt } from "./defaults";
import { estimateKeywordLoss, estimateRevenueLoss, withOverrides } from "./model";

describe("ctrAt", () => {
  it("reads the curve and returns 0 off the curve or when not ranking", () => {
    expect(ctrAt(DEFAULT_ASSUMPTIONS.ctrByPosition, 1)).toBe(0.27);
    expect(ctrAt(DEFAULT_ASSUMPTIONS.ctrByPosition, 3.7)).toBe(0.11);
    expect(ctrAt(DEFAULT_ASSUMPTIONS.ctrByPosition, 25)).toBe(0);
    expect(ctrAt(DEFAULT_ASSUMPTIONS.ctrByPosition, null)).toBe(0);
  });
});

describe("estimateKeywordLoss", () => {
  it("applies the master-plan formula with fixed assumptions", () => {
    const a = withOverrides({ targetPosition: 3, leadConversionRate: { low: 0.02, mid: 0.04, high: 0.08 }, closeRate: { low: 0.25, mid: 0.25, high: 0.25 }, avgTicketUsd: { low: 100, mid: 100, high: 100 } });
    // volume 1000, current pos 10 (ctr .02) → target pos 3 (ctr .11): 90 lost clicks
    const r = estimateKeywordLoss({ keyword: "plumber sacramento", monthlySearchVolume: 1000, currentPosition: 10, cpcUsd: 15 }, a);
    expect(r.lostClicksPerMonth).toBe(90);
    expect(r.lostLeadsPerMonth).toEqual({ low: 1.8, mid: 3.6, high: 7.2 });
    expect(r.lostRevenuePerMonth).toEqual({ low: 45, mid: 90, high: 180 });
    expect(r.adEquivalentUsdPerMonth).toBe(1350);
  });

  it("counts a keyword that is not ranking as losing the whole target CTR", () => {
    const r = estimateKeywordLoss({ keyword: "x", monthlySearchVolume: 100, currentPosition: null });
    expect(r.lostClicksPerMonth).toBe(11);
  });

  it("contributes nothing when already at or above target", () => {
    const r = estimateKeywordLoss({ keyword: "x", monthlySearchVolume: 5000, currentPosition: 1, cpcUsd: 20 });
    expect(r.lostClicksPerMonth).toBe(0);
    expect(r.lostRevenuePerMonth).toEqual({ low: 0, mid: 0, high: 0 });
    expect(r.adEquivalentUsdPerMonth).toBe(0);
  });

  it("uses the map-pack curve for local pack keywords", () => {
    const r = estimateKeywordLoss({ keyword: "x", monthlySearchVolume: 1000, currentPosition: null, surface: "map_pack" });
    expect(r.lostClicksPerMonth).toBe(90); // pack position 3 ctr .09
  });
});

describe("estimateRevenueLoss", () => {
  it("sums ranges across keywords and reports null ad-equivalent when no CPC is known", () => {
    const e = estimateRevenueLoss([
      { keyword: "a", monthlySearchVolume: 1000, currentPosition: 10 },
      { keyword: "b", monthlySearchVolume: 500, currentPosition: null },
    ]);
    expect(e.keywords).toHaveLength(2);
    expect(e.totals.lostClicksPerMonth).toBe(145);
    expect(e.totals.lostRevenuePerMonth.low).toBeLessThan(e.totals.lostRevenuePerMonth.mid);
    expect(e.totals.lostRevenuePerMonth.mid).toBeLessThan(e.totals.lostRevenuePerMonth.high);
    expect(e.totals.adEquivalentUsdPerMonth).toBeNull();
    expect(e.assumptions.sources.length).toBeGreaterThan(0);
  });
});
