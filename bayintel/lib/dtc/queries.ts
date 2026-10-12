import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { RankedFix } from "@/lib/fixes/queries";

export type DtcRow = Database["public"]["Tables"]["dtc_codes"]["Row"];

export async function getDtcDefinitions(codes: string[]): Promise<Map<string, DtcRow>> {
  if (!codes.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("dtc_codes").select("*").in("code", codes);
  return new Map((data ?? []).map((d) => [d.code, d]));
}

/** Infers a system bucket for codes that are not in the seed table (manufacturer-specific). */
export function inferDtcSystem(code: string): { system: string; category: string; description: string } {
  const c = code.toUpperCase();
  const letter = c[0];
  if (letter === "B") return { system: "body", category: "body", description: "Body code (manufacturer-specific definition not in database)" };
  if (letter === "C") return { system: "chassis", category: "chassis", description: "Chassis code (manufacturer-specific definition not in database)" };
  if (letter === "U") return { system: "network", category: "network", description: "Network code (manufacturer-specific definition not in database)" };
  const n = Number.parseInt(c.slice(2), 10);
  const mfr = c[1] === "1" || c[1] === "3";
  let system = "computer";
  if (n >= 100 && n < 200) system = "fuel_air";
  else if (n >= 200 && n < 300) system = "fuel_air";
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
    description: mfr ? "Manufacturer-specific powertrain code (definition not in database)" : "Powertrain code (definition not in database)",
  };
}

/** Fixes tagged with any of the codes, across all vehicles, ranked by net confirmations. */
export async function fixesForCodes(codes: string[], limit = 20): Promise<RankedFix[]> {
  if (!codes.length) return [];
  const supabase = await createClient();
  const { data: tags } = await supabase.from("fix_dtcs").select("fix_id, code").in("code", codes);
  const ids = [...new Set((tags ?? []).map((t) => t.fix_id))];
  if (!ids.length) return [];
  const { data: fixes } = await supabase
    .from("fixes")
    .select("*, fix_dtcs(code), profiles:author_id(display_name, reputation)")
    .in("id", ids)
    .eq("status", "approved")
    .order("net_score", { ascending: false })
    .order("confirm_count", { ascending: false })
    .limit(limit);
  return (fixes ?? []).map((f) => ({
    fix: f as unknown as RankedFix["fix"],
    rankScore: f.net_score,
    matchLevel: "near_year" as const,
    matchedCodes: f.fix_dtcs.map((d) => d.code).filter((c) => codes.includes(c)),
  }));
}
