import Link from "next/link";
import { BookOpenTextIcon, CarFrontIcon } from "lucide-react";
import type { DtcCode, RecentLookup } from "@/lib/db/types";
import type { Complaint, NhtsaBundle } from "@/lib/intel/types";
import { inferDtcSystem } from "@/lib/intel/dtc";
import { relatedComplaints } from "@/lib/intel/complaints";
import { DTC_SYSTEM_COMPONENTS, DTC_SYSTEM_LABELS, DTC_SYSTEM_TERMS, SAFETY_FLAG_LABELS } from "@/lib/intel/dtc-systems";
import { Page, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DtcLookup, type VehicleOption } from "./dtc-lookup";
import { DtcDefinition } from "./dtc-definition";
import { ComplaintList } from "./complaints-panel";

export interface CodesScreenData {
  codes: string[];
  definitions: Record<string, DtcCode>;
  vehicles: VehicleOption[];
  vehicle: { id: string; name: string } | null;
  /** Recalls and complaints for the picked car (only when codes and a car were given). */
  nhtsa: NhtsaBundle | null;
  recent: RecentLookup[];
}

/**
 * Codes: look up trouble codes. Each code gets its definition, the safety
 * note and the usual causes; with a car picked, the NHTSA owner complaints
 * that touch the same system. The shop's fixes join in the next commit.
 */
export function CodesScreen({ data }: { data: CodesScreenData }) {
  const { codes, definitions, vehicle, nhtsa } = data;
  return (
    <Page>
      <PageHeader eyebrow="Intel" title="Trouble codes" description="Generic OBD-II definitions, safety flags and the usual causes; with a car picked, what owners of the same model reported to NHTSA." />
      <div className="mt-6">
        <DtcLookup vehicles={data.vehicles} initialCodes={codes.join(" ")} initialVehicle={vehicle?.id ?? ""} recent={codes.length ? undefined : data.recent} />
      </div>

      {codes.length === 0 && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Legend />
          <EmptyState icon={CarFrontIcon} title="Pick a car to go further" description="With a car, a code shows the complaints owners filed on that system and, soon, the shop's own fixes ranked for it." action={<Button asChild variant="outline"><Link href="/intel/garage">Open the garage</Link></Button>} />
        </div>
      )}

      {codes.length > 0 && (
        <div className="mt-6 space-y-8" data-testid="dtc-results">
          {codes.map((code) => {
            const row = definitions[code];
            const inferred = row ? undefined : inferDtcSystem(code);
            const system = row?.system ?? inferred!.system;
            const related: Complaint[] = nhtsa ? relatedComplaints(nhtsa.complaints, DTC_SYSTEM_COMPONENTS[system] ?? [], DTC_SYSTEM_TERMS[system] ?? []) : [];
            return (
              <section key={code} className="space-y-3">
                <DtcDefinition code={code} row={row} inferred={inferred} />
                {vehicle && (
                  <>
                    <h2 className="pt-1 text-label text-subtle">
                      What {vehicle.name} owners reported to NHTSA about {DTC_SYSTEM_LABELS[system]?.toLowerCase() ?? "this system"}
                    </h2>
                    {nhtsa?.errors.complaints ? (
                      <EmptyState tone="error" title="NHTSA complaint data unavailable" description={nhtsa.errors.complaints} />
                    ) : related.length ? (
                      <div className="overflow-hidden rounded-xl border border-border bg-card">
                        <ComplaintList complaints={related} initial={3} />
                      </div>
                    ) : (
                      <EmptyState title="No related complaints on file" description="Nothing filed with NHTSA mentions this system for this model year." />
                    )}
                  </>
                )}
              </section>
            );
          })}
          {vehicle && (
            <Button asChild variant="outline">
              <Link href={`/intel/vehicles/${vehicle.id}`}>
                <CarFrontIcon /> {vehicle.name}: recalls, complaints, specs
              </Link>
            </Button>
          )}
        </div>
      )}
    </Page>
  );
}

function Legend() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 text-sm">
      <div className="flex items-center gap-2 font-semibold">
        <BookOpenTextIcon className="size-4 text-primary" /> What a code tells you
      </div>
      <ul className="mt-2 space-y-1 text-muted-foreground">
        <li>
          <span className="font-mono text-foreground">P</span> powertrain · <span className="font-mono text-foreground">B</span> body · <span className="font-mono text-foreground">C</span> chassis · <span className="font-mono text-foreground">U</span> network
        </li>
        <li>
          <span className="font-mono text-foreground">P0xxx</span> generic (every make) · <span className="font-mono text-foreground">P1xxx</span> manufacturer-specific
        </li>
        <li>
          Safety systems are flagged: {Object.values(SAFETY_FLAG_LABELS).map((s) => s.label).join(", ")}.
        </li>
      </ul>
    </div>
  );
}
