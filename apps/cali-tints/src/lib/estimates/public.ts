import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database, EstimateView } from "@/lib/db/types";
import { supabasePublicKey, supabaseUrl } from "@/lib/supabase/env";

/**
 * The customer's side of an estimate has no login: the token in the link is
 * the key. These calls run as `anon`, which can execute the token RPCs and
 * nothing else (migration 0039). No cookies, nothing cached per user.
 */
export function anonClient() {
  return createSupabaseClient<Database>(supabaseUrl(), supabasePublicKey(), { auth: { persistSession: false, autoRefreshToken: false } });
}

/** A token is 24 random bytes, url-safe base64: 32 characters. Anything else is refused before it reaches the database. */
export function isTokenShape(token: string | undefined | null): token is string {
  return !!token && /^[A-Za-z0-9_-]{20,64}$/.test(token);
}

export async function loadPublicEstimate(token: string): Promise<EstimateView | null> {
  if (!isTokenShape(token)) return null;
  const db = anonClient();
  const [{ data, error }, { data: inspections }] = await Promise.all([db.rpc("estimate_by_token", { p_token: token }), db.rpc("inspections_by_token", { p_token: token })]);
  if (error || !data) return null;
  return inspections?.length ? { ...data, inspections } : data;
}
