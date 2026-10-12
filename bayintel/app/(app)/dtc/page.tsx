import Link from "next/link";
import { Page, Empty } from "@/components/shell/page";
import { DtcForm } from "@/components/dtc/dtc-form";
import { DtcDefinition } from "@/components/dtc/dtc-definition";
import { FixCard } from "@/components/fixes/fix-card";
import { ComplaintList } from "@/components/vehicles/complaints-panel";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { parseDtcList } from "@/lib/utils";
import { fixesForCodes, getDtcDefinitions, inferDtcSystem } from "@/lib/dtc/queries";
import { rankFixes } from "@/lib/fixes/queries";
import { getNhtsaBundle, getVehicle } from "@/lib/vehicles/data";
import { complaintsForComponents, searchComplaints } from "@/lib/vehicles/complaints";
import { DTC_SYSTEM_COMPONENTS, DTC_SYSTEM_LABELS, DTC_SYSTEM_TERMS } from "@/lib/dtc/systems";
import type { Complaint } from "@/lib/providers/types";

export const metadata = { title: "DTC lookup" };

export default async function DtcPage({ searchParams }: { searchParams: Promise<{ codes?: string; vehicle?: string }> }) {
  const sp = await searchParams;
  const codes = parseDtcList(sp.codes ?? "");
  const supabase = await createClient();
  const { data: garage } = await supabase.from("vehicles").select("id, year, make, model, engine, nickname").order("updated_at", { ascending: false }).limit(100);
  const vehicleOptions = (garage ?? []).map((v) => ({ id: v.id, label: `${v.nickname ? v.nickname + " · " : ""}${v.year} ${v.make} ${v.model}${v.engine ? " " + v.engine : ""}` }));

  const vehicle = sp.vehicle ? await getVehicle(sp.vehicle) : null;
  const [defs, nhtsa, fixes] = await Promise.all([
    getDtcDefinitions(codes),
    vehicle && codes.length ? getNhtsaBundle(vehicle) : Promise.resolve(null),
    codes.length
      ? vehicle
        ? rankFixes({ make: vehicle.make, model: vehicle.model, year: vehicle.year, engine: vehicle.engine, codes, limit: 30 })
        : fixesForCodes(codes, 30)
      : Promise.resolve([]),
  ]);

  return (
    <Page title="DTC lookup" subtitle="Definitions, confirmed fixes ranked by net confirmations, and related owner complaints.">
      <section className="rounded-xl border border-border bg-card p-4">
        <DtcForm vehicles={vehicleOptions} initialCodes={codes.join(" ")} initialVehicle={vehicle?.id ?? ""} />
      </section>

      {codes.length > 0 && (
        <div className="mt-6 space-y-8">
          {codes.map((code) => {
            const row = defs.get(code);
            const inferred = row ? undefined : inferDtcSystem(code);
            const system = row?.system ?? inferred!.system;
            const codeFixes = fixes.filter((f) => f.fix.fix_dtcs.some((d) => d.code === code));
            let related: Complaint[] = [];
            if (nhtsa) {
              const byComponent = complaintsForComponents(nhtsa.complaints, DTC_SYSTEM_COMPONENTS[system] ?? []);
              const byTerm = searchComplaints(nhtsa.complaints, DTC_SYSTEM_TERMS[system] ?? []);
              const seen = new Set<string>();
              related = [...byTerm, ...byComponent].filter((c) => (seen.has(c.odiNumber) ? false : (seen.add(c.odiNumber), true))).slice(0, 25);
            }
            return (
              <section key={code} className="space-y-3">
                <DtcDefinition code={code} row={row} inferred={inferred} />

                <h2 className="pt-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Confirmed fixes {vehicle ? `for ${vehicle.year} ${vehicle.make} ${vehicle.model}` : "(all vehicles)"}
                </h2>
                {codeFixes.length ? (
                  <div className="space-y-3">
                    {codeFixes.map((f) => (
                      <FixCard key={f.fix.id} item={f} highlightCodes={[code]} />
                    ))}
                  </div>
                ) : (
                  <Empty title={`No confirmed fixes for ${code}${vehicle ? " on this vehicle" : ""} yet`}>
                    {vehicle && (
                      <Link href={`/dtc?codes=${codes.join(",")}`} className="text-primary underline">
                        Search all vehicles
                      </Link>
                    )}
                  </Empty>
                )}

                {vehicle && (
                  <>
                    <h2 className="pt-1 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      NHTSA complaints mentioning {DTC_SYSTEM_LABELS[system]?.toLowerCase() ?? "this system"}
                    </h2>
                    {nhtsa?.errors.complaints ? (
                      <Empty title="NHTSA complaint data unavailable">{nhtsa.errors.complaints}</Empty>
                    ) : related.length ? (
                      <div className="overflow-hidden rounded-xl border border-border bg-card">
                        <ComplaintList complaints={related} initial={3} />
                      </div>
                    ) : (
                      <Empty title="No related complaints on file" />
                    )}
                  </>
                )}
              </section>
            );
          })}
          <Button asChild variant="outline" className="w-full">
            <Link href={`/fixes/new?${new URLSearchParams({ codes: codes.join(","), ...(vehicle ? { vehicle: vehicle.id } : {}) })}`}>Submit a confirmed fix for {codes.join(", ")}</Link>
          </Button>
          <Button asChild className="w-full">
            <Link href={`/assistant/new?${new URLSearchParams({ codes: codes.join(","), ...(vehicle ? { vehicle: vehicle.id } : {}) })}`}>Ask the AI assistant about these codes</Link>
          </Button>
        </div>
      )}
    </Page>
  );
}
