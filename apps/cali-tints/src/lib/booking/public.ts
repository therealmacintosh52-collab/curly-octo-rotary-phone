import "server-only";

import type { AppointmentView, PublicCatalog } from "@/lib/db/types";
import { anonClient, isTokenShape } from "@/lib/estimates/public";

/** The booking page's menu, policy and hours. Null when Supabase is not configured or the shop has no retail settings. */
export async function loadPublicCatalog(): Promise<PublicCatalog | null> {
  try {
    const { data, error } = await anonClient().rpc("public_catalog");
    if (error || !data?.settings) return null;
    return data;
  } catch {
    return null;
  }
}

export async function loadPublicAppointment(token: string): Promise<AppointmentView | null> {
  if (!isTokenShape(token)) return null;
  try {
    const { data, error } = await anonClient().rpc("appointment_by_token", { p_token: token });
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
}

/**
 * A small per-IP throttle for the public slot search and holds: the engine
 * is cheap but not free, and the page is open to anyone with the link.
 * Resets as the process does; Vercel functions are short-lived, which is fine.
 */
const hits = new Map<string, { n: number; at: number }>();
export function throttle(ip: string, limit = 60, windowMs = 60_000): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.at > windowMs) {
    hits.set(ip, { n: 1, at: now });
    return true;
  }
  h.n += 1;
  return h.n <= limit;
}
