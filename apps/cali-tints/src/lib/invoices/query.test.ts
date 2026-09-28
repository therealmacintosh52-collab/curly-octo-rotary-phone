import { describe, expect, it } from "vitest";
import { parseInvoiceFilters, parseSearchDate, resolveInvoiceFilters } from "./query";

const today = "2026-09-28"; // a Monday

describe("invoice search by date", () => {
  it("reads a day in the common ways", () => {
    for (const q of ["9/27", "09/27", "9-27", "9/27/26", "9/27/2026", "2026-09-27", "sep 27", "Sep 27", "september 27", "Sep. 27th", "sep 27 2026", "Sep 27, 2026", "27 sep", "27th September 2026"]) {
      expect(parseSearchDate(q, today), q).toEqual({ from: "2026-09-27", to: "2026-09-27", label: "Sep 27, 2026" });
    }
  });

  it("puts a year-less day that is still ahead into last year", () => {
    expect(parseSearchDate("12/25", today)).toEqual({ from: "2025-12-25", to: "2025-12-25", label: "Dec 25, 2025" });
    expect(parseSearchDate("dec 25", today)?.from).toBe("2025-12-25");
    expect(parseSearchDate("9/28", today)?.from).toBe("2026-09-28"); // today itself counts as this year
  });

  it("reads a month", () => {
    expect(parseSearchDate("sep", today)).toEqual({ from: "2026-09-01", to: "2026-09-30", label: "September 2026" });
    expect(parseSearchDate("august", today)?.to).toBe("2026-08-31");
    expect(parseSearchDate("feb 2024", today)).toEqual({ from: "2024-02-01", to: "2024-02-29", label: "February 2024" });
    expect(parseSearchDate("9/2026", today)?.from).toBe("2026-09-01");
    expect(parseSearchDate("nov", today)?.from).toBe("2025-11-01"); // not here yet this year
  });

  it("reads relative words", () => {
    expect(parseSearchDate("today", today)?.from).toBe("2026-09-28");
    expect(parseSearchDate("Yesterday", today)?.from).toBe("2026-09-27");
    expect(parseSearchDate("this week", today)).toEqual({ from: "2026-09-28", to: "2026-09-28", label: "This week" });
    expect(parseSearchDate("last week", today)).toEqual({ from: "2026-09-21", to: "2026-09-27", label: "Last week" });
    expect(parseSearchDate("last month", today)?.to).toBe("2026-08-31");
  });

  it("leaves tags, VINs and invoice numbers alone", () => {
    for (const q of ["4821", "2024", "K-118", "INV-000012", "W1KZF8DB3NA123456", "GLE 450", "9/99", "13/1", "", "  "]) {
      expect(parseSearchDate(q, today), q).toBeNull();
    }
  });

  it("turns a date search into a range and narrows it by explicit dates", () => {
    const f = parseInvoiceFilters({ q: "sep" });
    expect(resolveInvoiceFilters(f, today)).toMatchObject({ q: undefined, from: "2026-09-01", to: "2026-09-30", searchDate: { label: "September 2026" } });
    expect(resolveInvoiceFilters(parseInvoiceFilters({ q: "sep", from: "2026-09-10", to: "2026-10-05" }), today)).toMatchObject({ from: "2026-09-10", to: "2026-09-30" });
    expect(resolveInvoiceFilters(parseInvoiceFilters({ q: "4821", from: "2026-09-10" }), today)).toMatchObject({ q: "4821", from: "2026-09-10", searchDate: null });
  });
});
