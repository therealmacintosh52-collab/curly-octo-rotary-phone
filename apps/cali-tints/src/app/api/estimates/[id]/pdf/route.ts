import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateAssets, estimateFileStem } from "@/lib/estimates/load";
import { estimatePdf } from "@/lib/estimates/pdf";
import { logStaffView } from "@/lib/retail/activity";

export const runtime = "nodejs";

/** GET /api/estimates/:id/pdf — the staff copy. Owner and admin only: the PDF carries the prices. */
export async function GET(req: Request, ctx: RouteContext<"/api/estimates/[id]/pdf">) {
  const session = await getSession();
  if (!session.canPrices) return NextResponse.json({ error: "Owner or admin only" }, { status: 403 });
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: e, error } = await supabase.rpc("estimate_detail", { p_id: id });
  if (error || !e) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logStaffView(supabase, e.id, "pdf");
  const assets = await estimateAssets(createAdminClient(), e);
  const pdf = await estimatePdf(e, assets.logoDataUri, assets.signatureDataUri);
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${estimateFileStem(e)}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
