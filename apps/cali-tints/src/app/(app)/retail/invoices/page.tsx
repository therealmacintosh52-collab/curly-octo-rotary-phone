import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Page, PageHeader } from "@/components/app/page-header";
import { RETAIL_INVOICE_PAGE_SIZE, RetailInvoiceList, type RetailInvoiceFilter } from "@/components/retail/retail-invoice-list";

export const metadata: Metadata = { title: "Retail invoices" };

const FILTERS: RetailInvoiceFilter[] = ["open", "paid", "void", "all"];

/** Retail's own invoices (RI-…): one per repair order. Owner, admin and advisor. Never on a dealership invoice, never in QuickBooks. */
export default async function RetailInvoicesPage(props: PageProps<"/retail/invoices">) {
  const session = await getSession();
  if (!session.canPrices) redirect("/retail");
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const status = (FILTERS as string[]).includes(String(sp.status)) ? (sp.status as RetailInvoiceFilter) : "open";
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("retail_invoices_filtered", { p_q: q || null, p_status: status, p_limit: RETAIL_INVOICE_PAGE_SIZE, p_offset: (page - 1) * RETAIL_INVOICE_PAGE_SIZE });
  if (error) throw new Error(error.message);
  return (
    <Page>
      <PageHeader title="Invoices" description="The shop's own invoices: one per repair order, paid at the counter. Apart from the dealerships and QuickBooks." />
      <div className="mt-5">
        <RetailInvoiceList data={data ?? { count: 0, unpaid_total: 0, rows: [] }} page={page} q={q} status={status} />
      </div>
    </Page>
  );
}
