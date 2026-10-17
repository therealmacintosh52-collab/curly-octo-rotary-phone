import type { CannedJob, CannedLine, EstimateJobPriority, PastService, VehicleSize } from "@/lib/db/types";
import { emptyLine, listPriceFromCost, retailPrice, type EstimateLineDraft, type QuoteService } from "./quote";

/** The car an estimate is for, as far as it is known: only the make and the year narrow the list. */
export type CannedCar = { make?: string | null; year?: number | string | null };

/** "All cars", "Toyota, Honda", "Toyota 2015–2020", "2010 and newer"… the scope line under a canned job. */
export function cannedScope(c: Pick<CannedJob, "makes" | "year_from" | "year_to">): string {
  const makes = c.makes.length ? c.makes.join(", ") : null;
  const years = c.year_from && c.year_to ? (c.year_from === c.year_to ? String(c.year_from) : `${c.year_from}–${c.year_to}`) : c.year_from ? `${c.year_from} and newer` : c.year_to ? `${c.year_to} and older` : null;
  if (!makes && !years) return "on all cars";
  return `on ${[makes, years].filter(Boolean).join(" ")}`;
}

/** Does this canned job apply to the car? A job with no make or year limits applies to every car; an unknown car matches everything. */
export function cannedMatchesCar(c: Pick<CannedJob, "makes" | "year_from" | "year_to">, car: CannedCar | null | undefined, filters: { make: boolean; year: boolean } = { make: true, year: true }): boolean {
  const make = (car?.make ?? "").trim().toLowerCase();
  const year = Number(car?.year ?? 0);
  if (filters.make && make && c.makes.length > 0 && !c.makes.some((m) => m.trim().toLowerCase() === make)) return false;
  if (filters.year && year) {
    if (c.year_from && year < c.year_from) return false;
    if (c.year_to && year > c.year_to) return false;
  }
  return true;
}

export type CannedContext = { defaultRate: number | null; markupPct: number | null | undefined; services: QuoteService[]; size: VehicleSize };

/** One saved line → a builder draft line: labor keeps its hours (the shop rate when none is saved); a part with no list price gets cost + the default markup. */
export function draftFromCannedLine(l: CannedLine, ctx: Pick<CannedContext, "markupPct">): EstimateLineDraft | null {
  const type = l.line_type;
  if (type === "service") return l.service_id ? emptyLine("service", { service_id: l.service_id, qty: l.qty ?? 1, label: l.name ?? null }) : null;
  const label = (l.name ?? "").trim();
  if (!label) return null;
  if (type === "labor") return emptyLine("labor", { label, hours: l.hours ?? 1, rate: l.rate ?? null, taxable: l.taxable ?? null, cost: l.cost ?? null });
  if (type === "part") {
    const price = l.price ?? (l.cost !== undefined ? listPriceFromCost(l.cost, ctx.markupPct) : null) ?? 0;
    return emptyLine("part", { label, qty: l.qty ?? 1, price, part_number: l.part_number ?? null, part_condition: l.part_condition ?? "new", vendor: l.vendor ?? null, taxable: l.taxable ?? null, cost: l.cost ?? null });
  }
  return emptyLine(type, { label, qty: l.qty ?? 1, price: l.price ?? 0, vendor: l.vendor ?? null, taxable: l.taxable ?? null, cost: l.cost ?? null });
}

/** A canned (or past) job as a builder job: its title, priority and drafted lines. Lines it cannot draw (an empty name) are skipped. */
export function expandCanned(job: { name?: string; title?: string; priority: EstimateJobPriority; lines: CannedLine[] }, ctx: Pick<CannedContext, "markupPct">): { title: string; priority: EstimateJobPriority; lines: EstimateLineDraft[] } {
  const lines = job.lines.map((l) => draftFromCannedLine(l, ctx)).filter((l): l is EstimateLineDraft => !!l);
  return { title: (job.name ?? job.title ?? "Job").slice(0, 80), priority: job.priority, lines };
}

/** What a canned job adds up to before tax and shop supplies: hours, labor, parts and the rest, for the row in the dialog. */
export function cannedSummary(lines: CannedLine[], ctx: CannedContext): { hours: number; labor: number; parts: number; other: number; total: number; partCount: number; rate: number | null } {
  let hours = 0;
  let labor = 0;
  let parts = 0;
  let other = 0;
  let partCount = 0;
  for (const l of lines) {
    if (l.line_type === "labor") {
      const h = l.hours ?? 0;
      hours += h;
      labor += h * (l.rate ?? ctx.defaultRate ?? 0);
    } else if (l.line_type === "part") {
      partCount += 1;
      parts += (l.qty ?? 1) * (l.price ?? (l.cost !== undefined ? (listPriceFromCost(l.cost, ctx.markupPct) ?? 0) : 0));
    } else if (l.line_type === "service") {
      const s = ctx.services.find((x) => x.id === l.service_id);
      other += (l.qty ?? 1) * (s ? retailPrice(s, ctx.size) : 0);
    } else other += (l.qty ?? 1) * (l.price ?? 0);
  }
  const r = (n: number) => Math.round(n * 100) / 100;
  return { hours: r(hours), labor: r(labor), parts: r(parts), other: r(other), total: r(labor + parts + other), partCount, rate: ctx.defaultRate };
}

/** The lines of a job as it sits in the builder → what a canned job stores. Money the shop typed stays; a part with a cost keeps both. */
export function cannedLinesFromDraft(lines: EstimateLineDraft[]): CannedLine[] {
  const out: CannedLine[] = [];
  for (const l of lines) {
    const base: CannedLine = { line_type: l.line_type, qty: l.qty };
    if (l.line_type === "service") {
      if (!l.service_id) continue;
      out.push({ ...base, service_id: l.service_id });
      continue;
    }
    if (!l.label?.trim()) continue;
    const line: CannedLine = { ...base, name: l.label.trim() };
    if (l.line_type === "labor") {
      line.hours = Number(l.hours ?? 0);
      if (l.rate != null) line.rate = Number(l.rate);
    } else if (l.price != null) line.price = Number(l.price);
    if (l.cost != null) line.cost = Number(l.cost);
    if (l.part_number) line.part_number = l.part_number;
    if (l.vendor) line.vendor = l.vendor;
    if (l.taxable != null) line.taxable = l.taxable;
    if (l.line_type === "part") line.part_condition = l.part_condition ?? "new";
    out.push(line);
  }
  return out;
}

export const pastServiceAsCanned = (p: PastService): { title: string; priority: EstimateJobPriority; lines: CannedLine[] } => ({ title: p.title, priority: p.priority, lines: p.lines });
