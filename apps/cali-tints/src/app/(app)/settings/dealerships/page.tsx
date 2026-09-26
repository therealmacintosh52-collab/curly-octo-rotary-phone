import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DealershipsManager } from "@/components/settings/dealerships-manager";

export const metadata: Metadata = { title: "Dealerships" };

export default async function DealershipsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("dealerships").select("*").order("active", { ascending: false }).order("name");
  return <DealershipsManager dealerships={data ?? []} />;
}
