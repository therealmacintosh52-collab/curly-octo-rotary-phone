import { z } from "zod";
import type { Json } from "@/lib/db/types";

/**
 * The shape get_client_report() returns. Solutions and the top level are
 * strict: an unexpected key means the RPC changed and the page must fail
 * closed rather than render something the client should not see.
 */
const SolutionSchema = z.strictObject({
  id: z.string(),
  finding_id: z.string(),
  steps: z.unknown(),
  assets: z.unknown(),
  code_snippets: z.unknown(),
  time_estimate_hrs: z.number().nullable(),
  suggested_price: z.number().nullable(),
  priority_rank: z.number().nullable(),
  roadmap_phase: z.number().nullable(),
  revealed_at: z.string().nullable(),
});

const Row = z.record(z.string(), z.unknown());

export const ClientReportSchema = z.strictObject({
  audit: z.strictObject({
    id: z.string(),
    status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
    progress_pct: z.number(),
    finished_at: z.string().nullable(),
    scores: z.unknown(),
    revenue_model: z.unknown(),
    version: z.number(),
  }),
  business: z.strictObject({
    name: z.string(),
    canonical_domain: z.string().nullable(),
    primary_category: z.string().nullable(),
    address: z.string().nullable(),
  }),
  findings: z.array(Row),
  solutions: z.array(SolutionSchema),
  solution_counts: z.strictObject({ revealed: z.number(), total: z.number() }),
  competitors: z.array(Row),
  ai_visibility: z.array(Row),
  rank_grid: z.array(Row),
  citations: z.array(Row),
  social_profiles: z.array(Row),
  backlink_metrics: z.array(Row),
  brand_mentions: z.array(Row),
  evidence: z.array(Row.refine((r) => !("storage_path" in r), { message: "evidence must not carry storage_path" })),
  share: z.strictObject({ expires_at: z.string().nullable(), view_count: z.number() }),
});
export type ClientReport = z.infer<typeof ClientReportSchema>;

export type ReportRpc = (token: string) => Promise<{ data: Json | null; error: { message: string } | null }>;

/**
 * Loads a report for a share token. `null` means unknown/expired (→ 404).
 * A schema failure throws on purpose: it means the RPC drifted from what the
 * page is allowed to show.
 */
export async function loadClientReport(token: string, rpc: ReportRpc): Promise<ClientReport | null> {
  if (!/^[A-Za-z0-9_-]{4,128}$/.test(token)) return null;
  const { data, error } = await rpc(token);
  if (error) throw new Error(`get_client_report failed: ${error.message}`);
  if (data === null) return null;
  return ClientReportSchema.parse(data);
}
