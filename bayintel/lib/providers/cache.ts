import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Postgres-backed response cache for third-party providers (provider_cache table).
 * Falls back to an in-memory map when the service role key is missing (local dev).
 */
const memory = new Map<string, { payload: unknown; expiresAt: number }>();

function hasDb() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const now = Date.now();
  const hit = memory.get(key);
  if (hit && hit.expiresAt > now) return hit.payload as T;
  if (!hasDb()) return null;
  try {
    const db = createAdminClient();
    const { data } = await db.from("provider_cache").select("payload, expires_at").eq("cache_key", key).maybeSingle();
    if (!data) return null;
    const expiresAt = new Date(data.expires_at).getTime();
    if (expiresAt <= now) return null;
    memory.set(key, { payload: data.payload, expiresAt });
    return data.payload as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, provider: string, payload: unknown, ttlMs: number) {
  const expiresAt = Date.now() + ttlMs;
  memory.set(key, { payload, expiresAt });
  if (!hasDb()) return;
  try {
    const db = createAdminClient();
    await db.from("provider_cache").upsert(
      {
        cache_key: key,
        provider,
        payload: payload as never,
        fetched_at: new Date().toISOString(),
        expires_at: new Date(expiresAt).toISOString(),
      },
      { onConflict: "cache_key" },
    );
  } catch {
    // Cache writes are best-effort.
  }
}

export async function cached<T>(key: string, provider: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = await cacheGet<T>(key);
  if (hit !== null) return hit;
  const fresh = await fetcher();
  await cacheSet(key, provider, fresh, ttlMs);
  return fresh;
}
