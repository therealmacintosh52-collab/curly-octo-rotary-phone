import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { estimateFileStem } from "@/lib/estimates/load";
import { keyTagPdf } from "@/lib/labels/pdf";

export const runtime = "nodejs";

/** GET /api/estimates/:id/key-tag — a 4 × 2 in key tag. No money on it, so every signed-in member (the tech too) may print it. */
export async function GET(req: Request, ctx: RouteContext<"/api/estimates/[id]/key-tag">) {
  await getSession();
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: e, error } = await supabase.rpc("estimate_detail", { p_id: id });
  if (error || !e) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const pdf = await keyTagPdf(e);
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return new NextResponse(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="key-tag-${estimateFileStem(e)}.pdf"`, "Cache-Control": "private, no-store" },
  });
}
