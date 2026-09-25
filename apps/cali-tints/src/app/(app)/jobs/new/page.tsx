import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PriceListRow } from "@/lib/db/types";
import { JobForm } from "@/components/jobs/job-form";
import type { RecentJob } from "@/lib/offline/db";
import { isoDaysAgo } from "@/lib/dates";

export const metadata: Metadata = { title: "Log a job" };

/**
 * Quick Job Entry. Reference data is loaded server-side so the page renders
 * instantly; the client caches it in IndexedDB so the form also works from
 * the service-worker cache with no signal.
 */
export default async function NewJobPage() {
  const session = await getSession();
  const supabase = await createClient();

  const since = isoDaysAgo(7);
  const [{ data: dealerships }, { data: detailers }, { data: recent }] = await Promise.all([
    supabase.from("dealerships").select("*").eq("active", true).order("name"),
    session.isAdmin
      ? supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name")
      : Promise.resolve({ data: [{ id: session.profile.id, full_name: session.profile.full_name }] }),
    supabase
      .from("jobs")
      .select("id, tag_number, vin, dealership_id, performed_at, model, detailer:profiles!jobs_detailer_id_fkey(full_name)")
      .is("deleted_at", null)
      .gte("performed_at", since)
      .order("performed_at", { ascending: false })
      .limit(300),
  ]);

  const priceLists: Record<string, PriceListRow[]> = {};
  await Promise.all(
    (dealerships ?? []).map(async (d) => {
      const { data } = await supabase.rpc("dealership_price_list", { p_dealership_id: d.id });
      priceLists[d.id] = data ?? [];
    }),
  );

  const recentJobs: RecentJob[] = (recent ?? []).map((j) => ({
    id: j.id,
    tag_number: j.tag_number,
    vin: j.vin,
    dealership_id: j.dealership_id,
    performed_at: j.performed_at,
    model: j.model,
    detailer_name: (j.detailer as unknown as { full_name: string } | null)?.full_name ?? "",
  }));

  return <JobForm dealerships={dealerships ?? []} priceLists={priceLists} detailers={detailers ?? []} recentJobs={recentJobs} />;
}
