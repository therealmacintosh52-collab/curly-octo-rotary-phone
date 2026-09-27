import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncCloverPayments } from "@/lib/clover/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel Cron (see vercel.json) pulls Clover payments for every company with
 * Clover enabled. Vercel sends `Authorization: Bearer $CRON_SECRET`; anyone
 * else gets 401.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 500 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: companies, error } = await admin.from("companies").select("*").eq("clover_enabled", true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: Record<string, unknown> = {};
  for (const company of companies ?? []) {
    try {
      results[company.id] = await syncCloverPayments(admin, company);
    } catch (err) {
      results[company.id] = { error: err instanceof Error ? err.message : String(err) };
    }
  }
  return NextResponse.json({ ok: true, companies: (companies ?? []).length, results });
}
