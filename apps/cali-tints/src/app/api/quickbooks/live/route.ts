import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncJobToQuickBooks } from "@/lib/quickbooks/live";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/quickbooks/live { jobId }
 * Called by the device right after a job synced: pushes that job's month to
 * QuickBooks. Any signed-in member may call it for a job they can see; the
 * daily sync covers anything that slips through (no signal, closed app).
 */
export async function POST(req: Request) {
  const session = await getSession();
  const body = z.object({ jobId: z.uuid() }).safeParse(await req.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "jobId required" }, { status: 400 });
  // RLS: the caller can only see jobs they are allowed to.
  const supabase = await createClient();
  const { data: job } = await supabase.from("jobs").select("id").eq("id", body.data.jobId).maybeSingle();
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!session.company.quickbooks_realm_id) return NextResponse.json({ ok: true, skipped: "not connected" });
  try {
    const results = await syncJobToQuickBooks(createAdminClient(), job.id);
    return NextResponse.json({ ok: true, results: results.map((r) => ({ month: r.monthStart, jobs: r.jobs, number: r.docNumber, error: r.error ?? null })) });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "QuickBooks sync failed" }, { status: 200 });
  }
}
