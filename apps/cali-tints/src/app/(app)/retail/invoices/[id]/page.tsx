import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/retail/email";
import { recommendableServices, withMediaUrls } from "@/lib/retail/findings-panel";
import { RetailInvoiceDetail } from "@/components/retail/retail-invoice-detail";
import { RoNotes } from "@/components/jobs/ro-notes";
import { SendFindings } from "@/components/retail/send-findings";

export const metadata: Metadata = { title: "Retail invoice" };

/** One retail invoice, addressed by its repair order's id, with the findings beside it. */
export default async function RetailInvoicePage(props: PageProps<"/retail/invoices/[id]">) {
  const { id } = await props.params;
  const session = await getSession();
  if (!session.canPrices) redirect("/retail");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("retail_invoice_detail", { p_job_id: id });
  if (error || !data) notFound();
  const [findings, services, { data: estimates }, { data: token }] = await Promise.all([
    withMediaUrls(supabase, data.findings ?? []),
    recommendableServices(supabase),
    supabase.rpc("job_estimates", { p_job: id }),
    supabase.rpc("receipt_link", { p_job_id: id }),
  ]);
  const estimate = (estimates ?? [])[0];
  const notes = (
    <RoNotes
      jobId={id}
      roNumber={data.ro_number}
      findings={findings}
      fromLastTime={[]}
      services={services}
      canWrite={!data.deleted && data.status !== "paid"}
      canDeleteAny
      userId={session.userId}
      canQuote
      jobOpen={!data.deleted && data.status !== "paid"}
      extra={
        estimate && token ? (
          <SendFindings estimateId={estimate.id} firstName={data.customer?.first_name ?? ""} vehicle={data.vehicle} phone={data.customer?.phone ?? null} email={data.customer?.email ?? null} url={`${appUrl() ?? ""}/r/${token}`} sentAt={null} count={findings.filter((f) => f.customer_visible !== false).length} />
        ) : null
      }
    />
  );
  return <RetailInvoiceDetail inv={data} notes={notes} findingsCount={findings.length} />;
}
