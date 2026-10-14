import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/** An old invoice link (addressed by its hidden repair-order id) opens the estimate that became it. */
export default async function RetailInvoiceRedirect(props: PageProps<"/retail/invoices/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data: estimate } = await supabase.rpc("job_primary_estimate", { p_job: id });
  if (!estimate) notFound();
  redirect(`/retail/estimates/${estimate}`);
}
