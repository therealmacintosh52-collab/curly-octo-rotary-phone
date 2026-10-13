import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { JobFinding } from "@/lib/db/types";
import { linesFromFindings } from "@/lib/estimates/from-findings";
import { estimateLinesFromFix } from "@/lib/intel/fixes";
import { loadPickerCustomers } from "@/lib/retail/pick";
import { EstimateBuilder } from "@/components/retail/estimate-builder";

export const metadata: Metadata = { title: "New estimate" };

/**
 * Owner, admin and advisor write estimates (they carry prices). `?customer=&vehicle=`
 * arrives from a customer's page; `?job=&findings=` from a repair order's notes tab;
 * `?fix=` from a fix in the shop's library (its labor time and parts become lines).
 */
export default async function NewEstimatePage(props: PageProps<"/retail/estimates/new">) {
  const session = await getSession();
  if (!session.canPrices) redirect("/retail/estimates");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const jobId = typeof sp.job === "string" && /^[0-9a-f-]{36}$/i.test(sp.job) ? sp.job : null;
  const { data: job } = jobId ? await supabase.from("jobs").select("id, ro_number, tag_number, customer_id, vehicle_id, deleted_at, dealership:dealerships(retail)").eq("id", jobId).maybeSingle() : { data: null };
  const ro = job && !job.deleted_at && (job.dealership as unknown as { retail: boolean } | null)?.retail ? job : null;
  const [{ data: catalog }, picker, { data: findings }] = await Promise.all([
    supabase.rpc("retail_catalog"),
    loadPickerCustomers(supabase, ro ? { customer: ro.customer_id ?? undefined, vehicle: ro.vehicle_id ?? undefined } : sp),
    ro ? supabase.rpc("job_findings", { p_job: ro.id }) : Promise.resolve({ data: [] as JobFinding[] }),
  ]);
  if (!catalog) redirect("/retail/estimates");
  const ids = typeof sp.findings === "string" ? sp.findings.split(",").filter(Boolean) : [];
  const fixId = typeof sp.fix === "string" && /^[0-9a-f-]{36}$/i.test(sp.fix) ? sp.fix : null;
  const { data: fixLines } = fixId ? await supabase.rpc("fix_estimate_lines", { p_id: fixId }) : { data: null };
  const lines = [...(ro ? linesFromFindings((findings ?? []) as JobFinding[], ids, catalog) : []), ...(fixLines ? estimateLinesFromFix(fixLines) : [])];
  const initialLines = lines.length ? lines : undefined;
  return <EstimateBuilder catalog={catalog} recent={picker.recent} initialPick={picker.initialPick} job={ro ? { id: ro.id, ro_number: ro.ro_number ?? null, tag_number: ro.tag_number } : null} initialLines={initialLines} />;
}
