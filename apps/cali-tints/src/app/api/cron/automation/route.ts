import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { runAutomation } from "@/lib/automation/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Every five minutes (Vercel Cron): release expired holds, derive the timed
 * events (hold expiring, reminders, unanswered estimates), turn events into
 * runs through the rules, carry out the due ones. Idempotent: a run is
 * claimed once and every send is logged on it.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const report = await runAutomation(createAdminClient());
  return NextResponse.json({ ok: report.errors.length === 0, ran_at: new Date().toISOString(), ...report });
}
