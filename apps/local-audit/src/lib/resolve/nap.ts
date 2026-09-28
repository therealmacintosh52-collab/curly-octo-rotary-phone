/**
 * Name / address / phone normalization and comparison. Normalization is
 * deliberately conservative: it removes formatting differences (case,
 * punctuation, "Street" vs "St", suite tokens) and nothing else, so a mismatch
 * finding always reflects a real disagreement between sources.
 */
export type NapSource = "website" | "gbp" | "yelp";

export interface NapRecord {
  source: NapSource;
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  /** Where the value was read (URL or API endpoint), for evidence. */
  ref?: string;
}

export interface FieldAgreement {
  field: "name" | "phone" | "address";
  status: "match" | "mismatch" | "insufficient";
  values: { source: NapSource; raw: string; normalized: string; ref?: string }[];
}

export interface NapComparison {
  name: FieldAgreement;
  phone: FieldAgreement;
  address: FieldAgreement;
}

// ---------------------------------------------------------------------------
// Phone
// ---------------------------------------------------------------------------

/** US/Canada numbers → E.164 (+1XXXXXXXXXX). Anything else → null. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/[^\d]/g, "");
  // Drop extensions like "ext 12" / "x12" that survived as trailing digits.
  const ext = raw.match(/(?:ext\.?|x)\s*(\d+)\s*$/i);
  if (ext && digits.endsWith(ext[1]!)) digits = digits.slice(0, -ext[1]!.length);
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) return null;
  if (/^[01]/.test(digits) || /^[01]/.test(digits.slice(3, 4))) return null; // NANP area/exchange codes start 2–9
  return `+1${digits}`;
}

export function formatPhone(e164: string): string {
  const d = e164.replace(/\D/g, "").slice(-10);
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

// ---------------------------------------------------------------------------
// Name
// ---------------------------------------------------------------------------

const NAME_SUFFIXES = /\b(llc|l\.l\.c\.|inc|inc\.|incorporated|co|co\.|corp|corp\.|corporation|ltd|ltd\.|limited|llp|pllc|pc|p\.c\.|dba)\b/g;

export function normalizeName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’.,]/g, "")
    .replace(NAME_SUFFIXES, " ")
    .replace(/^\s*the\s+/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

// ---------------------------------------------------------------------------
// Address
// ---------------------------------------------------------------------------

const STREET_TYPES: Record<string, string> = {
  street: "st",
  st: "st",
  avenue: "ave",
  ave: "ave",
  av: "ave",
  boulevard: "blvd",
  blvd: "blvd",
  road: "rd",
  rd: "rd",
  drive: "dr",
  dr: "dr",
  lane: "ln",
  ln: "ln",
  court: "ct",
  ct: "ct",
  circle: "cir",
  cir: "cir",
  place: "pl",
  pl: "pl",
  parkway: "pkwy",
  pkwy: "pkwy",
  highway: "hwy",
  hwy: "hwy",
  way: "way",
  terrace: "ter",
  ter: "ter",
  trail: "trl",
  trl: "trl",
  square: "sq",
  sq: "sq",
  expressway: "expy",
  expy: "expy",
  north: "n",
  n: "n",
  south: "s",
  s: "s",
  east: "e",
  e: "e",
  west: "w",
  w: "w",
  northeast: "ne",
  ne: "ne",
  northwest: "nw",
  nw: "nw",
  southeast: "se",
  se: "se",
  southwest: "sw",
  sw: "sw",
};

const DIRECTIONALS = new Set(["n", "s", "e", "w", "ne", "nw", "se", "sw"]);
const STREET_TYPE_TOKENS = new Set(Object.values(STREET_TYPES).filter((t) => !DIRECTIONALS.has(t)));

const UNIT_TOKENS = new Set(["ste", "suite", "unit", "apt", "apartment", "bldg", "building", "fl", "floor", "rm", "room", "#"]);

export interface NormalizedAddress {
  /** Comparable string: street number + street + zip5 when present, else the whole line. */
  key: string;
  streetNumber: string | null;
  street: string | null;
  zip: string | null;
  full: string;
}

export function normalizeAddress(raw: string | null | undefined): NormalizedAddress | null {
  if (!raw) return null;
  const lowered = raw
    .toLowerCase()
    .replace(/\busa?\b|\bunited states\b/g, " ")
    .replace(/[.,;()]/g, " ")
    .replace(/#\s*/g, " # ")
    .replace(/\s+/g, " ")
    .trim();
  if (!lowered) return null;

  const tokens = lowered.split(" ");
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (UNIT_TOKENS.has(t)) {
      i += 1; // skip the unit value
      continue;
    }
    out.push(STREET_TYPES[t] ?? t);
  }
  const full = out.join(" ");
  const zip = full.match(/\b(\d{5})(?:-\d{4})?\b(?!.*\b\d{5}\b)/)?.[1] ?? null;
  let streetNumber: string | null = null;
  let street: string | null = null;
  if (/^\d+[a-z]?$/.test(out[0] ?? "")) {
    streetNumber = out[0]!;
    const rest = out.slice(1);
    // Keep the street up to (and including) the first street-type token; a
    // leading directional ("n fulton ave") is part of the name, not the type.
    const typeIdx = rest.findIndex((w, idx) => STREET_TYPE_TOKENS.has(w) && !(idx === 0 && DIRECTIONALS.has(w)));
    street = (typeIdx >= 0 ? rest.slice(0, typeIdx + 1) : rest.slice(0, Math.min(rest.length, 3))).join(" ") || null;
  }
  const key = streetNumber && street ? `${streetNumber} ${street}${zip ? ` ${zip}` : ""}` : full;
  return { key, streetNumber, street, zip, full };
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

function agreement(field: FieldAgreement["field"], records: NapRecord[], normalize: (v: string) => string | null): FieldAgreement {
  const values: FieldAgreement["values"] = [];
  for (const r of records) {
    const raw = r[field];
    if (!raw) continue;
    const normalized = normalize(raw);
    if (!normalized) continue;
    values.push({ source: r.source, raw, normalized, ref: r.ref });
  }
  if (values.length < 2) return { field, status: "insufficient", values };
  const distinct = new Set(values.map((v) => v.normalized));
  return { field, status: distinct.size === 1 ? "match" : "mismatch", values };
}

function namesAgree(a: string, b: string): boolean {
  if (a === b) return true;
  // One name contained in the other ("Test Plumbing" vs "Test Plumbing Sacramento") counts as agreement.
  return a.length >= 4 && b.length >= 4 && (a.includes(b) || b.includes(a));
}

export function compareNap(records: NapRecord[]): NapComparison {
  const phone = agreement("phone", records, normalizePhone);
  const address = agreement("address", records, (v) => normalizeAddress(v)?.key ?? null);
  const name = agreement("name", records, (v) => normalizeName(v) || null);
  if (name.status === "mismatch") {
    const norms = name.values.map((v) => v.normalized);
    const allAgree = norms.every((n) => norms.every((m) => namesAgree(n, m)));
    if (allAgree) name.status = "match";
  }
  return { name, phone, address };
}

// ---------------------------------------------------------------------------
// Extraction from HTML (home / contact page)
// ---------------------------------------------------------------------------

export interface HtmlNap {
  phones: string[];
  addresses: string[];
  names: string[];
  /** JSON-LD objects found (LocalBusiness and friends), raw. */
  jsonLd: Record<string, unknown>[];
  telLinks: string[];
}

const PHONE_RE = /(?:\+?1[\s.-]?)?\(?\b[2-9]\d{2}\)?[\s.-]?[2-9]\d{2}[\s.-]?\d{4}\b/g;
const STREET_RE =
  /(?<![\d-])\d{1,6}[a-z]?\s+(?:[A-Za-z][A-Za-z'-]*\s+){0,4}(?:Street|St|Avenue|Ave|Boulevard|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Court|Ct|Circle|Cir|Place|Pl|Parkway|Pkwy|Highway|Hwy|Way|Terrace|Ter|Trail|Trl|Square|Sq)\b\.?(?:[,\s]+(?:Suite|Ste|Unit|#)\s*[A-Za-z0-9-]+)?[,\s]+[A-Za-z .'-]+[,\s]+[A-Z]{2}\s+\d{5}(?:-\d{4})?/g;

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, ", ")
    .replace(/<\/(p|div|li|tr|h\d|address)>/gi, ", ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
}

function collectJsonLd(html: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const parsed = JSON.parse(m[1]!.trim());
      const nodes = Array.isArray(parsed) ? parsed : parsed?.["@graph"] ? parsed["@graph"] : [parsed];
      for (const n of nodes) if (n && typeof n === "object") out.push(n as Record<string, unknown>);
    } catch {
      // malformed JSON-LD is itself a finding later; ignore here
    }
  }
  return out;
}

function addressFromJsonLd(node: Record<string, unknown>): string | null {
  const a = node.address as Record<string, unknown> | string | undefined;
  if (!a) return null;
  if (typeof a === "string") return a;
  const parts = [a.streetAddress, a.addressLocality, a.addressRegion, a.postalCode].filter((p) => typeof p === "string" && p.trim()) as string[];
  return parts.length ? parts.join(", ") : null;
}

export function extractNapFromHtml(html: string): HtmlNap {
  const jsonLd = collectJsonLd(html);
  const telLinks = [...html.matchAll(/href\s*=\s*["']tel:([^"']+)["']/gi)].map((m) => decodeURIComponent(m[1]!));
  const text = stripTags(html);

  const phones = new Set<string>();
  for (const t of telLinks) {
    const n = normalizePhone(t);
    if (n) phones.add(n);
  }
  for (const node of jsonLd) {
    const tel = node.telephone;
    if (typeof tel === "string") {
      const n = normalizePhone(tel);
      if (n) phones.add(n);
    }
  }
  for (const m of text.matchAll(PHONE_RE)) {
    const n = normalizePhone(m[0]);
    if (n) phones.add(n);
  }

  const addresses = new Set<string>();
  for (const node of jsonLd) {
    const a = addressFromJsonLd(node);
    if (a) addresses.add(a);
  }
  for (const m of html.matchAll(/<address[^>]*>([\s\S]*?)<\/address>/gi)) {
    const a = stripTags(m[1]!).replace(/,\s*,/g, ",").trim().replace(/[,\s]+$/, "");
    if (a) addresses.add(a);
  }
  for (const m of text.matchAll(STREET_RE)) addresses.add(m[0].replace(/\s+/g, " ").trim());

  const names = new Set<string>();
  for (const node of jsonLd) if (typeof node.name === "string" && node.name.trim()) names.add(node.name.trim());
  const og = html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i)?.[1];
  if (og) names.add(og.trim());
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1];
  if (title) names.add(title.split(/\s[|–-]\s/)[0]!.trim());

  return { phones: [...phones], addresses: [...addresses], names: [...names], jsonLd, telLinks };
}
