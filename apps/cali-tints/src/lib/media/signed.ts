import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

/** Short-lived signed URLs for a batch of private files, one round trip. Missing files map to null. */
export async function signedUrls(db: SupabaseClient<Database>, bucket: string, paths: string[], expiresIn = 3600): Promise<Map<string, string | null>> {
  const out = new Map<string, string | null>();
  const unique = Array.from(new Set(paths.filter(Boolean)));
  if (unique.length === 0) return out;
  const { data } = await db.storage.from(bucket).createSignedUrls(unique, expiresIn);
  (data ?? []).forEach((row, i) => out.set(unique[i], row.signedUrl || null));
  for (const p of unique) if (!out.has(p)) out.set(p, null);
  return out;
}
