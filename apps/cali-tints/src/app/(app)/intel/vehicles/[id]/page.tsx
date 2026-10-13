import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VehicleIntel } from "@/components/intel/vehicle-intel";
import { ensureSpecs, getIntelVehicle, vehicleKeyOf, vehicleName } from "@/lib/intel/data";
import { getNhtsaBundle } from "@/lib/intel/nhtsa";

export const metadata: Metadata = { title: "Vehicle intel" };

type JobRow = { id: string; performed_at: string; tag_number: string; ro_number: string | null; paid_at: string | null; job_services: { label: string | null; service: { name: string } | null }[] };

/** Intel → a car: decoded specs, NHTSA recalls and complaints, the shop's history on it. */
export default async function VehicleIntelPage(props: PageProps<"/intel/vehicles/[id]">) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  const vehicle = await getIntelVehicle(id);
  if (!vehicle) notFound();
  const supabase = await createClient();
  const [decoded, nhtsa, { data: jobs }] = await Promise.all([
    ensureSpecs(vehicle),
    getNhtsaBundle(vehicleKeyOf(vehicle)),
    supabase.from("jobs").select("id, performed_at, tag_number, ro_number, paid_at, job_services(label, service:services(name))").eq("vehicle_id", id).is("deleted_at", null).order("performed_at", { ascending: false }).limit(50),
  ]);
  return (
    <VehicleIntel
      data={{
        vehicle: { id: vehicle.id, name: vehicleName(vehicle), vin: vehicle.vin, trim: vehicle.trim, engine: decoded?.engine ?? vehicle.engine ?? null, color: vehicle.color, plate: vehicle.plate, customer: vehicle.customer, specs_source: vehicle.specs_source ?? null },
        decoded,
        nhtsa,
        jobs: ((jobs ?? []) as unknown as JobRow[]).map((j) => ({ id: j.id, performed_at: j.performed_at, tag: j.tag_number, ro_number: j.ro_number, paid_at: j.paid_at, services: j.job_services.map((s) => s.label || s.service?.name || "").filter(Boolean) })),
        tab: typeof sp.tab === "string" ? sp.tab : undefined,
      }}
    />
  );
}
