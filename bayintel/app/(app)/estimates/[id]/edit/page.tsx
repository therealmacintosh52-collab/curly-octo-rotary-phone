import { notFound } from "next/navigation";
import { Page } from "@/components/shell/page";
import { EstimateForm } from "@/components/estimates/estimate-form";
import { createClient } from "@/lib/supabase/server";
import { getEstimate } from "@/lib/estimates/queries";

export default async function EditEstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [e, { data: garage }] = await Promise.all([getEstimate(supabase, id), supabase.from("vehicles").select("id, year, make, model, nickname").order("updated_at", { ascending: false }).limit(100)]);
  if (!e) notFound();
  const vehicles = (garage ?? []).map((v) => ({ id: v.id, label: `${v.nickname ? v.nickname + " · " : ""}${v.year} ${v.make} ${v.model}`, year: v.year, make: v.make, model: v.model }));
  return (
    <Page title={`Edit estimate #${e.estimate_number}`}>
      <EstimateForm
        vehicles={vehicles}
        estimateId={e.id}
        initial={{
          vehicle_id: e.vehicle_id,
          repair_order_id: e.repair_order_id,
          customer_name: e.customer_name,
          customer_email: e.customer_email,
          customer_phone: e.customer_phone,
          labor_rate: Number(e.labor_rate),
          tax_rate: Number(e.tax_rate),
          tax_parts: e.tax_parts,
          tax_labor: e.tax_labor,
          notes: e.notes,
          valid_until: e.valid_until,
          status: e.status,
          lines: [...e.estimate_lines].sort((a, b) => a.sort - b.sort).map((l) => ({ kind: l.kind, description: l.description, part_number: l.part_number, quantity: Number(l.quantity), unit_price: Number(l.unit_price), hours: l.hours == null ? null : Number(l.hours) })),
        }}
      />
    </Page>
  );
}
