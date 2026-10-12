import { describe, expect, it } from "vitest";
import { isValidVinFormat, vinCheckDigitOk, vinModelYear } from "@/lib/vin";
import { normalizeVin, parseDtcList } from "@/lib/utils";

describe("vin", () => {
  it("validates format", () => {
    expect(isValidVinFormat("1HGCM82633A004352")).toBe(true);
    expect(isValidVinFormat("1HGCM82633A00435O")).toBe(false); // O not allowed
    expect(isValidVinFormat("1HGCM82633A00435")).toBe(false);
  });
  it("checks the check digit", () => {
    expect(vinCheckDigitOk("1HGCM82633A004352")).toBe(true);
    expect(vinCheckDigitOk("1HGCM82633A004353")).toBe(false);
    expect(vinCheckDigitOk("11111111111111111")).toBe(true);
  });
  it("derives the model year", () => {
    expect(vinModelYear("1HGCM82633A004352")).toBe(2003);
    expect(vinModelYear("1FTEW1EF5FFA12345")).toBe(2015);
  });
  it("normalizes input", () => {
    expect(normalizeVin(" 1hgcm826-33a004352 ")).toBe("1HGCM82633A004352");
  });
  it("parses DTC lists", () => {
    expect(parseDtcList("p0300, P0171;p0174 junk U0100 P030")).toEqual(["P0300", "P0171", "P0174", "U0100"]);
  });
});
