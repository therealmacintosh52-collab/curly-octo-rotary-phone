import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Vehicle } from "@/lib/db/types";
import { VehicleDetail } from "@/components/retail/vehicle-detail";

export const metadata: Metadata = { title: "Vehicle" };

export default async function VehiclePage(props: PageProps<"/retail/vehicles/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data: vehicle } = await supabase.from("vehicles").select("*, customer:customers(id, display_name)").eq("id", id).maybeSingle();
  if (!vehicle) notFound();
  const v = vehicle as unknown as Vehicle & { customer: { id: string; display_name: string | null } | null };
  const [{ data: odometer }, { data: list }] = await Promise.all([
    supabase.from("odometer_readings").select("id, reading, read_at, job_id").eq("vehicle_id", id).order("read_at", { ascending: false }).limit(50),
    supabase.rpc("estimates_filtered", { p_customer: v.customer_id, p_status: "all", p_limit: 200 }),
  ]);
  return <VehicleDetail data={{ vehicle: v, customer: v.customer ?? { id: v.customer_id, display_name: null }, odometer: odometer ?? [], visits: (list?.rows ?? []).filter((r) => r.vehicle_id === id) }} />;
}
