/**
 * Database types for supabase-js. Hand-written from supabase/migrations/*.sql;
 * keep in sync when a migration changes a table (or regenerate with
 * `supabase gen types typescript` once the CLI is in use and diff against this).
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type UserRole = "admin" | "client";
export type AuditStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";
export type EvidenceType = "screenshot" | "html" | "api_field" | "serp_result" | "llm_answer";
export type FindingSeverity = "critical" | "high" | "medium" | "low";
export type FixDifficulty = "easy" | "medium" | "hard";
export type FindingStatus = "open" | "in_progress" | "fixed" | "dismissed";
export type SocialNetwork = "facebook" | "instagram" | "tiktok" | "youtube" | "linkedin" | "x" | "nextdoor" | "pinterest" | "yelp" | "other";
export type MentionSource = "press" | "reddit" | "forum" | "directory" | "social" | "other";
export type MentionSentiment = "pos" | "neu" | "neg";
export type BacklinkSubject = "business" | "competitor";

// ---------------------------------------------------------------------------
// Row types
// ---------------------------------------------------------------------------
export type Profile = {
  id: string;
  role: UserRole;
  full_name: string | null;
  email: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type Business = {
  id: string;
  name: string;
  canonical_domain: string | null;
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  place_id: string | null;
  yelp_alias: string | null;
  primary_category: string | null;
  service_area: Json;
  avg_ticket: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type Audit = {
  id: string;
  business_id: string;
  status: AuditStatus;
  progress_pct: number;
  current_step: string | null;
  started_at: string | null;
  finished_at: string | null;
  total_cost_usd: number;
  inputs: Json;
  scores: Json;
  revenue_model: Json;
  version: number;
  created_at: string;
  updated_at: string;
}

export type RawSnapshot = {
  id: string;
  audit_id: string | null;
  provider: string;
  endpoint: string;
  cache_key: string | null;
  request: Json;
  response: Json | null;
  fetched_at: string;
  cost_usd: number;
  expires_at: string | null;
}

export type Evidence = {
  id: string;
  audit_id: string;
  type: EvidenceType;
  storage_path: string | null;
  excerpt: string | null;
  source_url: string | null;
  captured_at: string;
}

export type Finding = {
  id: string;
  audit_id: string;
  category: string;
  check_id: string;
  title: string;
  plain_english: string;
  severity: FindingSeverity;
  impact_score: number | null;
  fix_difficulty: FixDifficulty | null;
  est_monthly_loss_low: number | null;
  est_monthly_loss_mid: number | null;
  est_monthly_loss_high: number | null;
  evidence_ids: string[];
  status: FindingStatus;
  created_at: string;
  updated_at: string;
}

export type Solution = {
  id: string;
  finding_id: string;
  audit_id: string;
  steps: Json;
  assets: Json;
  code_snippets: Json;
  time_estimate_hrs: number | null;
  suggested_price: number | null;
  priority_rank: number | null;
  roadmap_phase: 30 | 60 | 90 | null;
  is_revealed: boolean;
  revealed_at: string | null;
  created_at: string;
  updated_at: string;
}

export type Competitor = {
  id: string;
  audit_id: string;
  place_id: string | null;
  name: string;
  rating: number | null;
  review_count: number | null;
  categories: string[];
  map_rank_avg: number | null;
  ai_mention_count: number | null;
  domain: string | null;
  metrics: Json;
  created_at: string;
}

export type AiVisibility = {
  id: string;
  audit_id: string;
  engine: string;
  prompt: string;
  location: string | null;
  business_mentioned: boolean | null;
  position: number | null;
  cited_urls: string[];
  competitors_mentioned: string[];
  answer_excerpt: string | null;
  evidence_id: string | null;
  captured_at: string;
}

export type RankGrid = {
  id: string;
  audit_id: string;
  keyword: string;
  grid_size: number;
  points: Json;
  avg_rank: number | null;
  share_of_top3: number | null;
  created_at: string;
}

export type ShareLink = {
  id: string;
  audit_id: string;
  token: string;
  expires_at: string | null;
  view_count: number;
  last_viewed_at: string | null;
  created_at: string;
}

export type ReportView = {
  id: string;
  share_link_id: string;
  viewed_at: string;
  section: string | null;
  duration_sec: number | null;
}

export type Citation = {
  id: string;
  audit_id: string;
  directory: string;
  listing_url: string | null;
  listed: boolean | null;
  nap_match: Json;
  evidence_id: string | null;
  created_at: string;
}

export type SocialProfile = {
  id: string;
  audit_id: string;
  network: SocialNetwork;
  url: string | null;
  exists: boolean | null;
  linked_from_site: boolean | null;
  last_activity_at: string | null;
  followers: number | null;
  evidence_id: string | null;
  created_at: string;
}

export type BacklinkMetrics = {
  id: string;
  audit_id: string;
  subject: BacklinkSubject;
  domain: string;
  backlinks: number | null;
  referring_domains: number | null;
  local_referring_domains: number | null;
  domain_rank: number | null;
  top_referrers: Json;
  evidence_id: string | null;
  created_at: string;
}

export type BrandMention = {
  id: string;
  audit_id: string;
  source_url: string;
  source_type: MentionSource;
  linked: boolean | null;
  excerpt: string | null;
  sentiment: MentionSentiment | null;
  captured_at: string;
  evidence_id: string | null;
}

export type AgencySettings = {
  id: string;
  name: string;
  logo_path: string | null;
  colors: Json;
  contact_cta: Json;
  report_domain: string | null;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Insert/Update derivation. Columns with database defaults are optional on
// insert; everything is optional on update.
// ---------------------------------------------------------------------------
type Insert<Row, Defaulted extends keyof Row> = Omit<Row, Defaulted> & Partial<Pick<Row, Defaulted>>;

type Table<Row, Defaulted extends keyof Row> = {
  Row: Row;
  Insert: Insert<Row, Defaulted>;
  Update: Partial<Row>;
  Relationships: [];
};

type Timestamps = "created_at" | "updated_at";

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile, "role" | "full_name" | "email" | "active" | Timestamps>;
      businesses: Table<
        Business,
        | "id"
        | "canonical_domain"
        | "phone"
        | "address"
        | "lat"
        | "lng"
        | "place_id"
        | "yelp_alias"
        | "primary_category"
        | "service_area"
        | "avg_ticket"
        | "created_by"
        | Timestamps
      >;
      audits: Table<
        Audit,
        | "id"
        | "status"
        | "progress_pct"
        | "current_step"
        | "started_at"
        | "finished_at"
        | "total_cost_usd"
        | "inputs"
        | "scores"
        | "revenue_model"
        | "version"
        | Timestamps
      >;
      raw_snapshots: Table<RawSnapshot, "id" | "audit_id" | "cache_key" | "request" | "response" | "fetched_at" | "cost_usd" | "expires_at">;
      evidence: Table<Evidence, "id" | "storage_path" | "excerpt" | "source_url" | "captured_at">;
      findings: Table<
        Finding,
        | "id"
        | "plain_english"
        | "impact_score"
        | "fix_difficulty"
        | "est_monthly_loss_low"
        | "est_monthly_loss_mid"
        | "est_monthly_loss_high"
        | "evidence_ids"
        | "status"
        | Timestamps
      >;
      solutions: Table<
        Solution,
        | "id"
        | "steps"
        | "assets"
        | "code_snippets"
        | "time_estimate_hrs"
        | "suggested_price"
        | "priority_rank"
        | "roadmap_phase"
        | "is_revealed"
        | "revealed_at"
        | Timestamps
      >;
      competitors: Table<
        Competitor,
        "id" | "place_id" | "rating" | "review_count" | "categories" | "map_rank_avg" | "ai_mention_count" | "domain" | "metrics" | "created_at"
      >;
      ai_visibility: Table<
        AiVisibility,
        "id" | "location" | "business_mentioned" | "position" | "cited_urls" | "competitors_mentioned" | "answer_excerpt" | "evidence_id" | "captured_at"
      >;
      rank_grid: Table<RankGrid, "id" | "points" | "avg_rank" | "share_of_top3" | "created_at">;
      share_links: Table<ShareLink, "id" | "token" | "expires_at" | "view_count" | "last_viewed_at" | "created_at">;
      report_views: Table<ReportView, "id" | "viewed_at" | "section" | "duration_sec">;
      citations: Table<Citation, "id" | "listing_url" | "listed" | "nap_match" | "evidence_id" | "created_at">;
      social_profiles: Table<SocialProfile, "id" | "url" | "exists" | "linked_from_site" | "last_activity_at" | "followers" | "evidence_id" | "created_at">;
      backlink_metrics: Table<
        BacklinkMetrics,
        "id" | "subject" | "backlinks" | "referring_domains" | "local_referring_domains" | "domain_rank" | "top_referrers" | "evidence_id" | "created_at"
      >;
      brand_mentions: Table<BrandMention, "id" | "source_type" | "linked" | "excerpt" | "sentiment" | "captured_at" | "evidence_id">;
      agency_settings: Table<AgencySettings, "id" | "name" | "logo_path" | "colors" | "contact_cta" | "report_domain" | "updated_at">;
    };
    Views: Record<string, never>;
    Functions: {
      is_admin: { Args: Record<string, never>; Returns: boolean };
      is_member: { Args: Record<string, never>; Returns: boolean };
      current_user_role: { Args: Record<string, never>; Returns: UserRole | null };
      share_link_id_for_token: { Args: { p_token: string }; Returns: string | null };
      get_client_report: { Args: { p_token: string }; Returns: Json | null };
      record_report_view: { Args: { p_token: string; p_section: string; p_duration_sec: number }; Returns: undefined };
      reveal_solution: { Args: { p_solution_id: string; p_revealed: boolean }; Returns: Solution };
      reveal_audit_solutions: { Args: { p_audit_id: string; p_revealed: boolean; p_category?: string | null }; Returns: number };
      audit_cost_usd: { Args: { p_audit_id: string }; Returns: number };
    };
    Enums: {
      user_role: UserRole;
      audit_status: AuditStatus;
      evidence_type: EvidenceType;
      finding_severity: FindingSeverity;
      fix_difficulty: FixDifficulty;
      finding_status: FindingStatus;
      social_network: SocialNetwork;
      mention_source: MentionSource;
      mention_sentiment: MentionSentiment;
      backlink_subject: BacklinkSubject;
    };
    CompositeTypes: Record<string, never>;
  };
}
