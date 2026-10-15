import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { anonClient, isTokenShape } from "@/lib/estimates/public";
import { receiptAssets, receiptFileStem } from "@/lib/receipts/load";
import { receiptPdf } from "@/lib/receipts/pdf";
import { logCustomerView } from "@/lib/retail/activity";

export const runtime = "nodejs";

/** GET /api/r/:token/pdf — the customer's receipt. */
export async function GET(req: Request, ctx: RouteContext<"/api/r/[token]/pdf">) {
  const { token } = await ctx.params;
  if (!isTokenShape(token)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const client = anonClient();
  const { data: r, error } = await client.rpc("receipt_by_token", { p_token: token });
  if (error || !r) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await logCustomerView(client, token, "pdf");
  const assets = await receiptAssets(createAdminClient(), r);
  const pdf = await receiptPdf(r, assets.logoDataUri, assets.signatureDataUri);
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${receiptFileStem(r)}.pdf"`, "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" } });
}
