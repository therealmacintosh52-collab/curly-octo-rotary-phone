import { describe, expect, it } from "vitest";
import type { CannedJob, CannedLine } from "@/lib/db/types";
import { cannedLinesFromDraft, cannedMatchesCar, cannedScope, cannedSummary, expandCanned } from "./canned";
import { emptyLine } from "./quote";

const job = (patch: Partial<CannedJob> = {}): CannedJob => ({ id: "1", name: "Front brakes", category: null, makes: [], year_from: null, year_to: null, priority: "safety", notes: null, active: true, inspection_template_id: null, inspection: null, lines: [], line_count: 0, ...patch });
const lines: CannedLine[] = [
  { line_type: "labor", name: "Replace pads", hours: 1.5 },
  { line_type: "part", name: "Pad set", qty: 1, cost: 50 },
  { line_type: "part", name: "Hardware kit", qty: 2, price: 12.5, part_number: "HK-1", part_condition: "used" },
  { line_type: "fee", name: "Disposal", price: 5 },
];

describe("canned jobs", () => {
  it("describes which cars a job is for", () => {
    expect(cannedScope(job())).toBe("on all cars");
    expect(cannedScope(job({ makes: ["Toyota", "Honda"] }))).toBe("on Toyota, Honda");
    expect(cannedScope(job({ makes: ["Toyota"], year_from: 2015, year_to: 2020 }))).toBe("on Toyota 2015–2020");
    expect(cannedScope(job({ year_from: 2010 }))).toBe("on 2010 and newer");
    expect(cannedScope(job({ year_to: 2005 }))).toBe("on 2005 and older");
  });
  it("matches the car by make and year, and everything when the car is unknown", () => {
    const j = job({ makes: ["Toyota"], year_from: 2015, year_to: 2020 });
    expect(cannedMatchesCar(j, { make: "toyota", year: 2018 })).toBe(true);
    expect(cannedMatchesCar(j, { make: "Ford", year: 2018 })).toBe(false);
    expect(cannedMatchesCar(j, { make: "Toyota", year: "2022" })).toBe(false);
    expect(cannedMatchesCar(j, null)).toBe(true);
    expect(cannedMatchesCar(j, { make: "Ford", year: 2018 }, { make: false, year: true })).toBe(true);
    expect(cannedMatchesCar(j, { make: "Toyota", year: 2022 }, { make: true, year: false })).toBe(true);
    expect(cannedMatchesCar(job(), { make: "Anything", year: 1999 })).toBe(true);
  });
  it("expands to builder lines: labor hours, parts priced from cost with the markup, fees as saved", () => {
    const x = expandCanned({ ...job(), lines }, { markupPct: 40 });
    expect(x.title).toBe("Front brakes");
    expect(x.priority).toBe("safety");
    expect(x.lines.map((l) => l.line_type)).toEqual(["labor", "part", "part", "fee"]);
    expect(x.lines[0]).toMatchObject({ label: "Replace pads", hours: 1.5, rate: null });
    expect(x.lines[1]).toMatchObject({ price: 70, cost: 50 });
    expect(x.lines[2]).toMatchObject({ price: 12.5, qty: 2, part_number: "HK-1", part_condition: "used" });
    expect(x.lines[3]).toMatchObject({ price: 5 });
    // no markup and no price: free text part still lands (price 0), never NaN
    expect(expandCanned({ ...job(), lines: [{ line_type: "part", name: "x", cost: 10 }] }, { markupPct: null }).lines[0].price).toBe(0);
    // a line with no name is skipped
    expect(expandCanned({ ...job(), lines: [{ line_type: "fee", name: " ", price: 1 }, { line_type: "service" }] }, { markupPct: null }).lines).toHaveLength(0);
  });
  it("adds a job up for its row", () => {
    const s = cannedSummary(lines, { defaultRate: 120, markupPct: 40, services: [], size: "sedan" });
    expect(s).toMatchObject({ hours: 1.5, labor: 180, parts: 95, other: 5, total: 280, partCount: 2, rate: 120 });
  });
  it("turns builder lines back into a saved job", () => {
    const saved = cannedLinesFromDraft([emptyLine("labor", { label: "Pads", hours: 2, rate: 130, cost: 40 }), emptyLine("part", { label: "Rotor", price: 80, cost: 45, part_number: "R1" }), emptyLine("service", { service_id: "svc" }), emptyLine("fee", { label: "", price: 2 })]);
    expect(saved).toEqual([
      { line_type: "labor", qty: 1, name: "Pads", hours: 2, rate: 130, cost: 40 },
      { line_type: "part", qty: 1, name: "Rotor", price: 80, cost: 45, part_number: "R1", part_condition: "new" },
      { line_type: "service", qty: 1, service_id: "svc" },
    ]);
  });
});
