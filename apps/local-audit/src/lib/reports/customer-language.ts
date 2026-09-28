import type { CheckCategory } from "@/lib/checks/registry";
import type { FindingSeverity } from "@/lib/db/types";

/**
 * Everything a business owner reads must be free of trade jargon. This list
 * is enforced by a test over every check's headline and every finding text
 * the fixture sites produce; technical detail belongs in evidence excerpts.
 */
export const JARGON = [
  /\bLCP\b/, /\bINP\b/, /\bCLS\b/, /\bTTFB\b/, /\bTBT\b/, /\bCrUX\b/, /\bLighthouse\b/, /\bPageSpeed\b/,
  /\bH[1-6]\b/, /\bmeta\b/i, /\bcanonical\b/i, /\bJSON(-LD)?\b/, /\bschema\b/i, /\bnoindex\b/i, /\brobots\.txt\b/i, /\bsitemap\b/i,
  /\balt\b/i, /\bsrcset\b/, /\bWebP\b/, /\bAVIF\b/, /\bJPEG\b/, /\bPNG\b/, /\bviewport\b/i, /\bhreflang\b/, /\bllms\.txt\b/, /\bsameAs\b/,
  /\baggregateRating\b/, /\bHTML\b/, /\bHTTPS?\b/, /\bCSS\b/, /\bJavaScript\b/, /\bSEO\b/, /\bCTA\b/, /\bNAP\b/, /\bURL\b/, /\b404\b/,
  /\bcrawl(ed|er|ing)?\b/i, /\bindex(ed|ing)?\b/i, /\biframe\b/i, /\btel:/, /\bredirect/i, /\bstructured data\b/i, /\brich result/i,
  /\bDOM\b/, /\bAPI\b/, /\bbreadcrumb/i, /\bFAQPage\b/, /\bLocalBusiness\b/, /\bOrganization\b/, /\bopeningHours/i, /\bmarkup\b/i, /\bbot\b/i,
];

export function findJargon(text: string): string[] {
  return JARGON.filter((re) => re.test(text)).map((re) => re.source);
}

/** Severity words a customer understands. */
export const SEVERITY_WORD: Record<FindingSeverity, string> = { critical: "Urgent", high: "Important", medium: "Worth fixing", low: "Minor" };

/** The three questions the customer report is organised around. */
export const REPORT_SECTIONS: { key: "found" | "convert" | "reputation"; title: string; blurb: string; categories: CheckCategory[] }[] = [
  {
    key: "found",
    title: "Can customers find you?",
    blurb: "How you show up on Google, Google Maps and AI assistants such as ChatGPT when someone nearby looks for what you do.",
    categories: ["identity_nap", "technical_seo", "local_onsite", "schema", "aeo", "content_keywords", "rankings", "ai_visibility", "citations", "backlinks_authority"],
  },
  {
    key: "convert",
    title: "Do visitors call you?",
    blurb: "What happens once someone lands on your website, especially on a phone.",
    categories: ["conversion", "images"],
  },
  {
    key: "reputation",
    title: "What do people see about you elsewhere?",
    blurb: "Your Google and Yelp listings, reviews, social profiles and mentions around the web.",
    categories: ["gbp", "yelp", "social", "brand_mentions"],
  },
];

export type SectionStatus = "urgent" | "attention" | "good" | "not_checked";
export const SECTION_STATUS_COPY: Record<SectionStatus, string> = { urgent: "Losing customers", attention: "Needs attention", good: "Looking good", not_checked: "Not checked yet" };

export function sectionStatus(findings: { severity: FindingSeverity }[], assessedAny: boolean): SectionStatus {
  if (findings.some((f) => f.severity === "critical" || f.severity === "high")) return "urgent";
  if (findings.length) return "attention";
  return assessedAny ? "good" : "not_checked";
}

export function scoreWord(score: number | null | undefined): string {
  if (score == null) return "Not scored yet";
  return score >= 80 ? "Strong" : score >= 50 ? "Needs work" : "Losing customers";
}
