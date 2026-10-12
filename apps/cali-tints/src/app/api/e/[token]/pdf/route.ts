import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { estimateAssets, estimateFileStem } from "@/lib/estimates/load";
import { estimatePdf } from "@/lib/estimates/pdf";
import { loadPublicEstimate } from "@/lib/estimates/public";

export const runtime = "nodejs";

/** GET /api/e/:token/pdf — the customer's copy, same numbers as the page. */
export async function GET(req: Request, ctx: RouteContext<"/api/e/[token]/pdf">) {
  const { token } = await ctx.params;
  const e = await loadPublicEstimate(token);
  if (!e) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const assets = await estimateAssets(createAdminClient(), e);
  const pdf = await estimatePdf(e, assets.logoDataUri, assets.signatureDataUri);
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${estimateFileStem(e)}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
