import { NextResponse } from "next/server";
import JSZip from "jszip";
import { invoiceFileStem, loadInvoiceBundle } from "@/lib/invoices/load";
import { invoicePdf } from "@/lib/invoices/pdf";
import { invoiceCsv } from "@/lib/invoices/csv";
import { format } from "date-fns";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/invoices/bulk.zip?ids=a,b,c[&variant=print][&csv=1]
 * Zips the PDFs (and optionally CSVs) of up to 100 invoices. Used after
 * "Generate all pending" in per-job mode.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const ids = (url.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[0-9a-f-]{36}$/i.test(s))
    .slice(0, 100);
  if (ids.length === 0) return NextResponse.json({ error: "No invoice ids" }, { status: 400 });
  const variant = url.searchParams.get("variant") === "print" ? "print" : "branded";
  const withCsv = url.searchParams.get("csv") === "1";

  const zip = new JSZip();
  let count = 0;
  for (const id of ids) {
    const bundle = await loadInvoiceBundle(id);
    if (!bundle) continue;
    const stem = invoiceFileStem(bundle);
    zip.file(`${stem}.pdf`, await invoicePdf(bundle, variant));
    if (withCsv) zip.file(`${stem}.csv`, invoiceCsv(bundle));
    count++;
  }
  if (count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="invoices-${format(new Date(), "yyyy-MM-dd")}-${count}.zip"`,
      "Cache-Control": "private, no-store",
    },
  });
}
