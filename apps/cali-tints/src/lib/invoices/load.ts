import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Company, Dealership, Invoice, InvoiceItem, InvoicePayment, InvoiceSubmission } from "@/lib/db/types";

/** Everything the PDF / CSV / XLSX / email renderers need for one invoice. */
export interface InvoiceBundle {
  invoice: Invoice;
  items: InvoiceItem[];
  payments: InvoicePayment[];
  submissions: (InvoiceSubmission & { created_by_name: string | null })[];
  company: Company;
  dealership: Dealership;
  /** Uploaded company logo as a data URI, if any (falls back to the bundled mark). */
  logoDataUri: string | null;
}

/** Load an invoice with all related rows. Returns null when not found / not visible under RLS. */
export async function loadInvoiceBundle(id: string): Promise<InvoiceBundle | null> {
  const supabase = await createClient();
  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", id).maybeSingle();
  if (!invoice) return null;

  const [{ data: items }, { data: payments }, { data: submissions }, { data: company }, { data: dealership }] = await Promise.all([
    supabase.from("invoice_items").select("*").eq("invoice_id", id).order("sort_order"),
    supabase.from("invoice_payments").select("*").eq("invoice_id", id).order("paid_at", { ascending: false }),
    supabase.from("invoice_submissions").select("*").eq("invoice_id", id).order("created_at", { ascending: false }),
    supabase.from("companies").select("*").eq("id", invoice.company_id).single(),
    supabase.from("dealerships").select("*").eq("id", invoice.dealership_id).single(),
  ]);
  if (!company || !dealership) return null;

  const actorIds = Array.from(new Set((submissions ?? []).map((s) => s.created_by).filter((x): x is string => !!x)));
  const { data: actors } = actorIds.length ? await supabase.from("profiles").select("id, full_name").in("id", actorIds) : { data: [] };
  const names = Object.fromEntries((actors ?? []).map((a) => [a.id, a.full_name]));

  let logoDataUri: string | null = null;
  if (company.logo_path) {
    const { data: blob } = await supabase.storage.from("logos").download(company.logo_path);
    if (blob) {
      const buf = Buffer.from(await blob.arrayBuffer());
      logoDataUri = `data:${blob.type || "image/png"};base64,${buf.toString("base64")}`;
    }
  }

  return {
    invoice,
    items: items ?? [],
    payments: payments ?? [],
    submissions: (submissions ?? []).map((s) => ({ ...s, created_by_name: s.created_by ? (names[s.created_by] ?? null) : null })),
    company,
    dealership,
    logoDataUri,
  };
}

/** "Net 30" → 30 days; anything else → null. */
export function netDays(terms: string): number | null {
  const m = /net\s*(\d{1,3})/i.exec(terms);
  return m ? Number(m[1]) : null;
}

/** Compose a single-line address from the parts we store. */
export function formatAddress(a: { address_line1: string | null; address_line2: string | null; city: string | null; state: string | null; postal_code: string | null }): string[] {
  const lines: string[] = [];
  if (a.address_line1) lines.push(a.address_line1);
  if (a.address_line2) lines.push(a.address_line2);
  const cityLine = [a.city, [a.state, a.postal_code].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  if (cityLine) lines.push(cityLine);
  return lines;
}

/** Safe file stem for downloads: INV-000012-Mercedes-Benz-of-Anaheim */
export function invoiceFileStem(b: InvoiceBundle): string {
  const dealer = b.dealership.name.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${b.invoice.display_number}-${dealer}`;
}
