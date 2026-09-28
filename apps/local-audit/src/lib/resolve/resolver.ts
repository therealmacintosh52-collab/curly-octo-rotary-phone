import type { CallContext, ProviderResult, Unavailable } from "@/lib/providers/core";
import type { Providers } from "@/lib/providers";
import type { Place } from "@/lib/providers/google-places/client";
import type { Canonical, PageFetch } from "@/lib/providers/website/client";
import { yelpAddress, type YelpBusiness } from "@/lib/providers/yelp/client";
import type { EvidenceInput } from "@/lib/checks/registry";
import { bareHost, type ParsedInputs } from "./inputs";
import { parseMapsUrl, type MapsUrlInfo } from "./maps-url";
import { compareNap, extractNapFromHtml, normalizeName, normalizePhone, type HtmlNap, type NapComparison, type NapRecord } from "./nap";

/** One source's outcome. UNAVAILABLE keeps the provider's reason so the report can say why. */
export type SourceOutcome<T> = { status: "ok"; data: T; costUsd: number } | { status: "unavailable"; reason: string; message: string; costUsd: number };

export interface WebsiteSource {
  canonical: Canonical;
  pages: PageFetch[];
  nap: HtmlNap;
  name: string | null;
  phone: string | null;
  address: string | null;
}

export interface GbpSource {
  place: Place;
  /** How the match was made; the admin sees this. */
  matched_by: "place_id" | "search";
  confidence: number;
  candidates: number;
  parsed: MapsUrlInfo | null;
}

export interface ResolvedEntity {
  name: string | null;
  canonical_domain: string | null;
  canonical_url: string | null;
  phone: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  place_id: string | null;
  yelp_alias: string | null;
  primary_category: string | null;
  gbp_website_host: string | null;
  sources: { website: SourceOutcome<WebsiteSource> | null; gbp: SourceOutcome<GbpSource> | null; yelp: SourceOutcome<YelpBusiness> | null };
  nap: NapComparison;
  nap_records: NapRecord[];
  evidence: (EvidenceInput & { source: "website" | "gbp" | "yelp" | "resolver" })[];
  unavailable: { source: string; reason: string; message: string }[];
  cost_usd: number;
}

export interface ResolveDeps {
  providers: Providers;
  ctx: CallContext;
}

function unavailableOf<T>(u: Unavailable): SourceOutcome<T> {
  return { status: "unavailable", reason: u.reason, message: u.message, costUsd: u.meta.cost_usd };
}

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function hostOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return bareHost(new URL(url).hostname);
  } catch {
    return null;
  }
}

function contactLink(html: string, base: string): string | null {
  const m = html.match(/<a\b[^>]*href\s*=\s*["']([^"']*contact[^"']*)["']/i);
  if (!m) return null;
  try {
    const u = new URL(m[1]!, base);
    return u.origin === new URL(base).origin ? u.toString() : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Website
// ---------------------------------------------------------------------------
async function resolveWebsite(url: string, deps: ResolveDeps): Promise<SourceOutcome<WebsiteSource>> {
  const { website } = deps.providers;
  let cost = 0;
  const canon = await website.resolveCanonical({ url }, deps.ctx);
  cost += canon.meta.cost_usd;
  if (!canon.ok) return { ...unavailableOf<WebsiteSource>(canon), costUsd: cost };

  const home = await website.fetchPage({ url: canon.data.canonical_url }, deps.ctx);
  cost += home.meta.cost_usd;
  if (!home.ok) return { ...unavailableOf<WebsiteSource>(home), costUsd: cost };

  const pages: PageFetch[] = [home.data];
  const contact = contactLink(home.data.html, home.data.final_url);
  if (contact && contact !== home.data.final_url) {
    const c = await website.fetchPage({ url: contact }, deps.ctx);
    cost += c.meta.cost_usd;
    if (c.ok) pages.push(c.data);
  }

  const naps = pages.map((p) => extractNapFromHtml(p.html));
  const merged: HtmlNap = {
    phones: [...new Set(naps.flatMap((n) => n.phones))],
    addresses: [...new Set(naps.flatMap((n) => n.addresses))],
    names: [...new Set(naps.flatMap((n) => n.names))],
    jsonLd: naps.flatMap((n) => n.jsonLd),
    telLinks: [...new Set(naps.flatMap((n) => n.telLinks))],
  };
  const phone = merged.telLinks.map(normalizePhone).find((p): p is string => !!p) ?? merged.phones[0] ?? null;
  return {
    status: "ok",
    costUsd: cost,
    data: { canonical: canon.data, pages, nap: merged, name: merged.names[0] ?? null, phone, address: merged.addresses[0] ?? null },
  };
}

// ---------------------------------------------------------------------------
// Google Business Profile
// ---------------------------------------------------------------------------
interface GbpHints {
  parsed: MapsUrlInfo | null;
  query: string | null;
  bias: { latitude: number; longitude: number; radiusMeters: number } | null;
  websiteHost: string | null;
  websitePhone: string | null;
  websiteName: string | null;
}

export function scoreCandidate(place: Place, hints: GbpHints): number {
  let score = 0;
  const name = normalizeName(place.displayName?.text);
  const wanted = normalizeName(hints.parsed?.name ?? hints.query ?? hints.websiteName ?? "");
  if (name && wanted) {
    if (name === wanted) score += 3;
    else if (name.includes(wanted) || wanted.includes(name)) score += 2;
  }
  if (hints.parsed?.lat !== undefined && hints.parsed?.lng !== undefined && place.location) {
    const d = haversineMeters({ lat: hints.parsed.lat, lng: hints.parsed.lng }, { lat: place.location.latitude, lng: place.location.longitude });
    if (d < 150) score += 3;
    else if (d < 1000) score += 1;
  }
  if (hints.websiteHost && hostOf(place.websiteUri) === hints.websiteHost) score += 3;
  if (hints.websitePhone && normalizePhone(place.nationalPhoneNumber ?? place.internationalPhoneNumber) === hints.websitePhone) score += 2;
  if (hints.parsed?.placeId && place.id === hints.parsed.placeId) score += 10;
  return score;
}

async function resolveGbp(inputs: ParsedInputs, web: SourceOutcome<WebsiteSource> | null, deps: ResolveDeps): Promise<SourceOutcome<GbpSource> | null> {
  const { googlePlaces, website } = deps.providers;
  let cost = 0;
  let parsed: MapsUrlInfo | null = null;
  let query: string | null = null;

  if (inputs.gbp?.kind === "short_link") {
    const expanded = await website.expandShortLink({ url: inputs.gbp.url }, deps.ctx);
    cost += expanded.meta.cost_usd;
    if (!expanded.ok) return { ...unavailableOf<GbpSource>(expanded), costUsd: cost };
    try {
      parsed = parseMapsUrl(new URL(expanded.data.canonical_url));
    } catch {
      parsed = null;
    }
    if (!parsed) return { status: "unavailable", reason: "parse_failed", message: `Short link expanded to ${expanded.data.canonical_url}, which is not a Maps place URL`, costUsd: cost };
  } else if (inputs.gbp?.kind === "maps_url") {
    parsed = inputs.gbp.parsed;
  } else if (inputs.gbp?.kind === "text") {
    query = inputs.gbp.query;
  }

  const webData = web?.status === "ok" ? web.data : null;
  const hints: GbpHints = {
    parsed,
    query,
    bias: parsed?.lat !== undefined && parsed?.lng !== undefined ? { latitude: parsed.lat, longitude: parsed.lng, radiusMeters: 2_000 } : null,
    websiteHost: webData?.canonical.canonical_domain ?? inputs.website?.host ?? null,
    websitePhone: webData?.phone ?? null,
    websiteName: webData?.name ?? null,
  };

  // Direct lookup when the link carried a place id.
  if (parsed?.placeId) {
    const place = await googlePlaces.getPlace({ placeId: parsed.placeId }, deps.ctx);
    cost += place.meta.cost_usd;
    if (place.ok) return { status: "ok", costUsd: cost, data: { place: place.data, matched_by: "place_id", confidence: 10, candidates: 1, parsed } };
    if (place.reason !== "http_error") return { ...unavailableOf<GbpSource>(place), costUsd: cost };
    // A stale place id falls through to search.
  }

  const textQuery = parsed?.name ?? parsed?.query ?? query ?? hints.websiteName ?? null;
  if (!textQuery) {
    if (!inputs.gbp && !webData) return null; // nothing to search with and nothing asked for
    return { status: "unavailable", reason: "parse_failed", message: "No business name to search Google with (no Maps link name, no text, no website name)", costUsd: cost };
  }

  const q = hints.bias || /\b[A-Z]{2}\b|\d{5}/.test(textQuery) ? textQuery : [textQuery, webData?.address ?? inputs.serviceArea ?? ""].filter(Boolean).join(" ");
  const search = await googlePlaces.searchText({ textQuery: q, ...(hints.bias ? { locationBias: hints.bias } : {}), maxResultCount: 5 }, deps.ctx);
  cost += search.meta.cost_usd;
  if (!search.ok) return { ...unavailableOf<GbpSource>(search), costUsd: cost };

  const ranked = search.data.places.map((place) => ({ place, score: scoreCandidate(place, hints) })).sort((a, b) => b.score - a.score);
  const best = ranked[0];
  // Threshold: a name hit alone (3) is enough only when nothing contradicts it;
  // with a website or coordinates on file we want a second signal.
  const needed = hints.websiteHost || hints.bias ? 4 : 3;
  if (!best || best.score < needed) {
    return {
      status: "unavailable",
      reason: "no_confident_match",
      message: best
        ? `Best Google match "${best.place.displayName?.text ?? best.place.id}" scored ${best.score} (< ${needed}); not trusted`
        : `Google returned no places for "${q}"`,
      costUsd: cost,
    };
  }
  return { status: "ok", costUsd: cost, data: { place: best.place, matched_by: "search", confidence: best.score, candidates: ranked.length, parsed } };
}

// ---------------------------------------------------------------------------
// Yelp
// ---------------------------------------------------------------------------
async function resolveYelp(alias: string, deps: ResolveDeps): Promise<SourceOutcome<YelpBusiness>> {
  const res: ProviderResult<YelpBusiness> = await deps.providers.yelp.getBusiness({ idOrAlias: alias }, deps.ctx);
  if (!res.ok) return unavailableOf<YelpBusiness>(res);
  return { status: "ok", data: res.data, costUsd: res.meta.cost_usd };
}

// ---------------------------------------------------------------------------
// Orchestration
// ---------------------------------------------------------------------------
export async function resolveBusiness(inputs: ParsedInputs, deps: ResolveDeps): Promise<ResolvedEntity> {
  const website = inputs.website ? await resolveWebsite(inputs.website.url, deps) : null;
  const gbp = await resolveGbp(inputs, website, deps);
  const yelp = inputs.yelp ? await resolveYelp(inputs.yelp.alias, deps) : null;

  const web = website?.status === "ok" ? website.data : null;
  const place = gbp?.status === "ok" ? gbp.data.place : null;
  const yb = yelp?.status === "ok" ? yelp.data : null;

  const records: NapRecord[] = [];
  const evidence: ResolvedEntity["evidence"] = [];
  const unavailable: ResolvedEntity["unavailable"] = [];

  if (web) {
    records.push({ source: "website", name: web.name, phone: web.phone, address: web.address, ref: web.pages[0]!.final_url });
    evidence.push({
      source: "website",
      type: "html",
      source_url: web.pages[0]!.final_url,
      excerpt: JSON.stringify({ source: "website", name: web.name, phone: web.phone, address: web.address, phones: web.nap.phones, addresses: web.nap.addresses, pages: web.pages.map((p) => p.final_url), https: web.canonical.https, redirect_chain: web.canonical.redirect_chain }),
    });
  } else if (website?.status === "unavailable") unavailable.push({ source: "website", reason: website.reason, message: website.message });

  if (place) {
    records.push({ source: "gbp", name: place.displayName?.text, phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber, address: place.formattedAddress, ref: place.googleMapsUri ?? `places/${place.id}` });
    evidence.push({
      source: "gbp",
      type: "api_field",
      source_url: place.googleMapsUri,
      excerpt: JSON.stringify({
        source: "gbp",
        place_id: place.id,
        name: place.displayName?.text ?? null,
        phone: place.nationalPhoneNumber ?? place.internationalPhoneNumber ?? null,
        address: place.formattedAddress ?? null,
        website: place.websiteUri ?? null,
        rating: place.rating ?? null,
        review_count: place.userRatingCount ?? null,
        primary_type: place.primaryType ?? null,
        business_status: place.businessStatus ?? null,
        matched_by: gbp!.status === "ok" ? gbp!.data.matched_by : null,
        confidence: gbp!.status === "ok" ? gbp!.data.confidence : null,
      }),
    });
  } else if (gbp?.status === "unavailable") unavailable.push({ source: "gbp", reason: gbp.reason, message: gbp.message });

  if (yb) {
    records.push({ source: "yelp", name: yb.name, phone: yb.phone ?? yb.display_phone, address: yelpAddress(yb), ref: yb.url ?? `yelp/${yb.alias ?? yb.id}` });
    evidence.push({
      source: "yelp",
      type: "api_field",
      source_url: yb.url,
      excerpt: JSON.stringify({ source: "yelp", alias: yb.alias ?? null, name: yb.name, phone: yb.phone ?? yb.display_phone ?? null, address: yelpAddress(yb), rating: yb.rating ?? null, review_count: yb.review_count ?? null, is_claimed: yb.is_claimed ?? null, categories: yb.categories?.map((c) => c.title) ?? [] }),
    });
  } else if (yelp?.status === "unavailable") unavailable.push({ source: "yelp", reason: yelp.reason, message: yelp.message });

  const nap = compareNap(records);

  const canonicalDomain = web?.canonical.canonical_domain ?? inputs.website?.host ?? hostOf(place?.websiteUri) ?? null;
  const entity: ResolvedEntity = {
    name: place?.displayName?.text ?? yb?.name ?? web?.name ?? (inputs.gbp?.kind === "text" ? inputs.gbp.query : null),
    canonical_domain: canonicalDomain,
    canonical_url: web?.canonical.canonical_url ?? null,
    phone: normalizePhone(place?.nationalPhoneNumber ?? place?.internationalPhoneNumber) ?? normalizePhone(yb?.phone ?? yb?.display_phone) ?? web?.phone ?? null,
    address: place?.formattedAddress ?? (yb ? yelpAddress(yb) : null) ?? web?.address ?? null,
    lat: place?.location?.latitude ?? yb?.coordinates?.latitude ?? null,
    lng: place?.location?.longitude ?? yb?.coordinates?.longitude ?? null,
    place_id: place?.id ?? null,
    yelp_alias: yb?.alias ?? inputs.yelp?.alias ?? null,
    primary_category: place?.primaryTypeDisplayName?.text ?? place?.primaryType ?? yb?.categories?.[0]?.title ?? null,
    gbp_website_host: hostOf(place?.websiteUri),
    sources: { website, gbp, yelp },
    nap,
    nap_records: records,
    evidence,
    unavailable,
    cost_usd: Math.round(((website?.costUsd ?? 0) + (gbp?.costUsd ?? 0) + (yelp?.costUsd ?? 0)) * 1e6) / 1e6,
  };
  return entity;
}

/** The slice of a resolution that is safe to serialize into a job step result or a log line. */
export function summarizeResolution(r: ResolvedEntity) {
  return {
    name: r.name,
    canonical_domain: r.canonical_domain,
    phone: r.phone,
    address: r.address,
    place_id: r.place_id,
    yelp_alias: r.yelp_alias,
    sources: {
      website: r.sources.website?.status ?? "not_given",
      gbp: r.sources.gbp?.status ?? "not_given",
      yelp: r.sources.yelp?.status ?? "not_given",
    },
    nap: { name: r.nap.name.status, phone: r.nap.phone.status, address: r.nap.address.status },
    unavailable: r.unavailable,
    cost_usd: r.cost_usd,
  };
}
