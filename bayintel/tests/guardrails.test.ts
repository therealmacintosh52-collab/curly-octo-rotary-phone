import { describe, expect, it } from "vitest";
import { detectSafetyFlags, scrubDiagnosis, scrubSpecValues } from "@/lib/ai/guardrails";
import { NOT_IN_DATABASE } from "@/lib/config";

describe("guardrails", () => {
  it("redacts torque specs", () => {
    const r = scrubSpecValues("Torque the bolts to 18 ft-lbs and the drain plug to 25 N·m.");
    expect(r.text).not.toMatch(/18 ft-lbs|25 N·m/);
    expect(r.text).toContain(NOT_IN_DATABASE);
    expect(r.redactions).toHaveLength(2);
  });
  it("redacts capacities, pinouts, connector ids and gaps", () => {
    const r = scrubSpecValues("Refill with 6.5 quarts of oil. Check pin 4 of connector C1035 for 5V reference. Plug gap should be 0.044 in.");
    expect(r.text).not.toMatch(/6\.5 quarts|pin 4|C1035|0\.044/);
    expect(r.redactions.length).toBeGreaterThanOrEqual(4);
  });
  it("leaves ordinary diagnostic language alone", () => {
    const r = scrubSpecValues("Monitor long-term fuel trims at idle and 2500 RPM; smoke test the intake; swap coil 4 with coil 2 and see if the misfire moves. Cylinder 7 misfire counts rose after 20 miles.");
    expect(r.redactions).toEqual([]);
    expect(r.text).toContain("coil 4");
  });
  it("scrubs nested diagnosis fields but not citations", () => {
    const d = { summary: "Torque to 30 lb-ft", test_plan: [{ test: "ok", citations: ["fix:C1035"] }] };
    const { value, redactions } = scrubDiagnosis(d);
    expect(value.summary).toContain(NOT_IN_DATABASE);
    expect(value.test_plan[0].citations).toEqual(["fix:C1035"]);
    expect(redactions).toHaveLength(1);
  });
  it("detects safety systems", () => {
    const flags = detectSafetyFlags(["ABS light on, brake pedal soft", "P0A80"]);
    expect(flags.map((f) => f.system)).toEqual(expect.arrayContaining(["Brakes", "EV high voltage"]));
    expect(detectSafetyFlags(["rough idle"])).toEqual([]);
  });
});
