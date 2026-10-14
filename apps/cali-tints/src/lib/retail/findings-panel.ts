import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, JobFinding } from "@/lib/db/types";
import { signedUrls } from "@/lib/media/signed";

/** Short-lived links for the photos and clips of a batch of findings (private bucket, minted on the server). */
export async function withMediaUrls(supabase: SupabaseClient<Database>, findings: JobFinding[]): Promise<JobFinding[]> {
  const urls = await signedUrls(supabase, "job-photos", findings.flatMap((f) => f.media.map((m) => m.storage_path)));
  return findings.map((f) => ({ ...f, media: f.media.map((m) => ({ ...m, url: urls.get(m.storage_path) ?? null })) }));
}

/** The retail menu a tech can recommend from (names only; the prices are not read here). */
export async function recommendableServices(supabase: SupabaseClient<Database>): Promise<{ id: string; name: string }[]> {
  const { data } = await supabase.rpc("retail_catalog");
  return (data?.services ?? []).filter((s) => s.retail && s.active && !s.open_amount).map((s) => ({ id: s.id, name: s.name }));
}
