import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

/**
 * The page a customer should open about a work order. If extra work is waiting
 * for an answer (a sent, not yet approved supplement) it is that estimate's
 * `/e/<token>` page, where they can approve or decline; the read-only `/r/<token>`
 * receipt page cannot take an answer. Otherwise the `/r/<token>` page.
 */
export async function customerLinkForJob(supabase: SupabaseClient<Database>, jobId: string, base: string): Promise<string | null> {
  const { data: ests } = await supabase.rpc("job_estimates", { p_job: jobId });
  const open = (ests ?? []).find((e) => e.kind === "supplement" && !e.applied_at && (e.status === "sent" || e.status === "viewed"));
  if (open) {
    const { data: token } = await supabase.rpc("estimate_link", { p_id: open.id });
    if (token) return `${base}/e/${token}`;
  }
  const { data: rt } = await supabase.rpc("receipt_link", { p_job_id: jobId });
  return rt ? `${base}/r/${rt}` : null;
}
