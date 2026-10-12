/**
 * BayIntel, the repair-intelligence app, opens inside this app in a window
 * (an iframe). Integration is by URL only: NEXT_PUBLIC_BAYINTEL_URL points at
 * its own deployment, which keeps its own Supabase auth. Pure helpers here;
 * the window itself is src/components/intel/intel-window.tsx.
 */

/** The BayIntel origin from the environment, without a trailing slash; "" when not configured. */
export function bayintelBase(raw: string | undefined = process.env.NEXT_PUBLIC_BAYINTEL_URL): string {
  const v = (raw ?? "").trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(v)) return "";
  return v;
}

export const bayintelConfigured = (raw?: string) => bayintelBase(raw) !== "";

/** The absolute URL of a BayIntel screen. Paths must start with "/"; anything else opens the garage. */
export function bayintelUrl(path: string | null | undefined, raw?: string): string | null {
  const base = bayintelBase(raw);
  if (!base) return null;
  const p = typeof path === "string" && path.startsWith("/") && !path.startsWith("//") ? path : "/garage";
  return `${base}${p}`;
}

/** The origin BayIntel's postMessage events must come from. */
export function bayintelOrigin(raw?: string): string | null {
  const base = bayintelBase(raw);
  if (!base) return null;
  try {
    return new URL(base).origin;
  } catch {
    return null;
  }
}

export type BayintelMessage = { type: "bayintel:close" } | { type: "bayintel:navigate"; path: string };

/** Reads a message from the iframe; anything from another origin or of another shape is ignored. */
export function parseBayintelMessage(event: { origin: string; data: unknown }, raw?: string): BayintelMessage | null {
  const origin = bayintelOrigin(raw);
  if (!origin || event.origin !== origin) return null;
  const d = event.data as { type?: unknown; path?: unknown } | null;
  if (!d || typeof d !== "object") return null;
  if (d.type === "bayintel:close") return { type: "bayintel:close" };
  if (d.type === "bayintel:navigate" && typeof d.path === "string" && d.path.startsWith("/") && !d.path.startsWith("//")) return { type: "bayintel:navigate", path: d.path };
  return null;
}

export const OPEN_EVENT = "bayintel:open";

/**
 * Open BayIntel on a screen from anywhere in the app (a server component's
 * child, a toast action, a non-React caller): `openRetail("/dtc?codes=P0300")`
 * or `openRetail(`/vehicles/${id}`)`. The window provider listens.
 */
export function openRetail(path = "/garage"): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { path } }));
}
