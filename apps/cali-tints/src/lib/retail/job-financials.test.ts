import { describe, expect, it } from "vitest";
import { bucketOf, gpLabel, jobFinancials, type JobLine } from "./job-financials";

const line = (patch: Partial<JobLine>): JobLine => ({ key: Math.random().toString(), type: "labor", name: "x", qty: 1, unit: null, total: 0, cost: null, ...patch });

describe("job financials", () => {
  it("puts services with labor and the rest in their own tables", () => {
    expect(bucketOf("service")).toBe("labor");
    expect(bucketOf("labor")).toBe("labor");
    expect(bucketOf("part")).toBe("parts");
    expect(bucketOf("fee")).toBe("fees");
    expect(bucketOf("sublet")).toBe("sublet");
  });
  it("adds each table up and the job, with profit when every priced line has a cost", () => {
    const f = jobFinancials([line({ total: 180, cost: 120 }), line({ type: "part", total: 95, cost: 52 }), line({ type: "part", total: 120, cost: 60 }), line({ type: "fee", total: 8, cost: 0 })]);
    expect(f.labor).toMatchObject({ total: 180, cost: 120, profit: 60, pct: 33 });
    expect(f.parts).toMatchObject({ total: 215, cost: 112, profit: 103, pct: 48 });
    expect(f.all).toMatchObject({ total: 403, profit: 171, pct: 42 });
    expect(gpLabel(f.parts)).toBe("48%");
  });
  it("shows no profit when a cost is missing (a half-known margin misleads)", () => {
    const f = jobFinancials([line({ total: 100, cost: 40 }), line({ type: "part", total: 50, cost: null })]);
    expect(f.labor.pct).toBe(60);
    expect(f.parts.pct).toBeNull();
    expect(f.all.pct).toBeNull();
    expect(gpLabel(f.all)).toBeNull();
  });
  it("ignores declined lines and an empty job", () => {
    const f = jobFinancials([line({ total: 100, cost: 40 }), line({ total: 999, cost: 1, declined: true })]);
    expect(f.all.total).toBe(100);
    expect(jobFinancials([]).all).toMatchObject({ total: 0, pct: null, lines: 0 });
  });
  it("keeps a free line out of the percentage maths", () => {
    expect(jobFinancials([line({ total: 0, cost: 0 })]).all.pct).toBeNull();
  });
});
