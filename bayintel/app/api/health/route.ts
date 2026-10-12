import { isConfigured, missingConfig } from "@/lib/env";

/**
 * Liveness for monitors and for apps that embed BayIntel (the Cali Tints
 * Intel tab asks it before trusting the iframe). 200 when the deployment has
 * its Supabase keys, 503 with the missing names while it does not. CORS-open:
 * it reveals only whether the app is configured, never a value.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Cache-Control": "no-store",
};

export function GET() {
  const ok = isConfigured();
  return Response.json({ ok, configured: ok, missing: ok ? [] : missingConfig(), time: new Date().toISOString() }, { status: ok ? 200 : 503, headers: CORS });
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}
