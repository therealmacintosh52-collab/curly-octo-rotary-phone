import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/retail/email";
import { recommendableServices, withMediaUrls } from "@/lib/retail/findings-panel";
import { loadVisit } from "@/lib/retail/visit";
import { logStaffView } from "@/lib/retail/activity";
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
  const [{ data: rawFindings }, services, { data: catalog }, { data: rawLast }, { data: jobEstimates }, { data: documents }, { data: inspections }, { data: inspectionTemplates }] = await Promise.all([
    supabase.rpc("estimate_findings", { p_estimate: id }),
    recommendableServices(supabase),
    session.canPrices ? supabase.rpc("retail_catalog") : Promise.resolve({ data: null }),
    e.vehicle ? supabase.rpc("vehicle_open_findings", { p_vehicle: e.vehicle.id, p_exclude_job: e.job_id }) : Promise.resolve({ data: [] }),
    e.job_id && e.kind !== "supplement" ? supabase.rpc("job_estimates", { p_job: e.job_id }) : Promise.resolve({ data: [] }),
    supabase.rpc("signed_documents", { p_estimate: id }),
    supabase.rpc("visit_inspections", { p_estimate: id }),
    supabase.rpc("inspection_templates_list"),
  ]);
  const findings = await withMediaUrls(supabase, rawFindings ?? []);
  const fromLastTime = await withMediaUrls(supabase, rawLast ?? []);
  let findingsUrl = publicUrl;
  if (session.canPrices && e.job_id) {
    const { data: rt } = await supabase.rpc("receipt_link", { p_job_id: e.job_id });
    if (rt) findingsUrl = `${appUrl() ?? ""}/r/${rt}`;
  }
  const notes = <EstimateFindingsPanel e={e} findings={findings} services={services} canPrices={session.canPrices} isAdmin={session.isAdmin} userId={session.userId} findingsUrl={findingsUrl} pricing={catalog ? findingPricing(catalog) : null} fromLastTime={fromLastTime} estimates={jobEstimates ?? []} large side />;
  // Once approved, the same page carries the work, the payments and the invoice (the visit's hidden repair-order row, read through the estimate).
  const visit = e.job_id && e.kind !== "supplement" ? await loadVisit(supabase, session, e.job_id) : null;
  // The log: who opened it (this open is written first so it shows), and the whole history for the people who may read it.
  await logStaffView(supabase, e.id, visit?.invoiced ? "invoice" : "estimate");
  const { data: activity } = session.isAdmin ? await supabase.rpc("visit_activity", { p_estimate: e.id }) : { data: null };
  return <EstimateDetail e={e} showMoney={session.canPrices} publicUrl={publicUrl} notes={notes} findingsCount={findings.length} visit={visit} supplements={jobEstimates ?? []} documents={documents ?? []} activity={activity} inspections={inspections ?? []} inspectionTemplates={inspectionTemplates ?? []} />;
}
