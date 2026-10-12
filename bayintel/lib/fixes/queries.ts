import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type FixRow = Database["public"]["Tables"]["fixes"]["Row"];
export type FixPart = Database["public"]["Tables"]["fix_parts"]["Row"];

export interface RankedFix {
  fix: FixRow & { fix_dtcs: { code: string }[]; profiles: { display_name: string; reputation: number } | null };
  rankScore: number;
  matchLevel: "exact" | "same_year" | "near_year";
  matchedCodes: string[];
}

export async function rankFixes(opts: { make: string; model: string; year: number; engine?: string | null; codes?: string[] | null; limit?: number }): Promise<RankedFix[]> {
  const supabase = await createClient();
  const { data: ranked, error } = await supabase.rpc("rank_fixes", {
    p_make: opts.make,
    p_model: opts.model,
    p_year: opts.year,
    p_engine: opts.engine ?? undefined,
    p_codes: opts.codes && opts.codes.length ? opts.codes : undefined,
    p_limit: opts.limit ?? 25,
  });
  if (error || !ranked?.length) return [];
  const ids = ranked.map((r) => r.fix_id);
  const { data: fixes } = await supabase
    .from("fixes")
    .select("*, fix_dtcs(code), profiles:author_id(display_name, reputation)")
    .in("id", ids);
  const byId = new Map((fixes ?? []).map((f) => [f.id, f]));
  return ranked
    .map((r) => {
      const fix = byId.get(r.fix_id);
      if (!fix) return null;
      return {
        fix: fix as unknown as RankedFix["fix"],
        rankScore: Number(r.rank_score),
        matchLevel: r.match_level as RankedFix["matchLevel"],
        matchedCodes: r.matched_codes ?? [],
      };
    })
    .filter((x): x is RankedFix => x !== null);
}
