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

/** Real app route → fixture preview route. Order matters (longest prefix first); `exact` entries match only that path. */
const DEMO_REWRITES: [prefix: string, target: string, exact?: boolean][] = [
  ["/jobs/new", "/dev/preview"],
  ["/jobs/outbox", "/dev/preview/jobs"],
  ["/jobs", "/dev/preview/jobs", true],
  ["/jobs", "/dev/preview/job"],
  ["/retail/customers/new", "/dev/preview/retail/customer-new"],
  ["/retail/customers", "/dev/preview/retail/customers", true],
  ["/retail", "/dev/preview/retail", true],
  ["/invoices/new", "/dev/preview/invoices"],
  ["/invoices", "/dev/preview/invoices", true],
  ["/invoices", "/dev/preview/invoice"],
  ["/settings/retail", "/dev/preview/settings/retail"],
  ["/settings/booking", "/dev/preview/settings/booking"],
  ["/settings", "/dev/preview/settings"],
  ["/guide", "/dev/preview/guide"],
  ["/login", "/dev/preview/dashboard"],
  ["/", "/dev/preview/dashboard"],
];

export function demoRewriteTarget(pathname: string): string | null {
  if (pathname.startsWith("/dev/preview")) return null; // already a preview page
  // One invoice: keep the id so every row in the demo list opens its own page.
  const inv = pathname.match(/^\/invoices\/([^/]+)$/);
  if (inv && inv[1] !== "new") return `/dev/preview/invoice/${inv[1]}`;
  const job = pathname.match(/^\/jobs\/([^/]+)$/);
  if (job && job[1] !== "new" && job[1] !== "outbox") return `/dev/preview/job/${job[1]}`;
  const cust = pathname.match(/^\/retail\/customers\/([^/]+)$/);
  if (cust && cust[1] !== "new") return `/dev/preview/retail/customer/${cust[1]}`;
  const veh = pathname.match(/^\/retail\/vehicles\/([^/]+)$/);
  if (veh) return `/dev/preview/retail/vehicle/${veh[1]}`;
  for (const [prefix, target, exact] of DEMO_REWRITES) {
    if (pathname === prefix) return target;
    if (!exact && prefix !== "/" && pathname.startsWith(prefix + "/")) return target;
  }
  return null;
}
