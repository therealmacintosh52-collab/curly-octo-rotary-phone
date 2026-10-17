import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { estimateFileStem } from "@/lib/estimates/load";
import { oilStickerOptions } from "@/lib/labels/fields";
import { oilStickerPdf } from "@/lib/labels/pdf";

export const runtime = "nodejs";

/** GET /api/estimates/:id/oil-sticker?miles=5000&months=6&oil=5W-30 — a 3 × 2 in oil change sticker. No money on it, so any member may print it. */
export async function GET(req: Request, ctx: RouteContext<"/api/estimates/[id]/oil-sticker">) {
  await getSession();
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: e, error } = await supabase.rpc("estimate_detail", { p_id: id });
  if (error || !e) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const url = new URL(req.url);
  const pdf = await oilStickerPdf(e, oilStickerOptions(url.searchParams));
  const inline = url.searchParams.get("inline") === "1";
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="oil-sticker-${estimateFileStem(e)}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
