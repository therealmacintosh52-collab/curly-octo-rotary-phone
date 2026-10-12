import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { closeMonth } from "@/lib/invoices/submit";
import { syncQuickBooks } from "@/lib/quickbooks/sync";
import { errorMessage } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * The daily job (Vercel Cron, 7am Pacific). For every company: close any
 * month that has ended (one invoice per dealership), email each new invoice
 * to the dealership when the company wants that, then QuickBooks: send the
 * invoices that are not there yet and record the payments it has seen.
 * Idempotent.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 500 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = createAdminClient();
  const { data: companies, error } = await db.from("companies").select("id, name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const out: Record<string, unknown>[] = [];
  for (const c of companies ?? []) {
    try {
      const r = await closeMonth(db, c.id);
      const q = await syncQuickBooks(db, c.id);
      out.push({ company: c.name, invoices: r.created.length, emailed: r.emailed, emailErrors: r.emailErrors, quickbooks: q.notConnected ? "not connected" : { pushed: q.pushed.length, pushErrors: q.pushErrors, paymentsRecorded: q.paymentsRecorded, pullErrors: q.pullErrors } });
    } catch (err) {
      out.push({ company: c.name, error: errorMessage(err) });
    }
  }
  return NextResponse.json({ ok: true, ran_at: new Date().toISOString(), companies: out });
}
