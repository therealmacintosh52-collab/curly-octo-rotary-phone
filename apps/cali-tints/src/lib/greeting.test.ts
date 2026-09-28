import { describe, expect, it } from "vitest";
import { dayPart, greetingFor } from "./greeting";

const LA = "America/Los_Angeles";
// September: Los Angeles is UTC-7.
const la = (h: number, m = 0) => new Date(Date.UTC(2026, 8, 28, h + 7, m));

describe("dayPart", () => {
  it("cycles morning → afternoon → evening on the company clock", () => {
    expect(dayPart(LA, la(0))).toBe("Good morning");
    expect(dayPart(LA, la(11, 59))).toBe("Good morning");
    expect(dayPart(LA, la(12))).toBe("Good afternoon");
    expect(dayPart(LA, la(16, 59))).toBe("Good afternoon");
    expect(dayPart(LA, la(17))).toBe("Good evening");
    expect(dayPart(LA, la(23, 59))).toBe("Good evening");
  });
  it("uses the company timezone, not the server's", () => {
    // 6 pm in LA is 1 am UTC the next day.
    expect(dayPart(LA, la(18))).toBe("Good evening");
    expect(dayPart("UTC", la(18))).toBe("Good morning");
  });
});

describe("greetingFor", () => {
  it("uses the first name", () => {
    expect(greetingFor("Mike Singh", LA, la(9))).toBe("Good morning, Mike.");
    expect(greetingFor("  Dee One ", LA, la(14))).toBe("Good afternoon, Dee.");
  });
  it("still greets without a name", () => {
    expect(greetingFor("", LA, la(19))).toBe("Good evening.");
  });
});
