import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RetailInvoiceDetail } from "@/components/retail/retail-invoice-detail";

export const metadata: Metadata = { title: "Retail invoice" };

/** One retail invoice, addressed by its repair order's id. */
export default async function RetailInvoicePage(props: PageProps<"/retail/invoices/[id]">) {
  const { id } = await props.params;
  const session = await getSession();
  if (!session.canPrices) redirect("/retail");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("retail_invoice_detail", { p_job_id: id });
  if (error || !data) notFound();
  return <RetailInvoiceDetail inv={data} />;
}
