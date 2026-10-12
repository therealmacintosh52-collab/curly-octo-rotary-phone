import { describe, expect, it } from "vitest";
import { addDays, canChange, dayKeyIn, durationLabel, groupSlotsByDay, holdSecondsLeft, minutesOfDayIn, mmss, timeIn, weekStart, whenIn } from "./slots";

const TZ = "America/Los_Angeles";

describe("slots helpers", () => {
  it("formats instants in the shop's timezone, not the phone's", () => {
    // 15:00 UTC in October is 8:00 AM Pacific (PDT)
    expect(timeIn("2026-10-19T15:00:00Z", TZ)).toBe("8:00 AM");
    expect(dayKeyIn("2026-10-19T06:30:00Z", TZ)).toBe("2026-10-18"); // still the evening before in LA
    expect(minutesOfDayIn("2026-10-19T15:30:00Z", TZ)).toBe(8 * 60 + 30);
    expect(whenIn("2026-10-19T15:00:00Z", TZ)).toBe("Mon, Oct 19 · 8:00 AM");
  });

  it("groups slots by the shop's day", () => {
    const g = groupSlotsByDay(
      [
        { starts_at: "2026-10-19T15:00:00Z", ends_at: "2026-10-19T19:00:00Z" },
        { starts_at: "2026-10-19T15:30:00Z", ends_at: "2026-10-19T19:30:00Z" },
        { starts_at: "2026-10-20T15:00:00Z", ends_at: "2026-10-20T19:00:00Z" },
      ],
      TZ,
    );
    expect(g.map((x) => [x.day, x.slots.length])).toEqual([["2026-10-19", 2], ["2026-10-20", 1]]);
  });

  it("walks days and weeks without timezone drift", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(weekStart("2026-10-21")).toBe("2026-10-19"); // Wednesday → Monday
    expect(weekStart("2026-10-18")).toBe("2026-10-12"); // Sunday → the Monday before
    expect(weekStart("2026-10-19")).toBe("2026-10-19");
  });

  it("counts the hold down and never below zero", () => {
    const now = Date.parse("2026-10-12T12:00:00Z");
    expect(holdSecondsLeft("2026-10-12T12:30:00Z", now)).toBe(1800);
    expect(holdSecondsLeft("2026-10-12T11:59:00Z", now)).toBe(0);
    expect(holdSecondsLeft(null, now)).toBe(0);
    expect(mmss(754)).toBe("12:34");
    expect(mmss(5)).toBe("0:05");
  });

  it("applies the notice window like the database", () => {
    const now = Date.parse("2026-10-12T12:00:00Z");
    expect(canChange("2026-10-14T12:00:00Z", 24, now)).toBe(true);
    expect(canChange("2026-10-13T11:00:00Z", 24, now)).toBe(false);
    expect(durationLabel(45)).toBe("45 min");
    expect(durationLabel(240)).toBe("4 h");
    expect(durationLabel(150)).toBe("2 h 30 min");
  });
});
