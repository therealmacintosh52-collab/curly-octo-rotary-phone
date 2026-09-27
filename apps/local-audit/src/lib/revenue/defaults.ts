/**
 * Default assumptions for the revenue-loss model. Every number here is an
 * industry-wide benchmark, not a measurement of the audited business, and the
 * admin can override each one per audit. Sources are named so the client
 * report's "How we calculated this" panel can cite them; `verified` marks
 * whether someone has re-checked the figure against the source recently.
 */
export interface Range {
  low: number;
  mid: number;
  high: number;
}

export interface RevenueAssumptions {
  /** Share of searchers who click a result at each position (organic, mobile). */
  ctrByPosition: Record<number, number>;
  /** Share of local-pack impressions that become a click/call/direction at each pack position. */
  mapPackCtrByPosition: Record<number, number>;
  /** Position the business is assumed to reach after fixes. */
  targetPosition: number;
  /** Website visit → lead (call, form, booking). */
  leadConversionRate: Range;
  /** Lead → paying job. */
  closeRate: Range;
  /** Average ticket in USD; overridden by the business's own figure when known. */
  avgTicketUsd: Range;
  sources: { key: keyof Omit<RevenueAssumptions, "sources">; note: string; url: string; verified: boolean }[];
}

export const DEFAULT_ASSUMPTIONS: RevenueAssumptions = {
  ctrByPosition: { 1: 0.27, 2: 0.15, 3: 0.11, 4: 0.08, 5: 0.06, 6: 0.05, 7: 0.04, 8: 0.03, 9: 0.03, 10: 0.02 },
  mapPackCtrByPosition: { 1: 0.18, 2: 0.12, 3: 0.09 },
  targetPosition: 3,
  leadConversionRate: { low: 0.02, mid: 0.04, high: 0.07 },
  closeRate: { low: 0.2, mid: 0.3, high: 0.45 },
  avgTicketUsd: { low: 150, mid: 300, high: 600 },
  sources: [
    { key: "ctrByPosition", note: "Organic CTR curve by position, mobile. Re-check yearly.", url: "https://www.advancedwebranking.com/ctrstudy/", verified: false },
    { key: "mapPackCtrByPosition", note: "Local pack click share by position; conservative reading of published local SEO studies.", url: "https://www.brightlocal.com/research/", verified: false },
    { key: "leadConversionRate", note: "Home-services website visit-to-lead range across published benchmarks.", url: "https://www.wordstream.com/blog/ws/2019/08/19/conversion-rate-benchmarks", verified: false },
    { key: "closeRate", note: "Lead-to-job close rate range for local service businesses.", url: "https://www.servicetitan.com/blog", verified: false },
    { key: "avgTicketUsd", note: "Placeholder range; replaced by the business's own average ticket when supplied.", url: "docs/MASTER_PLAN.md#step-10", verified: false },
  ],
};

/** CTR at a position, 0 when below the curve (page 2 and beyond). */
export function ctrAt(curve: Record<number, number>, position: number | null): number {
  if (position === null || position < 1) return 0;
  return curve[Math.floor(position)] ?? 0;
}
