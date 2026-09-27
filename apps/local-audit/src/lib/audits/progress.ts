import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { AuditStatus } from "@/lib/db/types";

export interface AuditProgress {
  status?: AuditStatus;
  progress_pct?: number;
  current_step?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
}

/** Job-side progress updates. Runs with the service role: the worker has no user session. */
export async function setAuditProgress(auditId: string, patch: AuditProgress): Promise<void> {
  const { error } = await createAdminClient().from("audits").update(patch).eq("id", auditId);
  if (error) throw new Error(`audit ${auditId}: progress update failed: ${error.message}`);
}

export async function markAuditFailed(auditId: string, message: string): Promise<void> {
  await setAuditProgress(auditId, { status: "failed", current_step: `failed: ${message.slice(0, 200)}`, finished_at: new Date().toISOString() });
}
