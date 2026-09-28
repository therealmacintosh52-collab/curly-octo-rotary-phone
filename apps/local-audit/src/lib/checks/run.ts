import type { FindingSeverity, FixDifficulty } from "@/lib/db/types";
import { listChecks, type Check, type CheckCategory, type CheckContext, type EvidenceInput } from "./registry";

export interface FindingDraft {
  check_id: string;
  category: CheckCategory;
  title: string;
  plain_english: string;
  severity: FindingSeverity;
  impact_score: number;
  fix_difficulty: FixDifficulty;
  evidence: EvidenceInput[];
}

export interface CheckRunResult {
  findings: FindingDraft[];
  passed: string[];
  unavailable: { check_id: string; reason: string }[];
  /** Categories with at least one check that produced a pass or a finding. */
  assessed: CheckCategory[];
}

/** Runs checks against a context. A check that throws is reported as unavailable, never as a pass. */
export async function runChecks(ctx: CheckContext, checks: Check[] = listChecks()): Promise<CheckRunResult> {
  const out: CheckRunResult = { findings: [], passed: [], unavailable: [], assessed: [] };
  const assessed = new Set<CheckCategory>();
  for (const check of checks) {
    let outcome;
    try {
      outcome = await check.run(ctx);
    } catch (err) {
      out.unavailable.push({ check_id: check.id, reason: `check threw: ${err instanceof Error ? err.message : String(err)}` });
      continue;
    }
    if (outcome.status === "unavailable") {
      out.unavailable.push({ check_id: check.id, reason: outcome.reason });
      continue;
    }
    assessed.add(check.category);
    if (outcome.status === "pass") {
      out.passed.push(check.id);
      continue;
    }
    out.findings.push({
      check_id: check.id,
      category: check.category,
      title: outcome.title,
      plain_english: outcome.plain_english,
      severity: outcome.severity,
      impact_score: outcome.impact_score,
      fix_difficulty: outcome.fix_difficulty,
      evidence: outcome.evidence,
    });
  }
  out.assessed = [...assessed];
  return out;
}
