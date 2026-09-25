import { describe, expect, it } from "vitest";
import { displayMake, extractVin, mapNhtsaRow, normalizeVin, vinCheckDigitValid, vinStatus } from "./vin";

// Real-world valid VINs (check digit verified).
const VALID = ["1HGCM82633A004352", "5YJ3E1EA2KF317000", "WDDGF4HB3CR227845"];

describe("vin", () => {
  it("validates check digits", () => {
    for (const v of VALID) expect(vinCheckDigitValid(v)).toBe(true);
    expect(vinCheckDigitValid("1HGCM82634A004352")).toBe(false); // digit changed
    expect(vinCheckDigitValid("1HGCM8263A004352")).toBe(false); // 16 chars
  });

  it("normalises scanner input", () => {
    expect(normalizeVin(" 1hgcm82633a004352 ")).toBe("1HGCM82633A004352");
    expect(normalizeVin("I1HGCM82633A004352")).toBe("1HGCM82633A004352"); // Code 39 import mark
  });

  it("reports status levels", () => {
    expect(vinStatus("")).toBe("empty");
    expect(vinStatus("ABC")).toBe("invalid");
    expect(vinStatus("1HGCM82633A004352")).toBe("valid");
    expect(vinStatus("1HGCM82634A004352")).toBe("warn");
    expect(vinStatus("1HGCM82633A00435O")).toBe("invalid"); // letter O not allowed
  });

  it("extracts a VIN from noisy barcode text", () => {
    expect(extractVin("VIN: 1HGCM82633A004352")).toBe("1HGCM82633A004352");
    expect(extractVin("I1HGCM82633A004352")).toBe("1HGCM82633A004352");
    expect(extractVin("1HGCM82633A004352ABC")).toBe("1HGCM82633A004352");
    expect(extractVin("hello world")).toBeNull();
  });

  it("maps NHTSA rows", () => {
    const r = mapNhtsaRow("WDDGF4HB3CR227845", {
      ModelYear: "2012",
      Make: "MERCEDES-BENZ",
      Model: "C-Class",
      Trim: "C300",
      BodyClass: "Sedan/Saloon",
      ErrorCode: "0",
      ErrorText: "0 - VIN decoded clean. Check Digit (9th position) is correct",
    });
    expect(r).toMatchObject({ year: 2012, make: "Mercedes-Benz", model: "C-Class", trim: "C300" });
    expect(mapNhtsaRow("X", undefined).year).toBeNull();
    expect(mapNhtsaRow("X", { ModelYear: "" }).year).toBeNull();
  });

  it("title-cases makes with brand exceptions", () => {
    expect(displayMake("MERCEDES-BENZ")).toBe("Mercedes-Benz");
    expect(displayMake("BMW")).toBe("BMW");
    expect(displayMake("LAND ROVER")).toBe("Land Rover");
    expect(displayMake("TOYOTA")).toBe("Toyota");
    expect(displayMake(null)).toBeNull();
  });
});
