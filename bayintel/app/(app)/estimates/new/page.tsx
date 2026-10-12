import { Page } from "@/components/shell/page";
import { EstimateForm, type EstimateFormInitial } from "@/components/estimates/estimate-form";
import { createClient, getProfile } from "@/lib/supabase/server";

export const metadata = { title: "New estimate" };

export default async function NewEstimatePage({ searchParams }: { searchParams: Promise<{ vehicle?: string; ro?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const profile = await getProfile();
  const [{ data: garage }, { data: shop }] = await Promise.all([
    supabase.from("vehicles").select("id, year, make, model, nickname").order("updated_at", { ascending: false }).limit(100),
    profile?.shop_id ? supabase.from("shops").select("labor_rate, tax_rate").eq("id", profile.shop_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const vehicles = (garage ?? []).map((v) => ({ id: v.id, label: `${v.nickname ? v.nickname + " · " : ""}${v.year} ${v.make} ${v.model}`, year: v.year, make: v.make, model: v.model }));
  const initial: EstimateFormInitial = { vehicle_id: sp.vehicle ?? null, labor_rate: Number(shop?.labor_rate ?? 120), tax_rate: Number(shop?.tax_rate ?? 0.0825) };

  if (sp.ro) {
    const { data: ro } = await supabase.from("repair_orders").select("id, vehicle_id, customer_name, concern, correction, labor_hours, parts").eq("id", sp.ro).maybeSingle();
    if (ro) {
      const parts = (ro.parts as { name: string; part_number: string | null; quantity: number; unit_price: number | null }[]) ?? [];
      initial.repair_order_id = ro.id;
      initial.vehicle_id = ro.vehicle_id;
      initial.customer_name = ro.customer_name;
      initial.lines = [
        { kind: "labor", description: ro.correction || ro.concern, part_number: null, quantity: 1, unit_price: initial.labor_rate, hours: ro.labor_hours == null ? 1 : Number(ro.labor_hours) },
        ...parts.map((p) => ({ kind: "part" as const, description: p.name, part_number: p.part_number, quantity: p.quantity, unit_price: p.unit_price ?? 0, hours: null })),
      ];
    }
  }
  return (
    <Page title="New estimate">
      <EstimateForm vehicles={vehicles} initial={initial} />
    </Page>
  );
}
