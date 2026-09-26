import { NextResponse } from "next/server";
import { invoiceFileStem, loadInvoiceBundle } from "@/lib/invoices/load";
import { invoicePdf } from "@/lib/invoices/pdf";

export const runtime = "nodejs";

/** GET /api/invoices/:id/pdf?variant=branded|print — admin only via RLS. */
export async function GET(req: Request, ctx: RouteContext<"/api/invoices/[id]/pdf">) {
  const { id } = await ctx.params;
  const bundle = await loadInvoiceBundle(id);
  if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const variant = new URL(req.url).searchParams.get("variant") === "print" ? "print" : "branded";
  const pdf = await invoicePdf(bundle, variant);
  const stem = invoiceFileStem(bundle) + (variant === "print" ? "-print" : "");
  const inline = new URL(req.url).searchParams.get("inline") === "1";
  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${stem}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
