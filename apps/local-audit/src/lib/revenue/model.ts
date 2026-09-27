import { ctrAt, DEFAULT_ASSUMPTIONS, type Range, type RevenueAssumptions } from "./defaults";

export interface KeywordInput {
  keyword: string;
  monthlySearchVolume: number;
  /** null = not ranking in the tracked range. */
  currentPosition: number | null;
  /** Optional Google Ads CPC for the ad-equivalent value. */
  cpcUsd?: number | null;
  /** Organic curve by default; "map_pack" uses the local pack curve. */
  surface?: "organic" | "map_pack";
}

export interface KeywordLoss {
  keyword: string;
  lostClicksPerMonth: number;
  lostLeadsPerMonth: Range;
  lostRevenuePerMonth: Range;
  /** What the missing clicks would cost to buy as ads, when CPC is known. */
  adEquivalentUsdPerMonth: number | null;
}

export interface RevenueEstimate {
  keywords: KeywordLoss[];
  totals: { lostClicksPerMonth: number; lostLeadsPerMonth: Range; lostRevenuePerMonth: Range; adEquivalentUsdPerMonth: number | null };
  assumptions: RevenueAssumptions;
}

const round = (n: number, dp = 2) => Math.round(n * 10 ** dp) / 10 ** dp;
const mapRange = (r: Range, f: (v: number) => number): Range => ({ low: round(f(r.low)), mid: round(f(r.mid)), high: round(f(r.high)) });
const addRange = (a: Range, b: Range): Range => ({ low: round(a.low + b.low), mid: round(a.mid + b.mid), high: round(a.high + b.high) });

/**
 * Master plan §4 step 10, per keyword:
 *   lost_clicks  = volume × (CTR at target position − CTR at current position)
 *   lost_leads   = lost_clicks × lead conversion rate
 *   lost_revenue = lost_leads × close rate × average ticket
 * Always a low/mid/high range; never a single number. Keywords already at or
 * above the target position contribute zero.
 */
export function estimateKeywordLoss(input: KeywordInput, assumptions: RevenueAssumptions = DEFAULT_ASSUMPTIONS): KeywordLoss {
  const curve = input.surface === "map_pack" ? assumptions.mapPackCtrByPosition : assumptions.ctrByPosition;
  const targetCtr = ctrAt(curve, assumptions.targetPosition);
  const currentCtr = ctrAt(curve, input.currentPosition);
  const lostClicks = Math.max(0, input.monthlySearchVolume * (targetCtr - currentCtr));

  const lostLeads = mapRange(assumptions.leadConversionRate, (rate) => lostClicks * rate);
  const lostRevenue: Range = {
    low: round(lostLeads.low * assumptions.closeRate.low * assumptions.avgTicketUsd.low),
    mid: round(lostLeads.mid * assumptions.closeRate.mid * assumptions.avgTicketUsd.mid),
    high: round(lostLeads.high * assumptions.closeRate.high * assumptions.avgTicketUsd.high),
  };
  const adEquivalent = input.cpcUsd != null ? round(lostClicks * input.cpcUsd) : null;

  return { keyword: input.keyword, lostClicksPerMonth: round(lostClicks, 1), lostLeadsPerMonth: lostLeads, lostRevenuePerMonth: lostRevenue, adEquivalentUsdPerMonth: adEquivalent };
}

export function estimateRevenueLoss(keywords: KeywordInput[], assumptions: RevenueAssumptions = DEFAULT_ASSUMPTIONS): RevenueEstimate {
  const rows = keywords.map((k) => estimateKeywordLoss(k, assumptions));
  const zero: Range = { low: 0, mid: 0, high: 0 };
  const knownCpc = rows.filter((r) => r.adEquivalentUsdPerMonth !== null);
  return {
    keywords: rows,
    totals: {
      lostClicksPerMonth: round(rows.reduce((s, r) => s + r.lostClicksPerMonth, 0), 1),
      lostLeadsPerMonth: rows.reduce((s, r) => addRange(s, r.lostLeadsPerMonth), zero),
      lostRevenuePerMonth: rows.reduce((s, r) => addRange(s, r.lostRevenuePerMonth), zero),
      adEquivalentUsdPerMonth: knownCpc.length ? round(knownCpc.reduce((s, r) => s + (r.adEquivalentUsdPerMonth ?? 0), 0)) : null,
    },
    assumptions,
  };
}

/** Apply per-audit overrides on top of the defaults (admin-editable panel). */
export function withOverrides(overrides: Partial<Pick<RevenueAssumptions, "targetPosition" | "leadConversionRate" | "closeRate" | "avgTicketUsd">>, base: RevenueAssumptions = DEFAULT_ASSUMPTIONS): RevenueAssumptions {
  return { ...base, ...overrides };
}
