import type { EvidenceType, FindingSeverity, FixDifficulty } from "@/lib/db/types";
import type { Place } from "@/lib/providers/google-places/client";
import type { PagespeedSummary } from "@/lib/providers/pagespeed/client";
import type { SiteCrawl } from "@/lib/crawl/crawler";
import type { PageFetch } from "@/lib/providers/website/client";
import type { YelpBusiness } from "@/lib/providers/yelp/client";
import type { NapComparison } from "@/lib/resolve/nap";

/**
 * Finding categories, one per module of the master plan. Every check and
 * every finding carries exactly one; the client report groups by it and the
 * scoring config weights it.
 */
export const CHECK_CATEGORIES = [
  "identity_nap",
  "technical_seo",
  "local_onsite",
  "schema",
  "aeo",
  "images",
  "conversion",
  "content_keywords",
  "gbp",
  "yelp",
  "citations",
  "rankings",
  "ai_visibility",
  "backlinks_authority",
  "social",
  "brand_mentions",
] as const;
export type CheckCategory = (typeof CHECK_CATEGORIES)[number];

/** Categories the website crawl step assesses (Phase 2). */
export const WEBSITE_CATEGORIES: CheckCategory[] = ["technical_seo", "local_onsite", "schema", "aeo", "images", "conversion", "content_keywords"];

export const CATEGORY_LABELS: Record<CheckCategory, string> = {
  identity_nap: "Name, address & phone consistency",
  technical_seo: "Website technical health",
  local_onsite: "Local signals on the website",
  schema: "Structured data",
  aeo: "AI search readiness",
  images: "Images",
  conversion: "Conversion & calls",
  content_keywords: "Content & keywords",
  gbp: "Google Business Profile",
  yelp: "Yelp",
  citations: "Listings across the web",
  rankings: "Local rankings",
  ai_visibility: "AI answer engines",
  backlinks_authority: "Backlinks & authority",
  social: "Social media",
  brand_mentions: "Brand mentions & press",
};

/**
 * Everything a check may look at. Each module is optional: an absent module
 * means "not collected", and a check that needs it must return `unavailable`,
 * never a guess. Later phases add fields; existing checks keep working.
 */
export interface CheckContext {
  audit: { id: string };
  business: { name: string; canonicalDomain: string | null; phone: string | null; address: string | null };
  website?: { pages: PageFetch[]; crawl?: SiteCrawl };
  pagespeed?: { mobile?: PagespeedSummary; desktop?: PagespeedSummary };
  /** Services the admin listed, used to look for dedicated pages. */
  services?: string[];
  /** City/region the business serves (from the resolved address or the admin). */
  city?: string | null;
  places?: { business?: Place; competitors?: Place[] };
  yelp?: { business?: YelpBusiness };
  /** Output of the Phase 1 resolver: cross-source NAP comparison and what was found. */
  identity?: {
    comparison: NapComparison;
    gbpInputGiven: boolean;
    gbpFound: boolean;
    gbpWebsiteHost: string | null;
    canonicalDomain: string | null;
    websiteFetched: boolean;
    websitePhones: string[];
    websiteAddresses: string[];
  };
  /** Free-form module outputs until their types firm up (rankings, AI visibility, citations, backlinks, social, mentions). */
  modules?: Partial<Record<Exclude<CheckCategory, "identity_nap" | "technical_seo" | "conversion">, unknown>>;
}

export interface EvidenceInput {
  type: EvidenceType;
  excerpt: string;
  source_url?: string;
}

export type CheckOutcome =
  | { status: "pass" }
  | {
      status: "finding";
      title: string;
      plain_english: string;
      severity: FindingSeverity;
      /** 0–100, how much this one problem matters relative to others in its category. */
      impact_score: number;
      fix_difficulty: FixDifficulty;
      evidence: EvidenceInput[];
    }
  | { status: "unavailable"; reason: string };

export interface Check {
  /** Stable id, e.g. "conversion.phone_click_to_call". Findings reference it. */
  id: string;
  category: CheckCategory;
  title: string;
  description: string;
  /** The finding headline in customer language, when the check declares one. */
  problem?: string;
  run(ctx: CheckContext): CheckOutcome | Promise<CheckOutcome>;
}

const registry = new Map<string, Check>();

export function registerCheck(check: Check): Check {
  // Hot reload re-evaluates a check file without clearing this map; only a real build catches duplicates.
  if (registry.has(check.id) && process.env.NODE_ENV !== "development") throw new Error(`Duplicate check id: ${check.id}`);
  if (!check.id.startsWith(`${check.category}.`)) throw new Error(`Check id "${check.id}" must be prefixed with its category "${check.category}."`);
  registry.set(check.id, check);
  return check;
}

export function listChecks(category?: CheckCategory): Check[] {
  const all = [...registry.values()];
  return category ? all.filter((c) => c.category === category) : all;
}

export function getCheck(id: string): Check | undefined {
  return registry.get(id);
}

/** Test helper. */
export function resetChecks() {
  registry.clear();
}
