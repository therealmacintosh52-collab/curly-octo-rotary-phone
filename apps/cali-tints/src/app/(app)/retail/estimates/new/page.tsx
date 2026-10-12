import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadPickerCustomers } from "@/lib/retail/pick";
import { EstimateBuilder } from "@/components/retail/estimate-builder";

export const metadata: Metadata = { title: "New estimate" };

/** Owner and admin write estimates (they carry prices). `?customer=&vehicle=` arrives from a customer's page. */
export default async function NewEstimatePage(props: PageProps<"/retail/estimates/new">) {
  const session = await getSession();
  if (!session.canPrices) redirect("/retail/estimates");
  const sp = await props.searchParams;
  const supabase = await createClient();
  const [{ data: catalog }, picker] = await Promise.all([supabase.rpc("retail_catalog"), loadPickerCustomers(supabase, sp)]);
  if (!catalog) redirect("/retail/estimates");
  return <EstimateBuilder catalog={catalog} recent={picker.recent} initialPick={picker.initialPick} />;
}
