import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { JobFinding } from "@/lib/db/types";
import { linesFromFindings } from "@/lib/estimates/from-findings";
import { loadPickerCustomers } from "@/lib/retail/pick";
import { EstimateBuilder } from "@/components/retail/estimate-builder";

export const metadata: Metadata = { title: "New estimate" };

/**
 * Owner, admin and advisor write estimates (they carry prices). `?customer=&vehicle=`
 * arrives from a customer's page; `?job=&findings=` from a repair order's notes tab.
 */
export default async function NewEstimatePage(props: PageProps<"/retail/estimates/new">) {
  const session = await getSession();
  if (!session.canPrices) redirect("/retail/estimates");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const jobId = typeof sp.job === "string" && /^[0-9a-f-]{36}$/i.test(sp.job) ? sp.job : null;
  const { data: job } = jobId ? await supabase.from("jobs").select("id, ro_number, tag_number, customer_id, vehicle_id, deleted_at, dealership:dealerships(retail)").eq("id", jobId).maybeSingle() : { data: null };
  const ro = job && !job.deleted_at && (job.dealership as unknown as { retail: boolean } | null)?.retail ? job : null;
  const [{ data: catalog }, picker, { data: findings }, { data: canned }, { data: technicians }] = await Promise.all([
    supabase.rpc("retail_catalog"),
    loadPickerCustomers(supabase, ro ? { customer: ro.customer_id ?? undefined, vehicle: ro.vehicle_id ?? undefined } : sp),
    ro ? supabase.rpc("job_findings", { p_job: ro.id }) : Promise.resolve({ data: [] as JobFinding[] }),
    supabase.rpc("retail_canned_jobs"),
    supabase.rpc("retail_technicians"),
  ]);
  if (!catalog) redirect("/retail/estimates");
  const ids = typeof sp.findings === "string" ? sp.findings.split(",").filter(Boolean) : [];
  const lines = ro ? linesFromFindings((findings ?? []) as JobFinding[], ids, catalog) : [];
  const initialLines = lines.length ? lines : undefined;
  // The bar at the top of Retail hands over a car that is not on file yet: ?vin=&plate=&year=&make=&model=&odometer=
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).slice(0, 40) : "");
  const carHint = { vin: str("vin"), plate: str("plate"), year: str("year"), make: str("make"), model: str("model"), odometer: str("odometer").replace(/[^\d]/g, "") };
  return <EstimateBuilder key={JSON.stringify(sp)} catalog={catalog} recent={picker.recent} initialPick={picker.initialPick} carHint={carHint} job={ro ? { id: ro.id, ro_number: ro.ro_number ?? null, tag_number: ro.tag_number } : null} initialLines={initialLines} canned={canned ?? []} technicians={technicians ?? []} />;
}
