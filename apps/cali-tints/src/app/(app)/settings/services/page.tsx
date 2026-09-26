import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { ServicesManager } from "@/components/settings/services-manager";

export const metadata: Metadata = { title: "Services & prices" };

export default async function ServicesPage() {
  const supabase = await createClient();
  const [{ data: services }, { data: dealerships }, { data: prices }] = await Promise.all([
    supabase.from("services").select("*").order("active", { ascending: false }).order("sort_order").order("name"),
    // sort_order already encodes category grouping in the seed; the UI shows the category badge.
    supabase.from("dealerships").select("id, name").eq("active", true).order("name"),
    supabase.from("dealership_service_prices").select("dealership_id, service_id, price"),
  ]);
  return <ServicesManager services={services ?? []} dealerships={dealerships ?? []} prices={prices ?? []} />;
}
