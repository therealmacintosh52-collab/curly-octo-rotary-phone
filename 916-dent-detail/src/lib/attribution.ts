// Marketing attribution: capture UTMs / click ids / referrer / landing page on the client (first touch is kept
// for 90 days, last touch is the current visit), and map them to a lead source. Pure helpers are testable.
import type { LeadSource } from '@/lib/db/types';

export type Attribution = {
  utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_term?: string; utm_content?: string;
  gclid?: string; fbclid?: string; ref?: string; referrer?: string; landing_page?: string;
};

const KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid', 'fbclid', 'ref'] as const;
const STORE_KEY = 'd916_attr_v1';
const clip = (s: string) => s.slice(0, 200);

/** Parse an attribution object out of a URL + referrer. Pure. */
export function parseAttribution(href: string, referrer: string, siteHost?: string): Attribution {
  const out: Attribution = {};
  let u: URL;
  try { u = new URL(href, 'http://local.invalid'); } catch { return out; }
  for (const k of KEYS) { const v = u.searchParams.get(k); if (v) out[k] = clip(v); }
  out.landing_page = clip(u.pathname);
  if (referrer) {
    try { const r = new URL(referrer); if (!siteHost || r.host !== siteHost) out.referrer = clip(r.host + r.pathname); } catch { /* ignore */ }
  }
  return out;
}

/** Browser only: read stored touches, merge the current visit, persist. Returns { first, last }. */
export function captureAttribution(): { first: Attribution; last: Attribution } {
  if (typeof window === 'undefined') return { first: {}, last: {} };
  const current = parseAttribution(window.location.href, document.referrer, window.location.host);
  const hasSignal = KEYS.some((k) => current[k]) || Boolean(current.referrer);
  let stored: { first?: Attribution; last?: Attribution; at?: number } = {};
  try { stored = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}'); } catch { /* ignore */ }
  const fresh = stored.at && Date.now() - stored.at < 90 * 86_400_000;
  const first = fresh && stored.first ? stored.first : current;
  const last = hasSignal || !stored.last ? current : stored.last;
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ first, last, at: fresh ? stored.at : Date.now() })); } catch { /* private mode */ }
  return { first, last };
}

const has = (s: string | undefined, ...needles: string[]) => !!s && needles.some((n) => s.toLowerCase().includes(n));

/** Map attribution to a CRM lead source (SPEC: Google, GBP, Meta ads, IG, TikTok, door-knock, referral, dealer). */
export function deriveSource(a: Attribution): LeadSource {
  const src = (a.utm_source ?? '').toLowerCase();
  const med = (a.utm_medium ?? '').toLowerCase();
  const paid = ['cpc', 'ppc', 'paid', 'paidsocial', 'paid_social', 'paid-social', 'display'].includes(med);
  if (a.ref || src === 'referral' || med === 'referral') return 'referral';
  if (src === 'dealer' || has(a.utm_campaign, 'dealer')) return 'dealer';
  if (['door', 'doorknock', 'door-knock', 'door_knock', 'flyer', 'qr'].includes(src) || med === 'door-knock') return 'door_knock';
  if (['gbp', 'gmb', 'google_business', 'google-business', 'googlebusiness'].includes(src) || (src === 'google' && ['gbp', 'gmb', 'maps', 'business'].includes(med))) return 'gbp';
  if (a.fbclid || (paid && ['facebook', 'fb', 'meta', 'instagram', 'ig'].includes(src))) return 'meta_ads';
  if (['instagram', 'ig'].includes(src) || has(a.referrer, 'instagram.com', 'l.instagram.com')) return 'instagram';
  if (src === 'tiktok' || has(a.referrer, 'tiktok.com')) return 'tiktok';
  if (a.gclid || (src === 'google' && paid)) return 'google';
  if (src === 'google' || has(a.referrer, 'google.')) return 'google';
  if (has(a.referrer, 'facebook.com', 'fb.com')) return 'other';
  if (a.referrer || src) return 'organic';
  return 'direct';
}

/**
 * Read-only view of what captureAttribution() stored: first touch (kept 90 days), last touch and the CRM lead source.
 * Safe to call anywhere (returns empty objects on the server). Phase 2 booking calls this when it builds a payload.
 * The site root (components/seo/AnalyticsRoot) calls captureAttribution() on EVERY landing, so a UTM/gclid/fbclid is
 * remembered even if the visitor reaches /book from a different page than the one the ad pointed at.
 */
export function getAttribution(): { first: Attribution; last: Attribution; source: LeadSource } {
  if (typeof window === 'undefined') return { first: {}, last: {}, source: 'direct' };
  let stored: { first?: Attribution; last?: Attribution } = {};
  try { stored = JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}'); } catch { /* ignore */ }
  const first = stored.first ?? {};
  const last = stored.last ?? {};
  // Credit the paid/click-id touch if either touch has one, otherwise the last touch.
  const source = deriveSource(first.gclid || first.fbclid ? first : last);
  return { first, last, source };
}

/** Meta click/browser ids for CAPI matching: _fbc is built from fbclid when the cookie is missing. */
export function metaIdentifiers(): { fbp?: string; fbc?: string } {
  if (typeof document === 'undefined') return {};
  const cookie = (n: string) => document.cookie.split('; ').find((c) => c.startsWith(`${n}=`))?.slice(n.length + 1);
  const fbp = cookie('_fbp');
  let fbc = cookie('_fbc');
  if (!fbc) { const id = getAttribution().last.fbclid ?? getAttribution().first.fbclid; if (id) fbc = `fb.1.${Date.now()}.${id}`; }
  return { ...(fbp ? { fbp } : {}), ...(fbc ? { fbc } : {}) };
}
