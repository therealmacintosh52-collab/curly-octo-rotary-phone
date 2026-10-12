import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getProviders } from "@/lib/providers";
import { getNhtsaBundle } from "@/lib/vehicles/data";
import { rankFixes } from "@/lib/fixes/queries";
import { fixesForCodes, getDtcDefinitions, inferDtcSystem } from "@/lib/dtc/queries";
import { complaintsForComponents, searchComplaints } from "@/lib/vehicles/complaints";
import { DTC_SYSTEM_COMPONENTS, DTC_SYSTEM_TERMS } from "@/lib/dtc/systems";
import type { ContextDoc } from "./schema";

export interface RetrievalInput {
  vehicle: { year: number; make: string; model: string; engine?: string | null };
  symptoms: string;
  codes: string[];
}

/**
 * Retrieval layer for the assistant. Only our own database (community fixes,
 * seeded DTC definitions, the NHTSA cache and provider stubs) is consulted.
 */
export async function retrieveContext(input: RetrievalInput): Promise<ContextDoc[]> {
  const supabase = await createClient();
  const docs: ContextDoc[] = [];
  const { vehicle, codes } = input;
  const keywords = extractKeywords(input.symptoms);

  const [defs, ranked, byCode, searched, nhtsa, articles] = await Promise.all([
    getDtcDefinitions(codes),
    rankFixes({ ...vehicle, codes: codes.length ? codes : null, limit: 12 }),
    codes.length ? fixesForCodes(codes, 8) : Promise.resolve([]),
    keywords.length ? supabase.rpc("search_fixes", { p_query: keywords.join(" "), p_make: vehicle.make, p_model: vehicle.model, p_limit: 6 }) : Promise.resolve({ data: [] as { fix_id: string }[] }),
    getNhtsaBundle(vehicle),
    getProviders().repairInfo.search(vehicle, { query: input.symptoms, dtcs: codes }),
  ]);

  for (const code of codes) {
    const row = defs.get(code);
    const inferred = row ? null : inferDtcSystem(code);
    docs.push({
      id: `dtc:${code}`,
      kind: "dtc",
      source: row?.source ?? "OWNER",
      title: `${code} - ${row?.description ?? inferred?.description}`,
      url: `/dtc?codes=${code}`,
      body: { system: row?.system ?? inferred?.system, common_causes: row?.common_causes ?? [], safety_flag: row?.safety_flag ?? null, in_database: Boolean(row) },
    });
  }

  const fixIds = new Set<string>();
  const addFix = (f: (typeof ranked)[number]["fix"], match: string) => {
    if (fixIds.has(f.id)) return;
    fixIds.add(f.id);
    docs.push({
      id: `fix:${f.id}`,
      kind: "fix",
      source: f.source_label,
      title: f.title,
      url: `/fixes/${f.id}`,
      body: {
        vehicle: `${f.year} ${f.make} ${f.model}${f.engine ? " " + f.engine : ""}`,
        match,
        mileage: f.mileage,
        codes: f.fix_dtcs.map((d) => d.code),
        symptoms: f.symptoms,
        tests_performed: f.tests_performed,
        root_cause: f.root_cause,
        fix: f.fix_description,
        labor_hours_reported: f.labor_hours,
        confirmations: { fixed: f.confirm_count, not_fixed: f.deny_count, net: f.net_score, verified: Boolean(f.verified_at) },
      },
    });
  };
  for (const r of ranked) addFix(r.fix, r.matchLevel);
  for (const r of byCode) addFix(r.fix, "other_vehicle_same_code");
  const searchedIds = ((searched.data ?? []) as { fix_id: string }[]).map((s) => s.fix_id).filter((id) => !fixIds.has(id));
  if (searchedIds.length) {
    const { data: extra } = await supabase.from("fixes").select("*, fix_dtcs(code)").in("id", searchedIds).eq("status", "approved");
    for (const f of extra ?? []) addFix({ ...f, profiles: null } as (typeof ranked)[number]["fix"], "symptom_search");
  }

  for (const r of nhtsa.recalls.slice(0, 10)) {
    docs.push({ id: `recall:${r.campaignNumber}`, kind: "recall", source: "NHTSA", title: `Recall ${r.campaignNumber}: ${r.component}`, body: { summary: r.summary, consequence: r.consequence, remedy: r.remedy, date: r.reportDate } });
  }

  const systems = new Set<string>();
  for (const code of codes) systems.add(defs.get(code)?.system ?? inferDtcSystem(code).system);
  const complaintPool = new Map<string, (typeof nhtsa.complaints)[number]>();
  for (const s of systems) {
    for (const c of complaintsForComponents(nhtsa.complaints, DTC_SYSTEM_COMPONENTS[s] ?? [])) complaintPool.set(c.odiNumber, c);
    for (const c of searchComplaints(nhtsa.complaints, DTC_SYSTEM_TERMS[s] ?? [])) complaintPool.set(c.odiNumber, c);
  }
  for (const c of searchComplaints(nhtsa.complaints, keywords)) complaintPool.set(c.odiNumber, c);
  const complaints = [...complaintPool.values()].sort((a, b) => (b.dateComplaintFiled ?? "").localeCompare(a.dateComplaintFiled ?? "")).slice(0, 15);
  for (const c of complaints) {
    docs.push({
      id: `complaint:${c.odiNumber}`,
      kind: "complaint",
      source: "NHTSA",
      title: `Owner complaint ${c.odiNumber} (${c.components.join(", ")})`,
      body: { date: c.dateOfIncident ?? c.dateComplaintFiled, mileage: c.mileage, summary: c.summary.slice(0, 500), crash: c.crash, fire: c.fire },
    });
  }

  for (const a of articles) {
    docs.push({ id: `article:${a.id}`, kind: "article", source: a.source, title: a.title, body: { kind: a.kind, summary: a.summary, systems: a.systems, dtcs: a.dtcs } });
  }

  return docs;
}

const STOP = new Set(["the", "and", "with", "when", "then", "that", "this", "from", "have", "has", "will", "into", "only", "also", "after", "before", "while", "about", "there", "their", "been", "very", "just", "some", "what", "which", "does", "doesn", "didn", "won", "car", "truck", "vehicle", "engine", "light", "check", "code", "codes"]);

export function extractKeywords(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP.has(w) && !/^[pbcu]\d{4}$/.test(w));
  return [...new Set(words)].slice(0, 12);
}
