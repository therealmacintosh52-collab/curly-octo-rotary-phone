import { CHECK_CATEGORIES, type CheckCategory } from "@/lib/checks/registry";
import type { FindingSeverity } from "@/lib/db/types";
import { SCORE_WEIGHTS, SEVERITY_PENALTY } from "./config";

export interface ScoredFinding {
  category: CheckCategory;
  severity: FindingSeverity;
}

export interface Scores {
  /** 0–100 per assessed category; null = not assessed (no checks ran). */
  categories: Record<CheckCategory, number | null>;
  visibility: number | null;
  conversion: number | null;
}

/**
 * Category score = 100 minus the severity penalties of its findings, floored
 * at 0. Headline scores are the weighted mean over the categories that were
 * assessed. Unassessed categories never count as either 0 or 100.
 */
export function computeScores(findings: ScoredFinding[], assessed: Iterable<CheckCategory>): Scores {
  const assessedSet = new Set(assessed);
  const categories = Object.fromEntries(CHECK_CATEGORIES.map((c) => [c, null])) as Record<CheckCategory, number | null>;

  for (const c of assessedSet) {
    const penalty = findings.filter((f) => f.category === c).reduce((sum, f) => sum + SEVERITY_PENALTY[f.severity], 0);
    categories[c] = Math.max(0, 100 - penalty);
  }

  const weighted = (key: "visibility" | "conversion") => {
    let total = 0;
    let weight = 0;
    for (const c of assessedSet) {
      const w = SCORE_WEIGHTS[c][key];
      if (w === 0 || categories[c] === null) continue;
      total += categories[c]! * w;
      weight += w;
    }
    return weight === 0 ? null : Math.round(total / weight);
  };

  return { categories, visibility: weighted("visibility"), conversion: weighted("conversion") };
}
