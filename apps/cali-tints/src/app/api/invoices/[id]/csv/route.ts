import { NextResponse } from "next/server";
import { invoiceFileStem, loadInvoiceBundle } from "@/lib/invoices/load";
import { invoiceCsv } from "@/lib/invoices/csv";

export async function GET(_req: Request, ctx: RouteContext<"/api/invoices/[id]/csv">) {
  const { id } = await ctx.params;
  const bundle = await loadInvoiceBundle(id);
  if (!bundle) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(invoiceCsv(bundle), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${invoiceFileStem(bundle)}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}
