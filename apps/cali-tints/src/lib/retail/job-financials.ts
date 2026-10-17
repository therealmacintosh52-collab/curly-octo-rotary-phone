import type { EstimateJobPriority } from "@/lib/db/types";

/** The five tables of a job on the work order: services count as labor, like the shop's own screens. */
export type JobBucket = "labor" | "parts" | "fees" | "sublet";

export type JobLine = {
  key: string;
  type: "service" | "labor" | "part" | "fee" | "sublet";
  name: string;
  qty: number;
  /** What the customer pays per unit (null when the viewer may not see prices). */
  unit: number | null;
  total: number | null;
  hours?: number | null;
  rate?: number | null;
  tech?: string | null;
  techId?: string | null;
  partNumber?: string | null;
  note?: string | null;
  vendor?: string | null;
  /** The shop's cost for the whole line (qty already applied); null when unknown or hidden. */
  cost: number | null;
  declined?: boolean;
  inventoryItemId?: string | null;
};

export type JobModel = { key: string; title: string; priority: EstimateJobPriority; kind: "diagnosis" | "repair"; status: string; lines: JobLine[] };

export const bucketOf = (t: JobLine["type"]): JobBucket => (t === "part" ? "parts" : t === "fee" ? "fees" : t === "sublet" ? "sublet" : "labor");

export type BucketFigures = { total: number; cost: number; profit: number | null; pct: number | null; lines: number };
export type JobFinancials = Record<JobBucket | "all", BucketFigures>;

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Totals per table and for the job. Profit is revenue minus cost, shown only when every line that
 * has a price also has a cost (a half-known margin would mislead); declined lines do not count.
 */
export function jobFinancials(lines: JobLine[]): JobFinancials {
  const empty = (): BucketFigures & { known: boolean; unknown: boolean } => ({ total: 0, cost: 0, profit: null, pct: null, lines: 0, known: false, unknown: false });
  const acc: Record<JobBucket | "all", ReturnType<typeof empty>> = { labor: empty(), parts: empty(), fees: empty(), sublet: empty(), all: empty() };
  for (const l of lines) {
    if (l.declined) continue;
    for (const b of [acc[bucketOf(l.type)], acc.all]) {
      b.lines += 1;
      b.total += l.total ?? 0;
      if (l.cost === null || l.cost === undefined) b.unknown = true;
      else {
        b.cost += l.cost;
        b.known = true;
      }
    }
  }
  const out = {} as JobFinancials;
  for (const k of Object.keys(acc) as (JobBucket | "all")[]) {
    const b = acc[k];
    const total = r2(b.total);
    const cost = r2(b.cost);
    const ok = b.known && !b.unknown && total > 0;
    out[k] = { total, cost, lines: b.lines, profit: ok ? r2(total - cost) : null, pct: ok ? Math.round(((total - cost) / total) * 100) : null };
  }
  return out;
}

/** "GP 24%" text for a bucket, or null when it is not known. */
export const gpLabel = (f: BucketFigures): string | null => (f.pct === null ? null : `${f.pct}%`);
