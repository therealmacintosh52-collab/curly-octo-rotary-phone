import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { FixDetail, FixSummary, RankedFix } from "@/lib/db/types";
import { signedUrls } from "@/lib/media/signed";
import { fixCodesFromText } from "./fixes";
import { parseDtcList } from "./dtc";
import type { FixFormInitial, FixFormVehicle } from "@/components/intel/fix-form";

/** The shop's fixes (`?q=`, `?codes=`, `?mine=1`). */
export async function listFixes(sp: { q?: string | string[]; codes?: string | string[]; mine?: string | string[] }): Promise<FixSummary[]> {
  const supabase = await createClient();
  const q = typeof sp.q === "string" ? sp.q : null;
  const codes = parseDtcList(typeof sp.codes === "string" ? sp.codes : "");
  const { data } = await supabase.rpc("fixes_filtered", { p_q: q, p_codes: codes.length ? codes : null, p_mine: sp.mine === "1", p_limit: 100 });
  return data ?? [];
}

/** One fix with its photos' signed URLs (an hour). */
export async function getFix(id: string): Promise<FixDetail | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.rpc("fix_detail", { p_id: id });
  if (!data) return null;
  if (data.media.length) {
    const urls = await signedUrls(supabase, "job-photos", data.media.map((m) => m.storage_path));
    data.media = data.media.map((m) => ({ ...m, url: urls.get(m.storage_path) ?? null }));
  }
  return data;
}

/** The shop's fixes for a car (and codes), best first. */
export async function fixesForCar(car: { year: number | null; make: string | null; model: string | null; engine?: string | null }, codes?: string[], limit = 25): Promise<RankedFix[]> {
  if (!car.year || !car.make || !car.model) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("rank_fixes", { p_make: car.make, p_model: car.model, p_year: car.year, p_engine: car.engine ?? null, p_codes: codes?.length ? codes : null, p_limit: limit });
  return data ?? [];
}

export async function fixesForCodes(codes: string[], limit = 30): Promise<FixSummary[]> {
  if (!codes.length) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("fixes_for_codes", { p_codes: codes, p_limit: limit });
  return data ?? [];
}

type VehicleRow = { id: string; year: number | null; make: string | null; model: string | null; engine: string | null; plate: string | null; customer: { display_name: string | null } | { display_name: string | null }[] | null };

/** The cars in the picker on the form. */
export async function fixFormVehicles(): Promise<FixFormVehicle[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("vehicles").select("id, year, make, model, engine, plate, customer:customers(display_name)").is("archived_at", null).not("year", "is", null).not("make", "is", null).not("model", "is", null).order("updated_at", { ascending: false }).limit(100);
  return ((data ?? []) as unknown as VehicleRow[]).map((v) => {
    const c = Array.isArray(v.customer) ? v.customer[0] : v.customer;
    return { id: v.id, year: v.year!, make: v.make!, model: v.model!, engine: v.engine, label: `${v.year} ${v.make} ${v.model}${v.plate ? ` · ${v.plate}` : ""}${c?.display_name ? ` · ${c.display_name}` : ""}` };
  });
}

/**
 * What the new-fix form starts with: `?vehicle=` fills the car, `?codes=` the
 * codes, `?job=&finding=` the car of that repair order and the finding's
 * words (its codes are picked out of the text).
 */
export async function newFixPrefill(sp: { vehicle?: string | string[]; codes?: string | string[]; job?: string | string[]; finding?: string | string[] }): Promise<FixFormInitial> {
  const supabase = await createClient();
  const uuid = (v: string | string[] | undefined) => (typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v) ? v : null);
  const init: FixFormInitial = { codes: parseDtcList(typeof sp.codes === "string" ? sp.codes : "") };
  const jobId = uuid(sp.job);
  let vehicleId = uuid(sp.vehicle);
  if (jobId) {
    const { data: job } = await supabase.from("jobs").select("id, vehicle_id").eq("id", jobId).maybeSingle();
    if (job) {
      init.job_id = job.id;
      vehicleId = vehicleId ?? job.vehicle_id ?? null;
    }
    const findingId = uuid(sp.finding);
    if (findingId) {
      const { data: findings } = await supabase.rpc("job_findings", { p_job: jobId });
      const f = (findings ?? []).find((x) => x.id === findingId);
      if (f) {
        init.title = f.title.length >= 8 ? f.title : undefined;
        init.symptoms = [f.title, f.body].filter(Boolean).join(". ");
        init.codes = [...new Set([...(init.codes ?? []), ...fixCodesFromText(`${f.title} ${f.body ?? ""}`)])];
      }
    }
  }
  if (vehicleId) {
    const { data: v } = await supabase.from("vehicles").select("id, year, make, model, engine").eq("id", vehicleId).maybeSingle();
    if (v) Object.assign(init, { vehicle_id: v.id, year: v.year ?? undefined, make: v.make ?? undefined, model: v.model ?? undefined, engine: v.engine ?? null });
  }
  return init;
}
