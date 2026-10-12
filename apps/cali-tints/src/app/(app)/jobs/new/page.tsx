import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PriceListRow } from "@/lib/db/types";
import { withoutPrices } from "@/lib/jobs/price-list";
import { loadPickerCustomers } from "@/lib/retail/pick";
import { JobForm } from "@/components/jobs/job-form";
import type { RecentJob } from "@/lib/offline/db";
import { isoDaysAgo } from "@/lib/dates";

export const metadata: Metadata = { title: "New job" };

/**
 * New job. Reference data is loaded server-side so the page renders
 * instantly; the client caches it in IndexedDB so the form also works from
 * the service-worker cache with no signal.
 */
export default async function NewJobPage(props: PageProps<"/jobs/new">) {
  const sp = await props.searchParams;
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
      .select("id, tag_number, vin, dealership_id, performed_at, model")
      .is("deleted_at", null)
      .gte("performed_at", since)
      .order("performed_at", { ascending: false })
      .limit(300),
  ]);

  const priceLists: Record<string, PriceListRow[]> = {};
  await Promise.all(
    (dealerships ?? []).map(async (d) => {
      const { data } = await supabase.rpc("dealership_price_list", { p_dealership_id: d.id });
      // No prices on a job: the menu goes to the browser without them (every line is billed at the price list on the invoice).
      priceLists[d.id] = withoutPrices(data ?? []);
    }),
  );

  const recentJobs: RecentJob[] = (recent ?? []).map((j) => ({
    id: j.id,
    tag_number: j.tag_number,
    vin: j.vin,
    dealership_id: j.dealership_id,
    performed_at: j.performed_at,
    model: j.model,
  }));

  // Retail: recent customers with their cars for the picker, and a customer/vehicle handed over from their page.
  const { recent: retailCustomers, initialPick } = await loadPickerCustomers(supabase, sp);

  return <JobForm dealerships={dealerships ?? []} priceLists={priceLists} detailers={detailers ?? []} recentJobs={recentJobs} retailCustomers={retailCustomers} initialPick={initialPick} />;
}
