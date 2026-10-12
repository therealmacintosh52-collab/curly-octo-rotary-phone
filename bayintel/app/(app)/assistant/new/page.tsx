import { Page } from "@/components/shell/page";
import { DiagnoseForm } from "@/components/ai/diagnose-form";
import { createClient } from "@/lib/supabase/server";
import { parseDtcList } from "@/lib/utils";

export const metadata = { title: "New diagnosis" };

export default async function NewDiagnosisPage({ searchParams }: { searchParams: Promise<{ vehicle?: string; codes?: string }> }) {
  const sp = await searchParams;
  const supabase = await createClient();
  const { data: garage } = await supabase.from("vehicles").select("id, year, make, model, engine, nickname").order("updated_at", { ascending: false }).limit(100);
  const vehicles = (garage ?? []).map((v) => ({ id: v.id, label: `${v.nickname ? v.nickname + " · " : ""}${v.year} ${v.make} ${v.model}${v.engine ? " " + v.engine : ""}` }));
  return (
    <Page title="New diagnosis">
      <DiagnoseForm vehicles={vehicles} initialVehicle={sp.vehicle ?? ""} initialCodes={parseDtcList(sp.codes ?? "").join(" ")} />
    </Page>
  );
}
