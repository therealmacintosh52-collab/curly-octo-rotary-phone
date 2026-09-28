import type { SnapshotStore } from "./snapshots";

/** process.env or a test stand-in. */
export type EnvLike = Record<string, string | undefined>;

export type ProviderName = "anthropic" | "google-places" | "pagespeed" | "dataforseo" | "yelp" | "social" | "website";

export type ProviderMode = "mock" | "record" | "live";

export type UnavailableReason =
  | "not_configured"
  | "no_fixture"
  | "timeout"
  | "network"
  | "rate_limited"
  | "http_error"
  | "parse_failed"
  | "refusal"
  | "truncated"
  | "not_implemented"
  | "blocked";

export interface CallMeta {
  provider: ProviderName;
  endpoint: string;
  /** Served from raw_snapshots or a fixture; no network, no cost. */
  cached: boolean;
  cost_usd: number;
  duration_ms: number;
  attempts: number;
  snapshot_id: string | null;
  mode: ProviderMode;
}

/**
 * The only way an adapter reports a missing data point. Callers branch on `ok`;
 * the scoring engine treats UNAVAILABLE as "not assessed", never as a value.
 */
export interface Unavailable {
  ok: false;
  kind: "UNAVAILABLE";
  reason: UnavailableReason;
  message: string;
  status?: number;
  retryable: boolean;
  meta: CallMeta;
}

export interface Available<T> {
  ok: true;
  data: T;
  meta: CallMeta;
}

export type ProviderResult<T> = Available<T> | Unavailable;

export interface CallContext {
  /** Links the snapshot (and its cost) to an audit. */
  auditId?: string;
  store: SnapshotStore;
  /** Overrides PROVIDER_MODE for this call (tests). */
  mode?: ProviderMode;
  /** Fixture name under __fixtures__/<provider>/; defaults to the endpoint. */
  fixture?: string;
  ttlSeconds?: number;
  now?: () => Date;
}

export interface ProviderStatus {
  name: ProviderName | "supabase" | "inngest";
  label: string;
  docsUrl: string;
  envKeys: { key: string; set: boolean }[];
  configured: boolean;
  mode: ProviderMode;
  /** Which phase turns the live call on; "0" means usable now. */
  phase: string;
}
