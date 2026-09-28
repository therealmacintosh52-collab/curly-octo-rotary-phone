import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Audit, Business, Database, EvidenceType, FindingSeverity, FixDifficulty, Json } from "@/lib/db/types";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Job-side persistence. The interface is small on purpose so the resolve
 * step can be tested with an in-memory implementation; the Supabase one
 * runs with the service role because the worker has no user session.
 */
export interface EvidenceRow {
  type: EvidenceType;
  excerpt: string;
  source_url?: string | null;
  storage_path?: string | null;
}

export interface FindingRow {
  check_id: string;
  category: string;
  title: string;
  plain_english: string;
  severity: FindingSeverity;
  impact_score: number;
  fix_difficulty: FixDifficulty;
  evidence_ids: string[];
}

export interface AuditRepo {
  load(auditId: string): Promise<{ audit: Audit; business: Business }>;
  updateBusiness(businessId: string, patch: Partial<Omit<Business, "id" | "created_at" | "updated_at">>): Promise<void>;
  insertEvidence(auditId: string, rows: EvidenceRow[]): Promise<string[]>;
  insertFindings(auditId: string, rows: FindingRow[]): Promise<void>;
  /** Findings persisted so far (all steps), for scoring. */
  listFindings(auditId: string): Promise<{ category: string; severity: FindingSeverity }[]>;
  /** Merges keys into the audit's `scores` jsonb (step summaries, category scores, headline scores). */
  mergeScores(auditId: string, patch: Record<string, Json>): Promise<void>;
}

export function supabaseAuditRepo(client: SupabaseClient<Database> = createAdminClient()): AuditRepo {
  return {
    async load(auditId) {
      const { data: audit, error } = await client.from("audits").select("*").eq("id", auditId).single();
      if (error || !audit) throw new Error(`audit ${auditId} not found: ${error?.message ?? "no row"}`);
      const { data: business, error: berr } = await client.from("businesses").select("*").eq("id", audit.business_id).single();
      if (berr || !business) throw new Error(`business ${audit.business_id} not found: ${berr?.message ?? "no row"}`);
      return { audit, business };
    },
    async updateBusiness(businessId, patch) {
      const { error } = await client.from("businesses").update(patch).eq("id", businessId);
      if (error) throw new Error(`business update failed: ${error.message}`);
    },
    async insertEvidence(auditId, rows) {
      if (!rows.length) return [];
      const { data, error } = await client
        .from("evidence")
        .insert(rows.map((r) => ({ audit_id: auditId, type: r.type, excerpt: r.excerpt.slice(0, 4000), source_url: r.source_url ?? null, storage_path: r.storage_path ?? null })))
        .select("id");
      if (error) throw new Error(`evidence insert failed: ${error.message}`);
      return (data ?? []).map((d) => d.id);
    },
    async insertFindings(auditId, rows) {
      if (!rows.length) return;
      const { error } = await client.from("findings").insert(rows.map((r) => ({ ...r, audit_id: auditId })));
      if (error) throw new Error(`findings insert failed: ${error.message}`);
    },
    async listFindings(auditId) {
      const { data, error } = await client.from("findings").select("category, severity").eq("audit_id", auditId);
      if (error) throw new Error(`findings read failed: ${error.message}`);
      return data ?? [];
    },
    async mergeScores(auditId, patch) {
      const { data: current } = await client.from("audits").select("scores").eq("id", auditId).single();
      const scores = (current?.scores && typeof current.scores === "object" && !Array.isArray(current.scores) ? current.scores : {}) as Record<string, Json | undefined>;
      const { error } = await client
        .from("audits")
        .update({ scores: { ...scores, ...patch } as Json })
        .eq("id", auditId);
      if (error) throw new Error(`audit scores update failed: ${error.message}`);
    },
  };
}

/** In-memory repo for tests. */
export class MemoryAuditRepo implements AuditRepo {
  evidence: (EvidenceRow & { id: string; audit_id: string })[] = [];
  findings: (FindingRow & { audit_id: string })[] = [];
  businessPatches: Partial<Business>[] = [];
  scores: Record<string, Json> = {};
  constructor(
    private audit: Audit,
    private business: Business,
  ) {}
  async load() {
    return { audit: { ...this.audit, scores: this.scores as Json }, business: this.business };
  }
  async updateBusiness(_id: string, patch: Partial<Business>) {
    this.businessPatches.push(patch);
    this.business = { ...this.business, ...patch };
  }
  async insertEvidence(auditId: string, rows: EvidenceRow[]) {
    return rows.map((r) => {
      const id = `ev-${this.evidence.length + 1}`;
      this.evidence.push({ ...r, id, audit_id: auditId });
      return id;
    });
  }
  async insertFindings(auditId: string, rows: FindingRow[]) {
    for (const r of rows) this.findings.push({ ...r, audit_id: auditId });
  }
  async listFindings() {
    return this.findings.map((f) => ({ category: f.category, severity: f.severity }));
  }
  async mergeScores(_auditId: string, patch: Record<string, Json>) {
    this.scores = { ...this.scores, ...patch };
  }
}
