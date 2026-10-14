import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/retail/email";
import { recommendableServices, withMediaUrls } from "@/lib/retail/findings-panel";
import { EstimateDetail } from "@/components/retail/estimate-detail";
import { EstimateFindingsPanel } from "@/components/retail/estimate-findings-panel";
import { findingPricing } from "@/lib/retail/finding-quote";

export const metadata: Metadata = { title: "Estimate" };

export default async function EstimatePage(props: PageProps<"/retail/estimates/[id]">) {
  const { id } = await props.params;
  const session = await getSession();
  const supabase = await createClient();
  const { data: e, error } = await supabase.rpc("estimate_detail", { p_id: id });
  if (error || !e) notFound();
  // The public link: the token is only handed to staff who can send (owner/admin), and only once the estimate exists.
  let publicUrl: string | null = null;
  if (session.canPrices) {
    const { data: token } = await supabase.rpc("estimate_link", { p_id: id });
    if (token) publicUrl = `${appUrl() ?? ""}/e/${token}`;
  }
  // The side panel: what the tech found, on the estimate now and on the invoice after approval. The customer sees it by link.
  const [{ data: rawFindings }, services, { data: catalog }] = await Promise.all([supabase.rpc("estimate_findings", { p_estimate: id }), recommendableServices(supabase), session.canPrices ? supabase.rpc("retail_catalog") : Promise.resolve({ data: null })]);
  const findings = await withMediaUrls(supabase, rawFindings ?? []);
  let findingsUrl = publicUrl;
  if (session.canPrices && e.job_id) {
    const { data: rt } = await supabase.rpc("receipt_link", { p_job_id: e.job_id });
    if (rt) findingsUrl = `${appUrl() ?? ""}/r/${rt}`;
  }
  const notes = <EstimateFindingsPanel e={e} findings={findings} services={services} canPrices={session.canPrices} isAdmin={session.isAdmin} userId={session.userId} findingsUrl={findingsUrl} pricing={catalog ? findingPricing(catalog) : null} />;
  return <EstimateDetail e={e} showMoney={session.canPrices} publicUrl={publicUrl} notes={notes} findingsCount={findings.length} />;
}
