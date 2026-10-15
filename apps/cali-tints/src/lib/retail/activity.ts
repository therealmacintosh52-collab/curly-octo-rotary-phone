import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, ViewKind } from "@/lib/db/types";

/** Record that staff opened something (one entry per person and kind per ten minutes). Never blocks the page. */
export async function logStaffView(supabase: SupabaseClient<Database>, estimateId: string | null | undefined, what: ViewKind): Promise<void> {
  if (!estimateId) return;
  try {
    await supabase.rpc("log_visit_view", { p_estimate: estimateId, p_what: what });
  } catch {
    /* the log is best effort: the page still opens */
  }
}

/** Record that the customer opened their link (an estimate link or an invoice link). */
export async function logCustomerView(client: SupabaseClient<Database>, token: string, what: Exclude<ViewKind, "signed_copy">): Promise<void> {
  try {
    await client.rpc("log_customer_view", { p_token: token, p_what: what });
  } catch {
    /* best effort */
  }
}

const KIND_LABEL: Record<string, string> = {
  estimates: "Estimate",
  jobs: "Work order",
  lines: "Lines",
  estimate_authorizations: "Approval",
  job_authorizations: "Signature",
  finding: "Finding",
  photos: "Photos",
  payment: "Payment",
  transfer: "Hand-off",
  message: "Message",
  document: "Signed copy",
  view: "Viewed",
};
export const activityKindLabel = (k: string): string => KIND_LABEL[k] ?? "Activity";
