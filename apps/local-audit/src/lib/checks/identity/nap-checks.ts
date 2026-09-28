import { formatPhone, type FieldAgreement } from "@/lib/resolve/nap";
import { registerCheck, type Check, type CheckContext, type CheckOutcome, type EvidenceInput } from "../registry";

const SOURCE_LABEL: Record<string, string> = { website: "your website", gbp: "your Google Business Profile", yelp: "Yelp" };

function valuesEvidence(field: FieldAgreement): EvidenceInput[] {
  return field.values.map((v) => ({
    type: v.source === "website" ? "html" : "api_field",
    excerpt: `${SOURCE_LABEL[v.source] ?? v.source}: ${field.field === "phone" ? formatPhone(v.normalized) : v.raw}`,
    source_url: v.ref,
  }));
}

function needIdentity(ctx: CheckContext): CheckOutcome | null {
  return ctx.identity ? null : { status: "unavailable", reason: "identity resolution did not run" };
}

function mismatchCheck(field: "phone" | "address" | "name", opts: { id: string; severity: "high" | "medium"; impact: number; title: string; why: string }): Check {
  return registerCheck({
    id: `identity_nap.${opts.id}`,
    category: "identity_nap",
    title: opts.title,
    description: opts.why,
    run(ctx) {
      const gate = needIdentity(ctx);
      if (gate) return gate;
      const agreement = ctx.identity!.comparison[field];
      if (agreement.status === "insufficient") return { status: "unavailable", reason: `fewer than two sources reported a ${field}` };
      if (agreement.status === "match") return { status: "pass" };
      const sources = agreement.values.map((v) => SOURCE_LABEL[v.source] ?? v.source).join(", ");
      return {
        status: "finding",
        title: opts.title,
        plain_english: `${opts.why} Right now ${sources} do not agree.`,
        severity: opts.severity,
        impact_score: opts.impact,
        fix_difficulty: "easy",
        evidence: valuesEvidence(agreement),
      };
    },
  });
}

export const phoneMismatch = mismatchCheck("phone", {
  id: "phone_mismatch",
  severity: "high",
  impact: 80,
  title: "Different phone numbers across your listings",
  why: "Your phone number is written differently on your website and your listings. Google trusts a business less when its number changes from place to place, and some callers end up dialling the wrong one.",
});

export const addressMismatch = mismatchCheck("address", {
  id: "address_mismatch",
  severity: "high",
  impact: 75,
  title: "Your address is written differently across listings",
  why: "Your address is written differently across your website, Google and Yelp. Google uses a matching address to decide these are one business; even a missing suite number or \"St\" versus \"Street\" counts against you.",
});

export const nameMismatch = mismatchCheck("name", {
  id: "name_mismatch",
  severity: "medium",
  impact: 50,
  title: "Your business name differs across listings",
  why: "Your business name is not the same everywhere. Google may treat the versions as different businesses and split your reviews and rankings between them.",
});

export const websiteMissingNap: Check = registerCheck({
  id: "identity_nap.website_missing_nap",
  category: "identity_nap",
  title: "Website shows phone and address",
  description: "The home or contact page should carry the full name, address and phone number as text, so search engines and customers can read it.",
  run(ctx) {
    const gate = needIdentity(ctx);
    if (gate) return gate;
    const id = ctx.identity!;
    if (!id.websiteFetched) return { status: "unavailable", reason: "website was not fetched" };
    const missing = [id.websitePhones.length === 0 ? "phone number" : null, id.websiteAddresses.length === 0 ? "street address" : null].filter(Boolean) as string[];
    if (!missing.length) return { status: "pass" };
    return {
      status: "finding",
      title: `Your website does not show a ${missing.join(" or ")}`,
      plain_english: `We read your home page and contact page and could not find a ${missing.join(" or ")} written as text. Customers look for it, and Google uses it to confirm you are a real local business.`,
      severity: "medium",
      impact_score: 55,
      fix_difficulty: "easy",
      evidence: [{ type: "html", excerpt: `Phones found: ${id.websitePhones.join(", ") || "none"}; addresses found: ${id.websiteAddresses.join(" | ") || "none"}` }],
    };
  },
});

export const gbpWebsiteMismatch: Check = registerCheck({
  id: "identity_nap.gbp_website_mismatch",
  category: "identity_nap",
  title: "Google Business Profile links to your website",
  description: "The website on the Google profile should be the canonical domain of the business, not a social page, an old domain or a builder subdomain.",
  run(ctx) {
    const gate = needIdentity(ctx);
    if (gate) return gate;
    const id = ctx.identity!;
    if (!id.gbpFound) return { status: "unavailable", reason: "no Google Business Profile match" };
    if (!id.canonicalDomain) return { status: "unavailable", reason: "no website to compare with" };
    if (!id.gbpWebsiteHost) {
      return {
        status: "finding",
        title: "Your Google Business Profile has no website link",
        plain_english: "Your Google listing has no website link, so the 'Website' button is missing and people who find you on Google cannot get to your site.",
        severity: "medium",
        impact_score: 60,
        fix_difficulty: "easy",
        evidence: [{ type: "api_field", excerpt: "Places API: websiteUri is empty" }],
      };
    }
    if (id.gbpWebsiteHost === id.canonicalDomain) return { status: "pass" };
    return {
      status: "finding",
      title: "Your Google profile points to a different website",
      plain_english: `Your Google listing sends people to ${id.gbpWebsiteHost}, but your website is ${id.canonicalDomain}. Customers land somewhere else, and Google sees two different businesses.`,
      severity: "medium",
      impact_score: 60,
      fix_difficulty: "easy",
      evidence: [{ type: "api_field", excerpt: `Places API websiteUri host: ${id.gbpWebsiteHost}; canonical domain: ${id.canonicalDomain}` }],
    };
  },
});

export const gbpNotFound: Check = registerCheck({
  id: "identity_nap.gbp_not_found",
  category: "identity_nap",
  title: "Google Business Profile can be found",
  description: "If the business cannot be matched on Google Maps from its own link or name, customers cannot find it either.",
  run(ctx) {
    const gate = needIdentity(ctx);
    if (gate) return gate;
    const id = ctx.identity!;
    if (!id.gbpInputGiven) return { status: "unavailable", reason: "no Google Business Profile input was given" };
    if (id.gbpFound) return { status: "pass" };
    return {
      status: "finding",
      title: "We could not confirm your Google Business Profile",
      plain_english: "We could not find a Google Maps listing that clearly matches your business. Either it does not exist, it has been suspended, or it is listed under a different name or address. Until this is sorted out, people searching on Google and Maps cannot find you.",
      severity: "critical",
      impact_score: 95,
      fix_difficulty: "medium",
      evidence: [{ type: "api_field", excerpt: "Places API Text Search returned no confident match; see the resolution log on the audit." }],
    };
  },
});
