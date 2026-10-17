import { describe, expect, it } from "vitest";
import { groupInspectionItems, inspectionProgress, nextInspectionState } from "./inspection";

describe("inspection helpers", () => {
  it("cycles grey → green → red → n/a → grey", () => {
    expect(nextInspectionState("pending")).toBe("ok");
    expect(nextInspectionState("ok")).toBe("attention");
    expect(nextInspectionState("attention")).toBe("na");
    expect(nextInspectionState("na")).toBe("pending");
  });
  it("counts progress and red items", () => {
    expect(inspectionProgress([]).label).toBe("No items yet");
    const p = inspectionProgress([{ state: "ok" }, { state: "attention" }, { state: "pending" }, { state: "na" }]);
    expect(p).toMatchObject({ total: 4, checked: 3, attention: 1, done: false, label: "3/4 checked · 1 needs attention" });
    expect(inspectionProgress([{ state: "ok" }, { state: "na" }]).done).toBe(true);
    expect(inspectionProgress([{ state: "attention" }, { state: "attention" }]).label).toContain("2 need attention");
  });
  it("groups consecutive items by heading", () => {
    const g = groupInspectionItems([{ group: null, n: 1 }, { group: "Brakes", n: 2 }, { group: "Brakes", n: 3 }, { group: "Tires", n: 4 }]);
    expect(g.map((x) => [x.group, x.items.length])).toEqual([[null, 1], ["Brakes", 2], ["Tires", 1]]);
  });
});
