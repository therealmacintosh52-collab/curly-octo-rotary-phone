/**
 * Per-million-token prices used for cost logging. Recorded from the pricing
 * page on the date below; `verified: false` means nobody has re-checked them
 * against an invoice yet. Usage is stored with every snapshot, so costs can be
 * recomputed if these numbers change.
 * Source: https://platform.claude.com/docs/en/about-claude/pricing
 */
export const ANTHROPIC_MODEL = "claude-opus-5" as const;

export const ANTHROPIC_PRICING_USD_PER_MTOK = {
  "claude-opus-5": { input: 5, output: 25, cacheWrite: 6.25, cacheRead: 0.5, asOf: "2026-06-24", verified: false },
} as const;

export interface UsageLike {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number | null;
  cache_read_input_tokens?: number | null;
}

export function costFromUsage(usage: UsageLike, model: keyof typeof ANTHROPIC_PRICING_USD_PER_MTOK = ANTHROPIC_MODEL): number {
  const p = ANTHROPIC_PRICING_USD_PER_MTOK[model];
  const cost =
    (usage.input_tokens * p.input +
      usage.output_tokens * p.output +
      (usage.cache_creation_input_tokens ?? 0) * p.cacheWrite +
      (usage.cache_read_input_tokens ?? 0) * p.cacheRead) /
    1_000_000;
  return Math.round(cost * 1e6) / 1e6;
}
