import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RetailCatalogManager } from "@/components/settings/retail-catalog-manager";

export const metadata: Metadata = { title: "Shop menu" };

/** The shop menu, prices by size and condition add-ons. Owner only: prices are money. */
export default async function RetailSettingsPage() {
  await requireOwner();
  const supabase = await createClient();
  const [{ data, error }, { data: templates }, { data: canned }] = await Promise.all([supabase.rpc("retail_catalog"), supabase.rpc("inspection_templates_list"), supabase.rpc("retail_canned_jobs")]);
  if (error || !data) throw new Error(error?.message ?? "Could not load the catalog");
  return <RetailCatalogManager catalog={data} inspectionTemplates={templates ?? []} cannedJobs={canned ?? []} />;
}
