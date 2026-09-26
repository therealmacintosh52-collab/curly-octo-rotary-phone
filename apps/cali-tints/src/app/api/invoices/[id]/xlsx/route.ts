import { NextResponse } from "next/server";
import { invoiceFileStem, loadInvoiceBundle } from "@/lib/invoices/load";
import { invoiceXlsx } from "@/lib/invoices/xlsx";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: RouteContext<"/api/invoices/[id]/xlsx">) {
  const { id } = await ctx.params;
  const bundle = await loadInvoiceBundle(id);
  if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const buf = await invoiceXlsx(bundle);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${invoiceFileStem(bundle)}.xlsx"`,
      "Cache-Control": "private, no-store",
    },
  });
}
