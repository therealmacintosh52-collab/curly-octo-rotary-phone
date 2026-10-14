import { describe, expect, it } from "vitest";
import { PLATE_ADAPTERS, isPlateShape, normalizePlate, plateProvider } from "./plate-provider";

describe("plate provider", () => {
  it("is off by default", () => {
    expect(plateProvider({})).toEqual({ kind: "off" });
    expect(plateProvider({ PLATE_PROVIDER: "none" })).toEqual({ kind: "off" });
    expect(plateProvider({ PLATE_PROVIDER: " NONE " })).toEqual({ kind: "off" });
  });
  it("says so when a vendor is named but there is no adapter or no key", () => {
    expect(plateProvider({ PLATE_PROVIDER: "acme", PLATE_PROVIDER_KEY: "k" })).toMatchObject({ kind: "unavailable" });
    PLATE_ADAPTERS.acme = () => ({ name: "acme", lookup: async () => ({ vin: "1HGCM82633A004352" }) });
    expect(plateProvider({ PLATE_PROVIDER: "acme" })).toEqual({ kind: "unavailable", reason: "PLATE_PROVIDER_KEY is not set" });
    const on = plateProvider({ PLATE_PROVIDER: "acme", PLATE_PROVIDER_KEY: "k" });
    expect(on.kind).toBe("on");
    delete PLATE_ADAPTERS.acme;
  });
  it("normalises plates", () => {
    expect(normalizePlate("8abc 123")).toBe("8ABC123");
    expect(normalizePlate(" 7-FLT 009 ")).toBe("7FLT009");
    expect(isPlateShape("8ABC123")).toBe(true);
    expect(isPlateShape("A")).toBe(false);
    expect(isPlateShape("ABCDEFGHI")).toBe(false);
  });
});
