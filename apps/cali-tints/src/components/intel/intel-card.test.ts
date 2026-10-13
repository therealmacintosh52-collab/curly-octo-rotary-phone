import { describe, expect, it } from "vitest";
import { intelPathFor } from "./intel-card";

describe("the BayIntel lookup box", () => {
  it("routes codes, VINs and anything else", () => {
    expect(intelPathFor("p0300")).toBe("/dtc?codes=P0300");
    expect(intelPathFor("P0300, u0100 c1234")).toBe("/dtc?codes=P0300%2CU0100%2CC1234");
    expect(intelPathFor("4t1bf1fk5cu123456")).toBe("/garage?vin=4T1BF1FK5CU123456");
    expect(intelPathFor("4T1BF1FK5CU12345O")).toBe("/garage"); // O is never in a VIN
    expect(intelPathFor("  ")).toBe("/garage");
    expect(intelPathFor("brakes")).toBe("/garage");
  });
});
