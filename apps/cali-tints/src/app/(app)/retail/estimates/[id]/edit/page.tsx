import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { JobFinding } from "@/lib/db/types";
import { linesFromFindings } from "@/lib/estimates/from-findings";
import { loadPickerCustomers } from "@/lib/retail/pick";
import { appUrl } from "@/lib/retail/email";
import { recommendableServices, withMediaUrls } from "@/lib/retail/findings-panel";
import { EstimateFindingsPanel } from "@/components/retail/estimate-findings-panel";
import { EstimateBuilder } from "@/components/retail/estimate-builder";

export const metadata: Metadata = { title: "Edit estimate" };

/** Edit a draft or a sent estimate (editing a sent one puts it back to draft until it is sent again). */
export default async function EditEstimatePage(props: PageProps<"/retail/estimates/[id]/edit">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const session = await getSession();
  if (!session.canPrices) redirect(`/retail/estimates/${id}`);
  const supabase = await createClient();
  const [{ data: e }, { data: catalog }, picker] = await Promise.all([supabase.rpc("estimate_detail", { p_id: id }), supabase.rpc("retail_catalog"), loadPickerCustomers(supabase, { customer: undefined })]);
  if (!e || !catalog) notFound();
  // Once approved it is a work order: no edits (more work is a new extra-work estimate the customer approves, 0064).
  if (e.status === "accepted" || e.status === "declined" || e.applied_at || (e.kind !== "supplement" && e.job_id)) redirect(`/retail/estimates/${id}`);
  const withCustomer = picker.recent.some((c) => c.id === e.customer.id) ? picker : await loadPickerCustomers(supabase, { customer: e.customer.id, vehicle: e.vehicle?.id });
  // The findings side tab (and "Add to this estimate" on a recommendation: ?findings=<id,...> appends their lines).
  const ids = typeof sp.findings === "string" ? sp.findings.split(",").filter(Boolean) : [];
  const [{ data: rawFindings }, services, { data: token }] = await Promise.all([supabase.rpc("estimate_findings", { p_estimate: id }), recommendableServices(supabase), supabase.rpc("estimate_link", { p_id: id })]);
  const findings = await withMediaUrls(supabase, rawFindings ?? []);
  const extraLines = ids.length ? linesFromFindings(findings as JobFinding[], ids, catalog) : undefined;
  const panel = <EstimateFindingsPanel e={e} findings={findings} services={services} canPrices={session.canPrices} isAdmin={session.isAdmin} userId={session.userId} findingsUrl={token ? `${appUrl() ?? ""}/e/${token}` : null} large />; // no "add to estimate" icon here: the builder holds the lines, and saving it would overwrite a line added behind its back
  return <EstimateBuilder catalog={catalog} recent={withCustomer.initialPick?.customer ? [withCustomer.initialPick.customer, ...withCustomer.recent.filter((c) => c.id !== e.customer.id)] : withCustomer.recent} estimate={e} extraLines={extraLines} findingsPanel={panel} findingsCount={findings.length} />;
}
