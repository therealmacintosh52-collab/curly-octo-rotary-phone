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
  why: "Google and AI assistants treat a consistent phone number as proof that the listings are the same business; a mismatch costs ranking trust and sends some callers to the wrong number.",
});

export const addressMismatch = mismatchCheck("address", {
  id: "address_mismatch",
  severity: "high",
  impact: 75,
  title: "Your address is written differently across listings",
  why: "Address consistency across the website, Google and Yelp is one of the strongest local ranking signals; even suite-number or street-type differences count.",
});

export const nameMismatch = mismatchCheck("name", {
  id: "name_mismatch",
  severity: "medium",
  impact: 50,
  title: "Your business name differs across listings",
  why: "The name should be identical everywhere (no keyword add-ons, no old trading names) so search engines merge the listings into one entity.",
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
      plain_english: `We read the home page and the contact page and could not find a ${missing.join(" or ")} as text. Customers and search engines need both, in the footer of every page.`,
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
        plain_english: "Profiles with a website link get the 'Website' button and pass trust to the site. Yours has none.",
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
      plain_english: `Google lists ${id.gbpWebsiteHost} while your website resolves to ${id.canonicalDomain}. Search engines see two different businesses.`,
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
      plain_english: "The link or name you gave did not match a Google Maps listing with confidence. Either the profile is missing, suspended, or listed under a different name or address.",
      severity: "critical",
      impact_score: 95,
      fix_difficulty: "medium",
      evidence: [{ type: "api_field", excerpt: "Places API Text Search returned no confident match; see the resolution log on the audit." }],
    };
  },
});
