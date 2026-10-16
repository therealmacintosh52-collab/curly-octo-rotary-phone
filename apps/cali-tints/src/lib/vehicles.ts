/** Static vehicle reference data for the no-VIN entry path. */

export const DEFAULT_MAKE = "Mercedes-Benz";

export const MAKES = [
  "Mercedes-Benz",
  "Mercedes-AMG",
  "Mercedes-Maybach",
  "Smart",
  "Sprinter",
  "BMW",
  "Audi",
  "Lexus",
  "Porsche",
  "Toyota",
  "Honda",
  "Ford",
  "Chevrolet",
  "Tesla",
  "Other",
] as const;

/** Common Mercedes-Benz models on a US dealer lot (sales + service loaners). */
export const MERCEDES_MODELS = [
  "A 220",
  "CLA 250",
  "CLA 35 AMG",
  "CLA 45 AMG",
  "C 300",
  "C 43 AMG",
  "C 63 AMG",
  "E 350",
  "E 450",
  "E 53 AMG",
  "E 63 AMG",
  "S 500",
  "S 580",
  "S 63 AMG",
  "Maybach S 580",
  "Maybach S 680",
  "CLE 300",
  "CLE 450",
  "CLS 450",
  "AMG GT",
  "AMG GT 43",
  "AMG GT 53",
  "AMG GT 63",
  "SL 55 AMG",
  "SL 63 AMG",
  "GLA 250",
  "GLB 250",
  "GLC 300",
  "GLC 300 Coupe",
  "GLC 43 AMG",
  "GLE 350",
  "GLE 450",
  "GLE 450e",
  "GLE 53 AMG",
  "GLE 63 AMG",
  "GLS 450",
  "GLS 580",
  "Maybach GLS 600",
  "G 550",
  "G 63 AMG",
  "EQB 250",
  "EQB 300",
  "EQE 350",
  "EQE 500",
  "EQE SUV",
  "EQS 450",
  "EQS 580",
  "EQS SUV",
  "Sprinter 2500",
  "Sprinter 3500",
  "Metris",
] as const;

/** The simple colors a detailer taps; anything else is typed under "Other". */
export const COLOR_PRESETS = [
  { name: "White", swatch: "#f5f5f4" },
  { name: "Black", swatch: "#111111" },
  { name: "Silver", swatch: "#c0c3c7" },
  { name: "Gray", swatch: "#7b7f85" },
  { name: "Red", swatch: "#c62828" },
  { name: "Blue", swatch: "#1e5bb8" },
  { name: "Green", swatch: "#2e7d32" },
  { name: "Brown", swatch: "#6d4c41" },
  { name: "Beige/Gold", swatch: "#c9b07a" },
  { name: "Orange/Yellow", swatch: "#f0a21c" },
] as const;
export const COLOR_OTHER = "Other";
export const COLOR_MAX = 40;

/** True when the saved color is one of the tap-to-pick names (case does not matter). */
export function isPresetColor(value: string): boolean {
  const v = value.trim().toLowerCase();
  return COLOR_PRESETS.some((c) => c.name.toLowerCase() === v);
}

/**
 * What to store: a tapped preset, or the typed color. The literal word "Other" is
 * never a color (the old dropdown saved it and the form refused it).
 */
export function colorValue(choice: string, typed = ""): string {
  const c = choice.trim();
  if (c && c.toLowerCase() !== COLOR_OTHER.toLowerCase()) return c.slice(0, COLOR_MAX);
  const t = typed.trim();
  return t.toLowerCase() === COLOR_OTHER.toLowerCase() ? "" : t.slice(0, COLOR_MAX);
}

export function yearOptions(span = 15): number[] {
  const now = new Date().getFullYear() + 1; // next model year is on lots by fall
  return Array.from({ length: span + 1 }, (_, i) => now - i);
}
