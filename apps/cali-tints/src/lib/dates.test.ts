import { describe, expect, it } from "vitest";
import { dateInputToIso, formatDateOnly, parseDateOnly, presetRange } from "./dates";

describe("dates", () => {
  const wed = new Date(2026, 8, 23); // Wed Sep 23 2026

  it("computes preset ranges with Monday weeks", () => {
    expect(presetRange("this_week", wed)).toEqual({ start: "2026-09-21", end: "2026-09-23" });
    expect(presetRange("last_week", wed)).toEqual({ start: "2026-09-14", end: "2026-09-20" });
    expect(presetRange("last_2_weeks", wed)).toEqual({ start: "2026-09-07", end: "2026-09-20" });
    expect(presetRange("this_month", wed)).toEqual({ start: "2026-09-01", end: "2026-09-23" });
    expect(presetRange("last_month", wed)).toEqual({ start: "2026-08-01", end: "2026-08-31" });
  });

  it("parses date-only strings as local dates", () => {
    const d = parseDateOnly("2026-01-01");
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(0);
    expect(d.getDate()).toBe(1);
    expect(formatDateOnly("2026-01-01")).toBe("Jan 1, 2026");
  });
});

describe("dateInputToIso", () => {
  it("keeps the real clock time when the picked date is today", () => {
    const now = new Date(2026, 8, 26, 14, 37, 5);
    expect(dateInputToIso("2026-09-26", now)).toBe(now.toISOString());
  });
  it("stores any other day at local noon so the calendar day never shifts", () => {
    const now = new Date(2026, 8, 26, 14, 37, 5);
    const iso = dateInputToIso("2026-09-03", now);
    const d = new Date(iso);
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([2026, 8, 3, 12]);
  });
});
