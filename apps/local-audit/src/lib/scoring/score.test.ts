import { describe, expect, it } from "vitest";
import { CHECK_CATEGORIES } from "@/lib/checks/registry";
import { SCORE_WEIGHTS } from "./config";
import { computeScores } from "./score";

describe("computeScores", () => {
  it("leaves unassessed categories and headline scores null", () => {
    const s = computeScores([], []);
    expect(Object.values(s.categories).every((v) => v === null)).toBe(true);
    expect(s.visibility).toBeNull();
    expect(s.conversion).toBeNull();
  });

  it("subtracts severity penalties per category and floors at 0", () => {
    const s = computeScores(
      [
        { category: "gbp", severity: "high" },
        { category: "gbp", severity: "medium" },
        { category: "conversion", severity: "critical" },
        { category: "conversion", severity: "critical" },
        { category: "conversion", severity: "high" },
      ],
      ["gbp", "conversion", "schema"],
    );
    expect(s.categories.gbp).toBe(70);
    expect(s.categories.conversion).toBe(0);
    expect(s.categories.schema).toBe(100);
    expect(s.categories.rankings).toBeNull();
  });

  it("weights headline scores over assessed categories only", () => {
    const s = computeScores([{ category: "gbp", severity: "high" }], ["gbp", "rankings"]);
    // gbp 80 (w14), rankings 100 (w12) → (80*14 + 100*12) / 26 = 89.2
    expect(s.visibility).toBe(89);
    // gbp is the only assessed category with a conversion weight (4): 80
    expect(s.conversion).toBe(80);
  });

  it("has a weight row for every category", () => {
    expect(Object.keys(SCORE_WEIGHTS).sort()).toEqual([...CHECK_CATEGORIES].sort());
  });
});
