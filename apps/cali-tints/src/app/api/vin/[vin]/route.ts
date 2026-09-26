import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { DEMO_COOKIE, isDemoCookieValid } from "@/lib/demo";
import { isVinShape, mapNhtsaRow, NHTSA_DECODE_URL, normalizeVin, type NhtsaDecodeRow, type VinDecodeResult } from "@/lib/vin";

/** Re-fetch from NHTSA after this long; their data for a given VIN rarely changes. */
const FRESH_MS = 180 * 24 * 60 * 60 * 1000;

/**
 * GET /api/vin/:vin — decode a VIN via NHTSA vPIC with a shared Postgres cache.
 * Signed-in users only (the cache table is RLS-protected to members).
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/vin/[vin]">) {
  const { vin: raw } = await ctx.params;
  const vin = normalizeVin(raw);
  if (!isVinShape(vin)) {
    return NextResponse.json({ error: "VIN must be 17 characters (no I, O or Q)" }, { status: 400 });
  }

  // Guest preview: decode live, skip the database cache.
  const store = await cookies();
  if (isDemoCookieValid(store.get(DEMO_COOKIE)?.value)) {
    try {
      const res = await fetch(NHTSA_DECODE_URL(vin), { headers: { accept: "application/json" }, signal: AbortSignal.timeout(8000) });
      const body = (await res.json()) as { Results?: NhtsaDecodeRow[] };
      return NextResponse.json({ ...mapNhtsaRow(vin, body.Results?.[0]), source: "nhtsa" });
    } catch {
      return NextResponse.json({ error: "VIN lookup unavailable" }, { status: 502 });
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: cached } = await supabase.from("vin_cache").select("*").eq("vin", vin).maybeSingle();
  const cachedResult: VinDecodeResult | null = cached
    ? {
        vin,
        year: cached.year,
        make: cached.make,
        model: cached.model,
        trim: cached.trim,
        bodyClass: cached.body_class,
        errorCode: null,
        errorText: null,
      }
    : null;

  if (cached && Date.now() - new Date(cached.fetched_at).getTime() < FRESH_MS) {
    return NextResponse.json({ ...cachedResult, source: "cache" }, { headers: { "Cache-Control": "private, max-age=86400" } });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(NHTSA_DECODE_URL(vin), { signal: controller.signal, headers: { accept: "application/json" } });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`NHTSA responded ${res.status}`);
    const body = (await res.json()) as { Results?: NhtsaDecodeRow[] };
    const result = mapNhtsaRow(vin, body.Results?.[0]);

    if (result.year || result.make) {
      await supabase.from("vin_cache").upsert({
        vin,
        year: result.year,
        make: result.make,
        model: result.model,
        trim: result.trim,
        body_class: result.bodyClass,
        decoded: (body.Results?.[0] ?? {}) as Record<string, string>,
        fetched_at: new Date().toISOString(),
      });
    }
    return NextResponse.json({ ...result, source: "nhtsa" }, { headers: { "Cache-Control": "private, max-age=86400" } });
  } catch (err) {
    if (cachedResult) {
      return NextResponse.json({ ...cachedResult, source: "stale-cache" });
    }
    const message = err instanceof Error && err.name === "AbortError" ? "VIN lookup timed out" : "VIN lookup unavailable";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
