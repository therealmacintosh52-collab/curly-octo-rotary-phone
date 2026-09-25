import { describe, expect, it } from "vitest";
import { csvEscape, toCsv } from "./csv";

describe("csv", () => {
  it("escapes quotes, commas and newlines", () => {
    expect(csvEscape('He said "hi"')).toBe('"He said ""hi"""');
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape("line\nbreak")).toBe('"line\nbreak"');
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(12.5)).toBe("12.5");
  });

  it("neutralises formula injection", () => {
    expect(csvEscape("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(csvEscape("+1")).toBe("'+1");
  });

  it("writes header + rows with CRLF and BOM", () => {
    const out = toCsv([{ a: "x", b: 1 }], [
      { key: "a", header: "Col A" },
      { key: "b", header: "Col B" },
    ]);
    expect(out).toBe("﻿Col A,Col B\r\nx,1\r\n");
  });
});
