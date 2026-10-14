import { describe, expect, it } from "vitest";
import { estimateConditionNote, invoiceConditionNote, mixesConditions, partConditionLabel } from "./part-condition";

describe("part condition", () => {
  it("labels every condition and treats a missing one as new", () => {
    expect(partConditionLabel("rebuilt")).toBe("Rebuilt");
    expect(partConditionLabel("reconditioned")).toBe("Reconditioned");
    expect(partConditionLabel(null)).toBe("New");
  });
  it("calls out only a part that is not new on an estimate, but always on an invoice", () => {
    expect(estimateConditionNote("new")).toBeNull();
    expect(estimateConditionNote(undefined)).toBeNull();
    expect(estimateConditionNote("used")).toBe("Used");
    expect(invoiceConditionNote("new")).toBe("New");
    expect(invoiceConditionNote("used")).toBe("Used");
  });
  it("notices a job that mixes new parts with used, rebuilt or reconditioned ones", () => {
    expect(mixesConditions([{ type: "part", part_condition: "new" }, { type: "part", part_condition: "used" }])).toBe(true);
    expect(mixesConditions([{ type: "part", part_condition: "used" }, { type: "part", part_condition: "rebuilt" }])).toBe(false);
    expect(mixesConditions([{ type: "part" }, { type: "labor" }])).toBe(false);
  });
});
