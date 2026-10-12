import { Page } from "@/components/shell/page";
import { FixForm, type FixFormInitial } from "@/components/fixes/fix-form";
import { createClient } from "@/lib/supabase/server";
import { parseDtcList } from "@/lib/utils";

export const metadata = { title: "Submit a fix" };

export default async function NewFixPage({ searchParams }: { searchParams: Promise<{ vehicle?: string; codes?: string; ro?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: garage } = await supabase.from("vehicles").select("id, year, make, model, engine, mileage, nickname").order("updated_at", { ascending: false }).limit(100);
  const vehicles = (garage ?? []).map((v) => ({ id: v.id, label: `${v.nickname ? v.nickname + " · " : ""}${v.year} ${v.make} ${v.model}`, year: v.year, make: v.make, model: v.model, engine: v.engine, mileage: v.mileage }));

  const initial: FixFormInitial = { codes: parseDtcList(sp.codes ?? "") };
  const v = vehicles.find((x) => x.id === sp.vehicle);
  if (v) Object.assign(initial, { vehicle_id: v.id, year: v.year, make: v.make, model: v.model, engine: v.engine, mileage: v.mileage });

  // One tap from a completed repair order: prefill everything we know.
  if (sp.ro && /^[0-9a-f-]{36}$/i.test(sp.ro)) {
    const { data: ro } = await supabase.from("repair_orders").select("*, vehicles(*)").eq("id", sp.ro).maybeSingle();
    if (ro) {
      const veh = ro.vehicles;
      Object.assign(initial, {
        vehicle_id: ro.vehicle_id,
        repair_order_id: ro.id,
        year: veh?.year,
        make: veh?.make,
        model: veh?.model,
        engine: veh?.engine,
        mileage: ro.mileage ?? veh?.mileage,
        title: ro.cause ? `${ro.dtc_codes.join("/") || ro.concern.slice(0, 40)} - ${ro.cause.slice(0, 60)}` : "",
        symptoms: ro.concern,
        codes: ro.dtc_codes,
        tests_performed: (ro.tests_performed as { test: string; result: string }[]) ?? [],
        root_cause: ro.cause ?? "",
        fix_description: ro.correction ?? "",
        parts: (ro.parts as { name: string; part_number: string | null; quantity: number; unit_price: number | null }[]) ?? [],
        labor_hours: ro.labor_hours,
      });
    }
  }

  return (
    <Page title="Submit a confirmed fix" subtitle="Structured write-ups rank higher and earn reputation when others confirm them.">
      <FixForm vehicles={vehicles} initial={initial} />
    </Page>
  );
}
