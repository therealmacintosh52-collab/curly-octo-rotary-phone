/** Trouble-code helpers: pure, shared by the screens, the lookup box and the server. */

export const DTC_RE = /^[PBCU][0-9A-F]{4}$/;

export function normalizeDtc(code: string) {
  return code.toUpperCase().replace(/[^PBCU0-9A-F]/g, "");
}

/** "p0300, P0171;p0174 junk" → ["P0300", "P0171", "P0174"], deduplicated, in order. */
export function parseDtcList(input: string): string[] {
  const seen = new Set<string>();
  for (const raw of input.split(/[\s,;]+/)) {
    const c = normalizeDtc(raw);
    if (DTC_RE.test(c)) seen.add(c);
  }
  return [...seen];
}

/** A system bucket for codes outside the seeded table (manufacturer-specific ranges). */
export function inferDtcSystem(code: string): { system: string; category: string; description: string } {
  const c = code.toUpperCase();
  const letter = c[0];
  if (letter === "B") return { system: "body", category: "body", description: "Body code (manufacturer-specific definition not in the database)" };
  if (letter === "C") return { system: "chassis", category: "chassis", description: "Chassis code (manufacturer-specific definition not in the database)" };
  if (letter === "U") return { system: "network", category: "network", description: "Network code (manufacturer-specific definition not in the database)" };
  const n = Number.parseInt(c.slice(2), 10);
  const mfr = c[1] === "1" || c[1] === "3";
  let system = "computer";
  if (n >= 100 && n < 300) system = "fuel_air";
  else if (n >= 300 && n < 400) system = "ignition_misfire";
  else if (n >= 400 && n < 500) system = "emissions";
  else if (n >= 500 && n < 600) system = "speed_idle";
  else if (n >= 600 && n < 700) system = "computer";
  else if (n >= 700 && n < 1000) system = "transmission";
  else if (n < 100) system = "vvt";
  if (c.startsWith("P0A") || c.startsWith("P0B") || c.startsWith("P0C")) system = "hybrid_ev";
  return {
    system,
    category: "powertrain",
    description: mfr ? "Manufacturer-specific powertrain code (definition not in the database)" : "Powertrain code (definition not in the database)",
  };
}

/** A seeded definition row (public.dtc_codes). */
export interface DtcDefinition {
  code: string;
  description: string;
  system: string;
  category: string;
  is_generic: boolean;
  common_causes: string[];
  safety_flag: "brakes" | "srs" | "steering" | "ev_high_voltage" | null;
}

/**
 * The Intel path for what someone typed into the lookup box: trouble codes →
 * the Codes screen, a 17-character VIN → the garage lookup, anything else →
 * the garage.
 */
export function intelPathFor(raw: string): string {
  const q = raw.trim().toUpperCase();
  if (!q) return "/intel/garage";
  const codes = parseDtcList(q);
  if (codes.length) return `/intel/dtc?codes=${encodeURIComponent(codes.join(","))}`;
  const vin = q.replace(/[^A-Z0-9]/g, "");
  if (vin.length === 17 && !/[IOQ]/.test(vin)) return `/intel/garage?vin=${vin}`;
  return "/intel/garage";
}
