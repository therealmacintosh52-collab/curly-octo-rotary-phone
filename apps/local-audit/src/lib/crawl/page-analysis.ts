import * as cheerio from "cheerio";
import { extractNapFromHtml } from "@/lib/resolve/nap";

/**
 * Everything the checks may ask about one HTML page, computed once from the
 * static HTML. Values are facts about the document; interpretation belongs to
 * the checks.
 */
export interface PageLink {
  href: string;
  text: string;
  internal: boolean;
  nofollow: boolean;
  /** Where on the page the link sits, for above-the-fold heuristics. */
  region: "header" | "nav" | "main" | "footer" | "other";
}

export interface PageImage {
  src: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  loading: string | null;
  format: string | null;
  hasSrcset: boolean;
  inPicture: boolean;
  /** Document order; low = near the top. */
  index: number;
}

export interface JsonLdBlock {
  raw: string;
  parsed: Record<string, unknown> | null;
  types: string[];
  error: string | null;
}

export interface PageForm {
  action: string | null;
  method: string;
  fields: number;
  hasPhoneField: boolean;
  hasEmailField: boolean;
  hasTextarea: boolean;
}

export interface PageAnalysis {
  url: string;
  finalUrl: string;
  status: number;
  htmlBytes: number;
  title: string | null;
  metaDescription: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  viewport: string | null;
  lang: string | null;
  hasFavicon: boolean;
  charset: string | null;
  headings: { level: number; text: string }[];
  h1s: string[];
  wordCount: number;
  /** First ~1,200 characters of visible text, for entity-statement and answer-first checks. */
  textStart: string;
  text: string;
  links: PageLink[];
  images: PageImage[];
  jsonLd: JsonLdBlock[];
  og: Record<string, string>;
  forms: PageForm[];
  telLinks: string[];
  mailtoLinks: string[];
  iframes: string[];
  scripts: { total: number; external: number; inlineBytes: number };
  styles: { inlineBytes: number };
  mixedContent: string[];
  widgets: { chat: string[]; booking: string[]; analytics: string[]; reviews: string[] };
  hasAddressTag: boolean;
  phones: string[];
  addresses: string[];
  copyrightYear: number | null;
  datesFound: string[];
  questionHeadings: string[];
  trustPhrases: string[];
  pricingMentions: number;
  ctaAboveFold: string[];
  headerText: string;
  hreflang: { lang: string; href: string }[];
  hasMapEmbed: boolean;
  hoursMentioned: boolean;
  isHtml: boolean;
}

const CTA_WORDS = /\b(call|call now|get a free quote|get a quote|free quote|request a quote|book|book now|schedule|get started|contact us|get an estimate|free estimate|request service)\b/i;
const TRUST_PATTERNS: [RegExp, string][] = [
  [/\blicensed\b/i, "licensed"],
  [/\binsured\b/i, "insured"],
  [/\bbonded\b/i, "bonded"],
  [/\bguarantee(d)?\b/i, "guarantee"],
  [/\bwarrant(y|ies)\b/i, "warranty"],
  [/\bBBB\b|better business bureau/i, "BBB"],
  [/\bcertified\b/i, "certified"],
  [/\blic(ense)?\.?\s*#?\s*\d{4,}/i, "license number"],
  [/\b(since|est\.?|established)\s+(19|20)\d{2}\b/i, "years in business"],
  [/\b\d{1,2}\+?\s+years? (of )?experience\b/i, "years of experience"],
  [/\bfamily[- ]owned\b|\blocally[- ]owned\b|\bveteran[- ]owned\b/i, "owned"],
];
const WIDGETS: Record<keyof PageAnalysis["widgets"], [RegExp, string][]> = {
  chat: [
    [/tawk\.to/i, "Tawk.to"],
    [/intercom/i, "Intercom"],
    [/drift\.com|js\.driftt/i, "Drift"],
    [/podium/i, "Podium"],
    [/hubspot.*conversations|hs-scripts/i, "HubSpot chat"],
    [/tidio/i, "Tidio"],
    [/crisp\.chat/i, "Crisp"],
    [/livechatinc|livechat/i, "LiveChat"],
    [/zendesk.*web_widget|zopim/i, "Zendesk"],
    [/birdeye.*webchat|birdeye/i, "Birdeye"],
  ],
  booking: [
    [/calendly\.com/i, "Calendly"],
    [/housecallpro|housecall/i, "Housecall Pro"],
    [/getjobber|jobber/i, "Jobber"],
    [/servicetitan|scheduler\.servicetitan/i, "ServiceTitan"],
    [/acuityscheduling/i, "Acuity"],
    [/squareup\.com\/appointments|square\.site/i, "Square Appointments"],
    [/booksy/i, "Booksy"],
    [/vagaro/i, "Vagaro"],
    [/setmore/i, "Setmore"],
    [/schedulicity/i, "Schedulicity"],
    [/zocdoc/i, "Zocdoc"],
    [/opentable|resy\.com/i, "Reservations"],
  ],
  analytics: [
    [/googletagmanager\.com|gtag\(|google-analytics\.com|G-[A-Z0-9]{6,}/i, "Google Analytics / Tag Manager"],
    [/connect\.facebook\.net|fbq\(/i, "Meta Pixel"],
    [/clarity\.ms/i, "Microsoft Clarity"],
    [/hotjar/i, "Hotjar"],
    [/callrail/i, "CallRail"],
  ],
  reviews: [
    [/elfsight.*review|elfsight/i, "Elfsight reviews"],
    [/trustindex/i, "Trustindex"],
    [/reviewsonmywebsite|romw/i, "ReviewsOnMyWebsite"],
    [/birdeye.*review/i, "Birdeye reviews"],
    [/yotpo|judge\.me|stamped\.io/i, "Ecommerce reviews"],
    [/google\.com\/maps\/embed/i, "Google Maps embed"],
  ],
};

const MONTHS = "(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*";
const DATE_RE = new RegExp(`\\b(${MONTHS}\\.? \\d{1,2},? (20\\d{2})|\\d{1,2}/\\d{1,2}/(20\\d{2})|(20\\d{2})-\\d{2}-\\d{2})\\b`, "gi");

function imgFormat(src: string): string | null {
  const m = src.split("?")[0]!.match(/\.(jpe?g|png|gif|webp|avif|svg|bmp|tiff?)$/i);
  return m ? m[1]!.toLowerCase().replace("jpeg", "jpg") : null;
}

type Sel = ReturnType<cheerio.CheerioAPI>;

function regionOf(el: Sel): PageLink["region"] {
  if (el.closest("nav, [role=navigation]").length) return "nav";
  if (el.closest("header, [role=banner], .header, #header").length) return "header";
  if (el.closest("footer, [role=contentinfo], .footer, #footer").length) return "footer";
  if (el.closest("main, article, [role=main]").length) return "main";
  return "other";
}

function absolutize(href: string, base: string): string | null {
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
}

export function analyzePage(html: string, input: { url: string; finalUrl?: string; status?: number; contentType?: string | null }): PageAnalysis {
  const finalUrl = input.finalUrl ?? input.url;
  const isHtml = !input.contentType || /html/i.test(input.contentType);
  const $ = cheerio.load(html);
  const pageHost = (() => {
    try {
      return new URL(finalUrl).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();
  const pageIsHttps = finalUrl.startsWith("https://");

  // Visible text: drop script/style/noscript/template first.
  const $text = cheerio.load(html);
  $text("script, style, noscript, template, svg").remove();
  const text = $text("body").text().replace(/\s+/g, " ").trim();
  const words = text ? text.split(/\s+/).length : 0;
  const headerText = $text("header, [role=banner], nav").text().replace(/\s+/g, " ").trim();
  // Body text without header/nav/footer: what a visitor reads after the chrome.
  const $main = cheerio.load(html);
  $main("script, style, noscript, template, svg, header, [role=banner], nav, footer, [role=contentinfo], .footer, #footer").remove();
  const mainText = $main("body").text().replace(/\s+/g, " ").trim();
  // "Above the fold" without rendering: header/nav plus the first 1,500 characters of the main text (the footer never counts).
  const aboveFold = `${headerText} ${mainText.slice(0, 1_500)}`;

  const headings: PageAnalysis["headings"] = [];
  $("h1, h2, h3, h4, h5, h6").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t) headings.push({ level: Number(el.tagName[1]), text: t });
  });

  const links: PageLink[] = [];
  const telLinks: string[] = [];
  const mailtoLinks: string[] = [];
  $("a[href]").each((_, el) => {
    const $el = $(el);
    const href = ($el.attr("href") ?? "").trim();
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    if (href.startsWith("tel:")) {
      telLinks.push(href.slice(4));
      return;
    }
    if (href.startsWith("mailto:")) {
      mailtoLinks.push(href.slice(7));
      return;
    }
    const abs = absolutize(href, finalUrl);
    if (!abs || !/^https?:/.test(abs)) return;
    let internal = false;
    try {
      internal = new URL(abs).hostname.replace(/^www\./, "") === pageHost;
    } catch {
      internal = false;
    }
    links.push({
      href: abs,
      text: $el.text().replace(/\s+/g, " ").trim() || ($el.attr("aria-label") ?? "").trim(),
      internal,
      nofollow: /\bnofollow\b/i.test($el.attr("rel") ?? ""),
      region: regionOf($el),
    });
  });

  const images: PageImage[] = [];
  $("img").each((i, el) => {
    const $el = $(el);
    const src = ($el.attr("src") ?? $el.attr("data-src") ?? "").trim();
    if (!src || src.startsWith("data:")) return;
    const abs = absolutize(src, finalUrl) ?? src;
    const w = Number($el.attr("width"));
    const h = Number($el.attr("height"));
    images.push({
      src: abs,
      alt: $el.attr("alt") ?? null,
      width: Number.isFinite(w) && w > 0 ? w : null,
      height: Number.isFinite(h) && h > 0 ? h : null,
      loading: $el.attr("loading") ?? null,
      format: imgFormat(abs),
      hasSrcset: !!$el.attr("srcset") || !!$el.closest("picture").find("source[srcset]").length,
      inPicture: $el.closest("picture").length > 0,
      index: i,
    });
  });

  const jsonLd: JsonLdBlock[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text().trim();
    try {
      const parsed = JSON.parse(raw);
      const nodes: Record<string, unknown>[] = Array.isArray(parsed) ? parsed : parsed?.["@graph"] ? parsed["@graph"] : [parsed];
      for (const n of nodes) {
        const t = n?.["@type"];
        jsonLd.push({ raw, parsed: n, types: Array.isArray(t) ? t.map(String) : t ? [String(t)] : [], error: null });
      }
    } catch (err) {
      jsonLd.push({ raw, parsed: null, types: [], error: err instanceof Error ? err.message : "invalid JSON" });
    }
  });

  const og: Record<string, string> = {};
  $('meta[property^="og:"]').each((_, el) => {
    const p = $(el).attr("property");
    const c = $(el).attr("content");
    if (p && c) og[p] = c;
  });

  const forms: PageForm[] = [];
  $("form").each((_, el) => {
    const $f = $(el);
    const fields = $f.find("input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea");
    const kinds = fields.map((_, f) => `${$(f).attr("type") ?? f.tagName} ${$(f).attr("name") ?? ""} ${$(f).attr("id") ?? ""}`.toLowerCase()).get();
    forms.push({
      action: $f.attr("action") ?? null,
      method: ($f.attr("method") ?? "get").toLowerCase(),
      fields: fields.length,
      hasPhoneField: kinds.some((k) => /tel|phone/.test(k)),
      hasEmailField: kinds.some((k) => /email/.test(k)),
      hasTextarea: kinds.some((k) => k.startsWith("textarea")),
    });
  });

  const iframes = $("iframe[src]")
    .map((_, el) => $(el).attr("src") ?? "")
    .get();

  let inlineScriptBytes = 0;
  let externalScripts = 0;
  $("script").each((_, el) => {
    if ($(el).attr("src")) externalScripts += 1;
    else inlineScriptBytes += $(el).text().length;
  });
  let inlineStyleBytes = 0;
  $("style").each((_, el) => {
    inlineStyleBytes += $(el).text().length;
  });

  const mixedContent: string[] = [];
  if (pageIsHttps) {
    $("img[src], script[src], link[href][rel=stylesheet], iframe[src], video[src], source[src]").each((_, el) => {
      const v = $(el).attr("src") ?? $(el).attr("href") ?? "";
      if (/^http:\/\//i.test(v)) mixedContent.push(v);
    });
  }

  const widgets: PageAnalysis["widgets"] = { chat: [], booking: [], analytics: [], reviews: [] };
  for (const key of Object.keys(WIDGETS) as (keyof typeof WIDGETS)[]) {
    for (const [re, name] of WIDGETS[key]) if (re.test(html) && !widgets[key].includes(name)) widgets[key].push(name);
  }

  const nap = extractNapFromHtml(html);
  const yearMatches = [...text.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?((?:19|20)\d{2})/gi)].map((m) => Number(m[1]));
  const copyrightYear = yearMatches.length ? Math.max(...yearMatches) : null;
  const datesFound = [...text.matchAll(DATE_RE)].map((m) => m[0]).slice(0, 20);
  const questionHeadings = headings.filter((h) => /\?\s*$/.test(h.text) || /^(how|what|why|when|where|who|which|can|do|does|is|are|should)\b/i.test(h.text)).map((h) => h.text);
  const trustPhrases = TRUST_PATTERNS.filter(([re]) => re.test(text)).map(([, label]) => label);
  const pricingMentions = (text.match(/\$\s?\d{2,}|\bpric(e|es|ing)\b|\bstarting at\b|\bflat[- ]rate\b|\bfree estimate/gi) ?? []).length;
  const ctaAboveFold = [...new Set([...aboveFold.matchAll(new RegExp(CTA_WORDS.source, "gi"))].map((m) => m[0].toLowerCase()))];
  const hreflang = $('link[rel="alternate"][hreflang]')
    .map((_, el) => ({ lang: $(el).attr("hreflang") ?? "", href: $(el).attr("href") ?? "" }))
    .get();
  const hasMapEmbed = iframes.some((s) => /google\.com\/maps|maps\.apple\.com|openstreetmap|mapbox/i.test(s)) || /maps\.googleapis\.com\/maps\/api\/js|google\.com\/maps\/embed/i.test(html);
  const hoursMentioned = /\b(hours|open(ing)? hours|mon(day)?\s*[-–]\s*fri(day)?|24\/7|open now|\d{1,2}(:\d{2})?\s*(am|pm)\s*[-–]\s*\d{1,2}(:\d{2})?\s*(am|pm))\b/i.test(text) || jsonLd.some((b) => b.parsed && ("openingHours" in b.parsed || "openingHoursSpecification" in b.parsed));

  return {
    url: input.url,
    finalUrl,
    status: input.status ?? 200,
    htmlBytes: Buffer.byteLength(html, "utf8"),
    title: $("title").first().text().trim() || null,
    metaDescription: $('meta[name="description"]').attr("content")?.trim() || null,
    canonical: $('link[rel="canonical"]').attr("href")?.trim() || null,
    robotsMeta: $('meta[name="robots"]').attr("content")?.trim().toLowerCase() || null,
    viewport: $('meta[name="viewport"]').attr("content")?.trim() || null,
    lang: $("html").attr("lang")?.trim() || null,
    hasFavicon: $('link[rel~="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').length > 0,
    charset: $("meta[charset]").attr("charset") ?? null,
    headings,
    h1s: headings.filter((h) => h.level === 1).map((h) => h.text),
    wordCount: words,
    textStart: mainText.slice(0, 1_200),
    text,
    links,
    images,
    jsonLd,
    og,
    forms,
    telLinks,
    mailtoLinks,
    iframes,
    scripts: { total: externalScripts + $("script:not([src])").length, external: externalScripts, inlineBytes: inlineScriptBytes },
    styles: { inlineBytes: inlineStyleBytes },
    mixedContent,
    widgets,
    hasAddressTag: $("address").length > 0,
    phones: nap.phones,
    addresses: nap.addresses,
    copyrightYear,
    datesFound,
    questionHeadings,
    trustPhrases,
    pricingMentions,
    ctaAboveFold,
    headerText,
    hreflang,
    hasMapEmbed,
    hoursMentioned,
    isHtml,
  };
}

/** Path-based classification used for crawl priority and per-page-type checks. */
export type PageKind = "home" | "contact" | "about" | "service" | "location" | "pricing" | "reviews" | "faq" | "blog" | "legal" | "other";

export function classifyPath(url: string): PageKind {
  let path = "/";
  try {
    path = new URL(url).pathname.toLowerCase().replace(/\/+$/, "") || "/";
  } catch {
    return "other";
  }
  if (path === "/" || /^\/(index|home)(\.\w+)?$/.test(path)) return "home";
  if (/contact|get-in-touch|quote|estimate|book|schedule|appointment/.test(path)) return "contact";
  if (/about|our-story|team|who-we-are|meet/.test(path)) return "about";
  if (/location|service-area|areas?-we-serve|cities|near-me|\/[a-z-]+-(ca|tx|fl|ny|wa|az|nv|or|co|il|ga|nc|oh|pa|mi)(\/|$)/.test(path)) return "location";
  if (/pric|rates|cost|packages|plans|menu/.test(path)) return "pricing";
  if (/review|testimonial|gallery|before-after|portfolio|our-work/.test(path)) return "reviews";
  if (/faq|questions/.test(path)) return "faq";
  if (/blog|news|article|post|resources|guide|tips|insights|\/20\d{2}\//.test(path)) return "blog";
  if (/privacy|terms|policy|cookie|accessibility|sitemap|legal/.test(path)) return "legal";
  if (/service|repair|install|treatment|procedure|what-we-do|solutions|products?/.test(path)) return "service";
  return "other";
}
