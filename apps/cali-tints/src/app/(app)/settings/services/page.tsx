import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Service } from "@/lib/db/types";
import { ServicesManager } from "@/components/settings/services-manager";

export const metadata: Metadata = { title: "Services & prices" };

/** The menu and its prices. Owner only: prices are money. */
export default async function ServicesPage() {
  await requireOwner();
  const supabase = await createClient();
  const [{ data: services }, { data: servicePrices }, { data: dealerships }, { data: prices }] = await Promise.all([
    // The price columns are not readable on the table itself; they come from the owner's view.
    supabase.from("services").select("id, company_id, name, description, category, active, sort_order, created_at, updated_at").order("active", { ascending: false }).order("sort_order").order("name"),
    supabase.from("service_prices_v").select("service_id, default_price, price_min, price_max"),
    // sort_order already encodes category grouping in the seed; the UI shows the category badge.
    supabase.from("dealerships").select("id, name").eq("active", true).order("name"),
    supabase.from("dealership_service_prices").select("dealership_id, service_id, price"),
  ]);
  const priceOf = new Map((servicePrices ?? []).map((p) => [p.service_id, p]));
  const rows: Service[] = (services ?? []).map((s) => ({ ...s, default_price: Number(priceOf.get(s.id)?.default_price ?? 0), price_min: priceOf.get(s.id)?.price_min ?? null, price_max: priceOf.get(s.id)?.price_max ?? null }));
  return <ServicesManager services={rows} dealerships={dealerships ?? []} prices={prices ?? []} />;
}
