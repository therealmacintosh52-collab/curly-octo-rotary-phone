import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { receiptAssets, receiptFileStem } from "@/lib/receipts/load";
import { receiptPdf } from "@/lib/receipts/pdf";

export const runtime = "nodejs";

/** GET /api/receipts/:id/pdf — the staff copy of a retail job's receipt (owner/admin: it carries the prices). */
export async function GET(req: Request, ctx: RouteContext<"/api/receipts/[id]/pdf">) {
  const session = await getSession();
  if (!session.canPrices) return NextResponse.json({ error: "Owner or admin only" }, { status: 403 });
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: r, error } = await supabase.rpc("job_receipt", { p_job_id: id });
  if (error || !r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const assets = await receiptAssets(createAdminClient(), r);
  const pdf = await receiptPdf(r, assets.logoDataUri, assets.signatureDataUri);
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${receiptFileStem(r)}.pdf"`, "Cache-Control": "private, no-store" } });
}
