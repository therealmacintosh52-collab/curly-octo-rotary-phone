// Consent store (CA-friendly): two categories, both OFF until the visitor chooses.
//   analytics = GA4 · marketing = Meta Pixel + Google Ads (+ server CAPI, which callers must gate on this)
// Honors Global Privacy Control: if the browser sends GPC, marketing stays off no matter what was chosen.
// Stored in localStorage only (a per-visitor convenience); the page works with storage blocked.
export type Consent = { analytics: boolean; marketing: boolean; decided: boolean };

const KEY = 'd916_consent_v1';
const EVT = 'd916:consent';
const OPEN_EVT = 'd916:consent-open';

export const SERVER_CONSENT: Consent = { analytics: false, marketing: false, decided: true }; // decided:true => no banner in SSR HTML
const UNDECIDED: Consent = { analytics: false, marketing: false, decided: false };

const gpc = () => typeof navigator !== 'undefined' && (navigator as Navigator & { globalPrivacyControl?: boolean }).globalPrivacyControl === true;

let cacheRaw: string | null | undefined;
let cacheVal: Consent = UNDECIDED;
let memory: Consent | null = null; // choice kept for this page view when storage is blocked

export function getConsent(): Consent {
  if (typeof window === 'undefined') return SERVER_CONSENT;
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { /* blocked */ }
  if (raw === cacheRaw) return cacheVal;
  cacheRaw = raw;
  if (!raw) { cacheVal = memory ?? UNDECIDED; return cacheVal; }
  try {
    const p = JSON.parse(raw) as { analytics?: boolean; marketing?: boolean };
    cacheVal = { analytics: p.analytics === true, marketing: p.marketing === true && !gpc(), decided: true };
  } catch { cacheVal = UNDECIDED; }
  return cacheVal;
}

export function setConsent(c: { analytics: boolean; marketing: boolean }): void {
  const value = { analytics: c.analytics, marketing: c.marketing && !gpc() };
  memory = { ...value, decided: true };
  try { localStorage.setItem(KEY, JSON.stringify({ ...value, ts: Date.now() })); } catch { /* blocked */ }
  cacheRaw = undefined; // force the next getConsent() to re-read
  window.dispatchEvent(new Event(EVT));
}

export function subscribeConsent(cb: () => void): () => void {
  window.addEventListener(EVT, cb);
  window.addEventListener('storage', cb);
  return () => { window.removeEventListener(EVT, cb); window.removeEventListener('storage', cb); };
}

export const openConsent = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event(OPEN_EVT)); };
export const CONSENT_OPEN_EVENT = OPEN_EVT;
export const isGpc = gpc;
