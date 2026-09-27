import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/db/types";

export interface SnapshotRow {
  id?: string;
  audit_id: string | null;
  provider: string;
  endpoint: string;
  cache_key: string;
  request: unknown;
  response: unknown;
  fetched_at: string;
  cost_usd: number;
  expires_at: string | null;
}

/**
 * Persistence for every external call. The Supabase implementation writes
 * raw_snapshots (and the trigger rolls cost into audits.total_cost_usd);
 * the memory implementation backs unit tests.
 */
export interface SnapshotStore {
  /** Newest unexpired snapshot for a cache key, or null. */
  findFresh(cacheKey: string, now?: Date): Promise<(SnapshotRow & { id: string }) | null>;
  save(row: SnapshotRow): Promise<{ id: string }>;
  sumCost(auditId: string): Promise<number>;
}

export class MemorySnapshotStore implements SnapshotStore {
  readonly rows: (SnapshotRow & { id: string })[] = [];
  private seq = 0;

  async findFresh(cacheKey: string, now: Date = new Date()) {
    const hits = this.rows.filter((r) => r.cache_key === cacheKey && (r.expires_at === null || new Date(r.expires_at) > now));
    hits.sort((a, b) => b.fetched_at.localeCompare(a.fetched_at));
    return hits[0] ?? null;
  }

  async save(row: SnapshotRow) {
    const id = row.id ?? `mem-${++this.seq}`;
    this.rows.push({ ...row, id });
    return { id };
  }

  async sumCost(auditId: string) {
    return this.rows.filter((r) => r.audit_id === auditId).reduce((sum, r) => sum + r.cost_usd, 0);
  }
}

/** Store backed by raw_snapshots. Pass the service-role client: the job worker has no user session. */
export function supabaseSnapshotStore(client: SupabaseClient<Database>): SnapshotStore {
  return {
    async findFresh(cacheKey, now = new Date()) {
      const { data, error } = await client
        .from("raw_snapshots")
        .select("*")
        .eq("cache_key", cacheKey)
        .or(`expires_at.is.null,expires_at.gt.${now.toISOString()}`)
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw new Error(`raw_snapshots lookup failed: ${error.message}`);
      if (!data) return null;
      return {
        id: data.id,
        audit_id: data.audit_id,
        provider: data.provider,
        endpoint: data.endpoint,
        cache_key: data.cache_key ?? cacheKey,
        request: data.request,
        response: data.response,
        fetched_at: data.fetched_at,
        cost_usd: Number(data.cost_usd),
        expires_at: data.expires_at,
      };
    },
    async save(row) {
      const { data, error } = await client
        .from("raw_snapshots")
        .insert({
          audit_id: row.audit_id,
          provider: row.provider,
          endpoint: row.endpoint,
          cache_key: row.cache_key,
          request: row.request as Json,
          response: row.response as Json,
          fetched_at: row.fetched_at,
          cost_usd: row.cost_usd,
          expires_at: row.expires_at,
        })
        .select("id")
        .single();
      if (error) throw new Error(`raw_snapshots insert failed: ${error.message}`);
      return { id: data.id };
    },
    async sumCost(auditId) {
      const { data, error } = await client.rpc("audit_cost_usd", { p_audit_id: auditId });
      if (error) throw new Error(`audit_cost_usd failed: ${error.message}`);
      return Number(data ?? 0);
    },
  };
}
