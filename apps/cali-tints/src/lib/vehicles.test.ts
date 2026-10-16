import { describe, expect, it } from "vitest";
import { COLOR_MAX, COLOR_PRESETS, colorValue, isPresetColor } from "./vehicles";

describe("vehicle colors", () => {
  it("offers the simple colors", () => {
    const names = COLOR_PRESETS.map((c) => c.name);
    expect(names).toEqual(expect.arrayContaining(["White", "Black", "Silver", "Gray", "Red", "Blue"]));
    expect(names).not.toContain("Other");
  });

  it("knows a preset regardless of case and spaces", () => {
    expect(isPresetColor("white")).toBe(true);
    expect(isPresetColor("  Black ")).toBe(true);
    expect(isPresetColor("Obsidian Black")).toBe(false);
    expect(isPresetColor("")).toBe(false);
  });

  it("stores the color itself, never the word Other", () => {
    expect(colorValue("White")).toBe("White");
    expect(colorValue("Other", "Midnight green")).toBe("Midnight green");
    expect(colorValue("Other", "")).toBe("");
    expect(colorValue("Other", "other")).toBe("");
    expect(colorValue("Midnight green")).toBe("Midnight green");
    expect(colorValue("", "")).toBe("");
  });

  it("caps a typed color", () => {
    expect(colorValue("x".repeat(100)).length).toBe(COLOR_MAX);
  });
});
