import type { SocialNetwork } from "@/lib/db/types";
import { isMapsShortLink, parseMapsUrl, type MapsUrlInfo } from "./maps-url";

/** What the admin pastes into /admin/audits/new. Every field optional. */
export interface RawInputs {
  website?: string | null;
  gbp?: string | null;
  yelp?: string | null;
  extraUrls?: string[] | string | null;
  serviceArea?: string | null;
  services?: string[] | string | null;
  avgTicket?: number | string | null;
}

export type GbpInput =
  | { kind: "short_link"; url: string }
  | { kind: "maps_url"; url: string; parsed: MapsUrlInfo }
  | { kind: "text"; query: string };

export type UrlKind = "website" | "maps" | "yelp" | "social" | "directory" | "unknown";

export interface ClassifiedUrl {
  url: string;
  kind: UrlKind;
  network?: SocialNetwork;
  directory?: string;
}

export interface ParsedInputs {
  website: { url: string; host: string } | null;
  gbp: GbpInput | null;
  yelp: { url: string; alias: string } | null;
  extras: ClassifiedUrl[];
  serviceArea: string | null;
  services: string[];
  avgTicket: number | null;
  /** Inputs that could not be understood; shown to the admin, never silently dropped. */
  problems: string[];
}

const SOCIAL_HOSTS: [RegExp, SocialNetwork][] = [
  [/(^|\.)facebook\.com$|(^|\.)fb\.com$/, "facebook"],
  [/(^|\.)instagram\.com$/, "instagram"],
  [/(^|\.)tiktok\.com$/, "tiktok"],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, "youtube"],
  [/(^|\.)linkedin\.com$/, "linkedin"],
  [/(^|\.)x\.com$|(^|\.)twitter\.com$/, "x"],
  [/(^|\.)nextdoor\.com$/, "nextdoor"],
  [/(^|\.)pinterest\.com$/, "pinterest"],
];

const DIRECTORY_HOSTS: [RegExp, string][] = [
  [/(^|\.)bbb\.org$/, "bbb"],
  [/(^|\.)angi\.com$|(^|\.)angieslist\.com$/, "angi"],
  [/(^|\.)homeadvisor\.com$/, "homeadvisor"],
  [/(^|\.)thumbtack\.com$/, "thumbtack"],
  [/(^|\.)yellowpages\.com$/, "yellowpages"],
  [/(^|\.)apple\.com$/, "apple_maps"],
  [/(^|\.)bing\.com$/, "bing_places"],
  [/(^|\.)mapquest\.com$/, "mapquest"],
  [/(^|\.)foursquare\.com$/, "foursquare"],
  [/(^|\.)houzz\.com$/, "houzz"],
  [/(^|\.)porch\.com$/, "porch"],
];

/** Accepts bare domains, adds https://, rejects anything that is not a plausible http(s) URL. */
export function normalizeUrl(input: string | null | undefined): URL | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname) && url.hostname !== "localhost") return null;
  url.hash = "";
  return url;
}

export function bareHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

export function yelpAlias(url: URL): string | null {
  if (!/(^|\.)yelp\.[a-z.]+$/i.test(url.hostname)) return null;
  const m = url.pathname.match(/^\/biz\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]!) : null;
}

export function classifyUrl(input: string): ClassifiedUrl {
  const url = normalizeUrl(input);
  if (!url) return { url: input.trim(), kind: "unknown" };
  const host = url.hostname.toLowerCase();
  if (isMapsShortLink(url) || /(^|\.)google\.[a-z.]+$/.test(host) && url.pathname.startsWith("/maps")) return { url: url.toString(), kind: "maps" };
  if (/(^|\.)yelp\.[a-z.]+$/.test(host)) return { url: url.toString(), kind: "yelp" };
  for (const [re, network] of SOCIAL_HOSTS) if (re.test(host)) return { url: url.toString(), kind: "social", network };
  for (const [re, directory] of DIRECTORY_HOSTS) if (re.test(host)) return { url: url.toString(), kind: "directory", directory };
  return { url: url.toString(), kind: "website" };
}

function toList(v: string[] | string | null | undefined): string[] {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : v.split(/[\n,]+/);
  return arr.map((s) => s.trim()).filter(Boolean);
}

export function parseGbpInput(raw: string | null | undefined): GbpInput | null {
  const text = (raw ?? "").trim();
  if (!text) return null;
  const url = normalizeUrl(text);
  if (url && /^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
    if (isMapsShortLink(url)) return { kind: "short_link", url: url.toString() };
    const parsed = parseMapsUrl(url);
    if (parsed) return { kind: "maps_url", url: url.toString(), parsed };
    return null;
  }
  // A bare host that happens to be a maps link.
  if (url && isMapsShortLink(url)) return { kind: "short_link", url: url.toString() };
  return { kind: "text", query: text.replace(/\s+/g, " ") };
}

export function parseInputs(raw: RawInputs): ParsedInputs {
  const problems: string[] = [];

  const websiteUrl = normalizeUrl(raw.website);
  if (raw.website?.trim() && !websiteUrl) problems.push(`Website "${raw.website.trim()}" is not a valid URL.`);
  const website = websiteUrl ? { url: websiteUrl.toString(), host: bareHost(websiteUrl.hostname) } : null;

  const gbp = parseGbpInput(raw.gbp);
  if (raw.gbp?.trim() && !gbp) problems.push(`Google Business Profile input "${raw.gbp.trim()}" is not a Maps link or a name.`);

  let yelp: ParsedInputs["yelp"] = null;
  const yelpUrl = normalizeUrl(raw.yelp);
  if (raw.yelp?.trim()) {
    const alias = yelpUrl ? yelpAlias(yelpUrl) : null;
    if (yelpUrl && alias) yelp = { url: yelpUrl.toString(), alias };
    else problems.push(`Yelp input "${raw.yelp.trim()}" is not a yelp.com/biz/... URL.`);
  }

  const extras = toList(raw.extraUrls).map(classifyUrl);
  for (const e of extras) if (e.kind === "unknown") problems.push(`Extra URL "${e.url}" could not be parsed.`);

  const services = toList(raw.services);
  const avgTicketNum = raw.avgTicket === null || raw.avgTicket === undefined || raw.avgTicket === "" ? null : Number(raw.avgTicket);
  if (avgTicketNum !== null && (!Number.isFinite(avgTicketNum) || avgTicketNum <= 0)) problems.push("Average ticket must be a positive number.");

  return {
    website,
    gbp,
    yelp,
    extras,
    serviceArea: raw.serviceArea?.trim() || null,
    services,
    avgTicket: avgTicketNum !== null && Number.isFinite(avgTicketNum) && avgTicketNum > 0 ? avgTicketNum : null,
    problems,
  };
}

/** True when at least one input can start a resolution. */
export function hasResolvableInput(p: ParsedInputs): boolean {
  return !!(p.website || p.gbp || p.yelp);
}
