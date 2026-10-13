import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { DtcCode, RecentLookup, Vehicle } from "@/lib/db/types";
import { decodeIsUsable } from "./nhtsa-parse";
import { decodeVinFull } from "./nhtsa";
import type { DecodedVehicle, VehicleKey } from "./types";

export type IntelVehicle = Vehicle & { customer: { id: string; display_name: string | null } | null };

/** A vehicle on file (the company's, through RLS) with its customer. */
export async function getIntelVehicle(id: string): Promise<IntelVehicle | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("vehicles").select("*, customer:customers(id, display_name)").eq("id", id).maybeSingle();
  return (data as unknown as IntelVehicle | null) ?? null;
}

/** The shop's vehicles for pickers and the garage list (newest first, archived left out). */
export async function listIntelVehicles(q?: string, limit = 100) {
  const supabase = await createClient();
  let query = supabase.from("vehicles").select("id, vin, year, make, model, trim, engine, color, plate, customer:customers(id, display_name)").is("archived_at", null).order("updated_at", { ascending: false }).limit(limit);
  const term = q?.trim();
  if (term) {
    const like = `%${term.replace(/[%_]/g, "")}%`;
    query = query.or(`vin.ilike.${like},make.ilike.${like},model.ilike.${like},plate.ilike.${like}`);
  }
  const { data } = await query;
  return ((data ?? []) as unknown as GarageRow[]).map((r) => ({ ...r, customer: Array.isArray(r.customer) ? (r.customer[0] ?? null) : r.customer }));
}
export type GarageRow = { id: string; vin: string | null; year: number | null; make: string | null; model: string | null; trim: string | null; engine: string | null; color: string | null; plate: string | null; customer: { id: string; display_name: string | null } | null };

export function vehicleKeyOf(v: { year: number | null; make: string | null; model: string | null; engine?: string | null }): VehicleKey | null {
  return v.year && v.make && v.model ? { year: v.year, make: v.make, model: v.model, engine: v.engine ?? null } : null;
}

export const vehicleName = (v: { year: number | null; make: string | null; model: string | null }) => [v.year, v.make, v.model].filter(Boolean).join(" ") || "Vehicle";

/** Definitions for codes, by code; missing ones are absent (the screen infers a system). */
export async function getDtcDefinitions(codes: string[]): Promise<Map<string, DtcCode>> {
  if (!codes.length) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.rpc("dtc_definitions", { p_codes: codes });
  return new Map(((data ?? []) as DtcCode[]).map((d) => [d.code, d]));
}

export async function getRecentLookups(limit = 8): Promise<RecentLookup[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("recent_intel_lookups", { p_limit: limit });
  return (data ?? []) as RecentLookup[];
}

export async function logLookup(kind: "code" | "vin", query: string) {
  const supabase = await createClient();
  await supabase.rpc("log_intel_lookup", { p_kind: kind, p_query: query });
}

/**
 * The decoded attributes for a vehicle on file: from its row when already
 * kept, else decoded from its VIN now and kept for next time (best-effort;
 * the page renders without them when NHTSA is slow).
 */
export async function ensureSpecs(v: IntelVehicle): Promise<DecodedVehicle | null> {
  if (!v.vin) return null;
  if (v.specs && Object.keys(v.specs).length) return specsAsDecoded(v);
  try {
    const d = await decodeVinFull(v.vin);
    if (!decodeIsUsable(d)) return null;
    const supabase = await createClient();
    await supabase.rpc("set_vehicle_specs", { p_id: v.id, p_engine: d.engine, p_specs: d.specs, p_source: "NHTSA" });
    return d;
  } catch {
    return null;
  }
}

function specsAsDecoded(v: IntelVehicle): DecodedVehicle {
  const s = v.specs ?? {};
  return {
    source: "NHTSA", vin: v.vin ?? "", year: v.year, make: v.make ?? "", model: v.model ?? "", trim: v.trim, engine: v.engine ?? null,
    displacementL: s.DisplacementL ? Number(s.DisplacementL) : null, cylinders: s.EngineCylinders ? Number(s.EngineCylinders) : null,
    fuelType: s.FuelTypePrimary ?? null, driveType: s.DriveType ?? null, bodyClass: v.body_class, transmission: [s.TransmissionSpeeds, s.TransmissionStyle].filter(Boolean).join("-speed ") || null,
    plant: [s.PlantCity, s.PlantCountry].filter(Boolean).join(", ") || null, specs: s, errorCode: null, errorText: null,
  };
}
