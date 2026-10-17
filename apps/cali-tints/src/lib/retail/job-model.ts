import type { EstimateOptionView } from "@/lib/db/types";
import { estimateConditionNote } from "./part-condition";
import type { JobLine, JobModel } from "./job-financials";
import type { EstimateLineDraft, PricedLine } from "./quote";

const lineCostOf = (type: string, cost: number | null | undefined, qty: number) => (cost === null || cost === undefined ? null : Number(cost) * (type === "labor" ? 1 : qty));

/** An option of a saved estimate → the jobs the work order shows (Diagnosis first, then by priority as the server ordered them). */
export function jobsFromView(o: EstimateOptionView, opts: { accepted: boolean; showMoney: boolean }): JobModel[] {
  const declined = (l: EstimateOptionView["lines"][number]) => opts.accepted && o.tier === "single" && l.customer_approved === false;
  const toLine = (l: EstimateOptionView["lines"][number]): JobLine => {
    const type = l.line_type ?? "service";
    return {
      key: l.id,
      type,
      name: l.name,
      qty: l.qty,
      unit: l.unit_price,
      total: l.line_total,
      hours: l.hours ?? null,
      rate: l.rate ?? null,
      tech: l.tech ?? null,
      techId: l.tech_id ?? null,
      partNumber: l.part_number ?? null,
      note: [type === "part" ? estimateConditionNote(l.part_condition) : null, type === "part" ? l.vendor : null, l.modifiers.length ? l.modifiers.map((m) => m.label).join(", ") : null].filter(Boolean).join(" · ") || null,
      vendor: l.vendor ?? null,
      cost: opts.showMoney ? lineCostOf(type, l.cost, l.qty) : null,
      declined: declined(l),
      inventoryItemId: l.inventory_item_id ?? null,
    };
  };
  const jobs = o.jobs ?? [];
  if (jobs.length === 0) return o.lines.length ? [{ key: "_all", title: o.tier === "single" ? "Estimate" : o.name, priority: "soon", kind: "repair", status: "recommended", lines: o.lines.map(toLine) }] : [];
  const out: JobModel[] = jobs.map((j) => ({ key: j.id, title: j.title, priority: j.priority, kind: j.kind, status: j.status, lines: o.lines.filter((l) => l.estimate_job_id === j.id).map(toLine) }));
  const rest = o.lines.filter((l) => !jobs.some((j) => j.id === l.estimate_job_id));
  if (rest.length) out.push({ key: "_other", title: "Other items", priority: "soon", kind: "repair", status: "recommended", lines: rest.map(toLine) });
  return out;
}

/** The builder's draft option → the same job models, with the live prices (`priced[i]` belongs to `lines[i]`). Diagnosis is always the first job. */
export function jobsFromDraft(opt: { jobs: { key: string; title: string; priority: "safety" | "soon" | "optional" }[]; lines: EstimateLineDraft[] }, priced: (PricedLine | undefined)[] | undefined, keyOf: (l: EstimateLineDraft) => string, serviceName: (id: string | null) => string | undefined, opts: { showMoney: boolean; defaultRate: number | null }): JobModel[] {
  const toLine = (l: EstimateLineDraft, i: number): JobLine => {
    const p = priced?.[i];
    const name = l.line_type === "service" ? (l.label ?? serviceName(l.service_id) ?? "Service") : (l.label ?? "");
    return {
      key: keyOf(l),
      type: l.line_type,
      name,
      qty: l.line_type === "labor" ? 1 : l.qty,
      unit: p ? p.unit_price : null,
      total: p ? p.line_total : null,
      hours: l.hours ?? null,
      rate: l.line_type === "labor" ? (l.rate ?? opts.defaultRate) : null,
      techId: l.tech_id ?? null,
      partNumber: l.part_number ?? null,
      note: [l.line_type === "part" ? estimateConditionNote(l.part_condition) : null, l.vendor, l.finding_id ? "from a finding" : null].filter(Boolean).join(" · ") || null,
      vendor: l.vendor ?? null,
      cost: opts.showMoney ? lineCostOf(l.line_type, l.cost, l.qty) : null,
      inventoryItemId: l.inventory_item_id ?? null,
    };
  };
  const rows = opt.lines.map((l, i) => ({ l, i }));
  const mk = (key: string, title: string, kind: "diagnosis" | "repair", priority: "safety" | "soon" | "optional", sel: typeof rows): JobModel => ({ key, title, kind, priority, status: "recommended", lines: sel.map(({ l, i }) => toLine(l, i)) });
  const diag = rows.filter((r) => (r.l.section ?? "repair") === "diagnosis");
  const repair = rows.filter((r) => (r.l.section ?? "repair") !== "diagnosis");
  const out: JobModel[] = [mk("_diagnosis", "Diagnosis", "diagnosis", "soon", diag)];
  for (const j of opt.jobs) out.push(mk(j.key, j.title, "repair", j.priority, repair.filter((r) => r.l.job === j.key)));
  const loose = repair.filter((r) => !r.l.job || !opt.jobs.some((j) => j.key === r.l.job));
  if (loose.length) out.push(mk("_repairs", "Repairs", "repair", "soon", loose));
  return out;
}
