import type { FixDetail, FixEstimateLines, FixSummary } from "@/lib/db/types";
import type { FixFormInitial } from "@/components/intel/fix-form";
import { emptyLine, type EstimateLineDraft } from "@/lib/retail/quote";

/** Trouble codes written anywhere in a piece of text ("rear misfire, P0301 and p0300"), upper-cased, in order, once each. */
export function fixCodesFromText(text: string): string[] {
  const seen = new Set<string>();
  for (const m of text.toUpperCase().matchAll(/\b[PBCU][0-9A-F]{4}\b/g)) seen.add(m[0]);
  return [...seen];
}

/** The estimate builder's lines from a fix: labor at the default rate, then the parts (the advisor edits freely). */
export function estimateLinesFromFix(fix: FixEstimateLines): EstimateLineDraft[] {
  return fix.lines.map((l) =>
    l.line_type === "labor"
      ? emptyLine("labor", { label: l.label, hours: l.hours ?? 1, finding_id: null })
      : emptyLine("part", { label: l.label, part_number: l.part_number ?? null, qty: l.qty ?? 1, price: l.price ?? null }),
  );
}

export const matchLabel = (level: "exact" | "same_year" | "near_year") => (level === "exact" ? null : level === "same_year" ? "same year, other engine" : "nearby year");

export const fixCarName = (f: Pick<FixSummary, "year" | "make" | "model" | "engine">) => `${f.year} ${f.make} ${f.model}${f.engine ? ` · ${f.engine}` : ""}`;

/** The edit form starts from the fix as it stands. */
export function fixToInitial(f: FixDetail): FixFormInitial {
  return {
    vehicle_id: f.vehicle_id, job_id: f.job_id, title: f.title, year: f.year, make: f.make, model: f.model, engine: f.engine, mileage: f.mileage, symptoms: f.symptoms, codes: f.codes,
    freeze_frame_notes: f.freeze_frame_notes, tests: f.tests, root_cause: f.root_cause, fix_description: f.fix_description, labor_hours: f.labor_hours,
    parts: f.parts.map((p) => ({ name: p.name, part_number: p.part_number, quantity: p.quantity, unit_price: p.unit_price })),
  };
}
