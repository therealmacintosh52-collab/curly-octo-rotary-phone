import { notFound } from "next/navigation";
import { Page } from "@/components/shell/page";
import { RoForm } from "@/components/repair-orders/ro-form";
import { createClient } from "@/lib/supabase/server";

export default async function EditRoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: ro } = await supabase.from("repair_orders").select("*, vehicles(id, year, make, model, nickname, mileage), repair_order_media(storage_path, caption)").eq("id", id).maybeSingle();
  if (!ro || !ro.vehicles) notFound();
  const v = ro.vehicles;
  return (
    <Page title={`Edit RO #${ro.ro_number}`}>
      <RoForm
        vehicles={[{ id: v.id, label: `${v.nickname ? v.nickname + " · " : ""}${v.year} ${v.make} ${v.model}`, mileage: v.mileage }]}
        roId={ro.id}
        initial={{
          vehicle_id: ro.vehicle_id,
          status: ro.status,
          mileage: ro.mileage,
          customer_name: ro.customer_name,
          concern: ro.concern,
          cause: ro.cause,
          correction: ro.correction,
          dtc_codes: ro.dtc_codes,
          tests_performed: (ro.tests_performed as { test: string; result: string }[]) ?? [],
          parts: (ro.parts as { name: string; part_number: string | null; quantity: number; unit_price: number | null }[]) ?? [],
          labor_hours: ro.labor_hours == null ? null : Number(ro.labor_hours),
          notes: ro.notes,
          media: ro.repair_order_media,
        }}
      />
    </Page>
  );
}
