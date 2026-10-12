import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Vehicle } from "@/lib/db/types";
import { VehicleDetail } from "@/components/retail/vehicle-detail";

export const metadata: Metadata = { title: "Vehicle" };

type JobRow = { id: string; performed_at: string; tag_number: string; paid_at: string | null; deleted_at: string | null; job_services: { label: string | null; service: { name: string } | null }[] };

export default async function VehiclePage(props: PageProps<"/retail/vehicles/[id]">) {
  const { id } = await props.params;
  const supabase = await createClient();
  const { data: vehicle } = await supabase.from("vehicles").select("*, customer:customers(id, display_name)").eq("id", id).maybeSingle();
  if (!vehicle) notFound();
  const v = vehicle as unknown as Vehicle & { customer: { id: string; display_name: string | null } | null };
  const [{ data: odometer }, { data: jobs }] = await Promise.all([
    supabase.from("odometer_readings").select("id, reading, read_at, job_id").eq("vehicle_id", id).order("read_at", { ascending: false }).limit(50),
    supabase.from("jobs").select("id, performed_at, tag_number, paid_at, deleted_at, job_services(label, service:services(name))").eq("vehicle_id", id).order("performed_at", { ascending: false }).limit(100),
  ]);
  return (
    <VehicleDetail
      data={{
        vehicle: v,
        customer: v.customer ?? { id: v.customer_id, display_name: null },
        odometer: odometer ?? [],
        jobs: ((jobs ?? []) as unknown as JobRow[]).map((j) => ({ id: j.id, performed_at: j.performed_at, tag: j.tag_number, paid_at: j.paid_at, deleted_at: j.deleted_at, services: j.job_services.map((s) => s.label || s.service?.name || "").filter(Boolean) })),
      }}
    />
  );
}
