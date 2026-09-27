import type { CheckCategory } from "@/lib/checks/registry";
import type { FindingSeverity } from "@/lib/db/types";

/**
 * How much each category counts toward the two headline scores. Weights are
 * relative; only categories that were actually assessed take part. Tune here,
 * never in the code that applies them; `score.test.ts` pins the arithmetic.
 */
export const SCORE_WEIGHTS: Record<CheckCategory, { visibility: number; conversion: number }> = {
  identity_nap: { visibility: 8, conversion: 2 },
  technical_seo: { visibility: 8, conversion: 3 },
  local_onsite: { visibility: 8, conversion: 2 },
  schema: { visibility: 5, conversion: 0 },
  aeo: { visibility: 6, conversion: 0 },
  images: { visibility: 2, conversion: 3 },
  conversion: { visibility: 0, conversion: 12 },
  content_keywords: { visibility: 8, conversion: 1 },
  gbp: { visibility: 14, conversion: 4 },
  yelp: { visibility: 4, conversion: 2 },
  citations: { visibility: 6, conversion: 0 },
  rankings: { visibility: 12, conversion: 0 },
  ai_visibility: { visibility: 8, conversion: 0 },
  backlinks_authority: { visibility: 6, conversion: 0 },
  social: { visibility: 3, conversion: 2 },
  brand_mentions: { visibility: 2, conversion: 0 },
};

/** Points a finding removes from its category (which starts at 100). */
export const SEVERITY_PENALTY: Record<FindingSeverity, number> = {
  critical: 40,
  high: 20,
  medium: 10,
  low: 4,
};
