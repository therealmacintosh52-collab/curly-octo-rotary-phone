/**
 * Guest demo mode.
 *
 * When DEMO_ACCESS_KEY is set, anyone holding the secret link
 * `/demo?key=<DEMO_ACCESS_KEY>` gets a cookie that unlocks the fixture-driven
 * preview screens with NO login and NO database: every app route is
 * rewritten to its /dev/preview twin by proxy.ts. Nothing is saved; the
 * pages are marked noindex. Without the key the deployment shows only the
 * "enter access key" page (or, when Supabase is configured, the real login).
 */
import { BUILT_IN_DEMO_KEY } from "./demo-key";

export const DEMO_COOKIE = "ct_demo";
export const DEMO_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export function demoKey(): string | null {
  const k = (process.env.DEMO_ACCESS_KEY ?? BUILT_IN_DEMO_KEY ?? "").trim();
  return k && k.length >= 8 ? k : null;
}

/** Constant-time string compare (keys are short; avoids leaking length-by-timing beyond the length itself). */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isDemoCookieValid(value: string | undefined | null): boolean {
  const key = demoKey();
  return !!key && !!value && safeEqual(value, key);
}

/** Real app route → fixture preview route. Order matters (longest prefix first). */
const DEMO_REWRITES: [prefix: string, target: string][] = [
  ["/jobs/new", "/dev/preview"],
  ["/jobs/outbox", "/dev/preview/jobs"],
  ["/jobs", "/dev/preview/jobs"],
  ["/invoices", "/dev/preview/invoice"],
  ["/settings", "/dev/preview/settings"],
  ["/login", "/dev/preview/dashboard"],
  ["/", "/dev/preview/dashboard"],
];

export function demoRewriteTarget(pathname: string): string | null {
  if (pathname.startsWith("/dev/preview")) return null; // already a preview page
  for (const [prefix, target] of DEMO_REWRITES) {
    if (prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(prefix + "/")) return target;
  }
  return null;
}
