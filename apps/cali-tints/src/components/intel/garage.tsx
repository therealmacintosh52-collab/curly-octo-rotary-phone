"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CarFrontIcon, ScanSearchIcon, SearchIcon, UserPlusIcon } from "lucide-react";
import type { GarageRow } from "@/lib/intel/data";
import type { DecodedVehicle, NhtsaBundle } from "@/lib/intel/types";
import { normalizeVin, vinStatus } from "@/lib/vin";
import { Page, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SourceBadge } from "./source-badge";
import { RecallsList } from "./recalls-list";
import { ComplaintGroups } from "./complaints-panel";
import { groupByComponent } from "@/lib/intel/complaints";

export interface GarageData {
  q: string;
  vehicles: GarageRow[];
  /** A VIN looked up without saving: decode + recalls + complaints. */
  lookup: { vin: string; decoded: DecodedVehicle | null; nhtsa: NhtsaBundle | null; error?: string } | null;
}

const name = (v: { year: number | null; make: string | null; model: string | null }) => [v.year, v.make, v.model].filter(Boolean).join(" ") || "Vehicle";

/** The shop's cars, searchable, plus a VIN lookup for a car that is not on file yet. */
export function Garage({ data }: { data: GarageData }) {
  const router = useRouter();
  const [q, setQ] = useState(data.q);
  const [vin, setVin] = useState(data.lookup?.vin ?? "");
  const status = vinStatus(vin);
  return (
    <Page>
      <PageHeader eyebrow="Intel" title="Garage" description="Every car on file, and a VIN lookup for one that is not." />

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanSearchIcon className="size-4 text-primary" /> Look up a VIN
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const v = normalizeVin(vin);
                if (vinStatus(v) !== "invalid" && v) router.push(`/intel/garage?vin=${encodeURIComponent(v)}`);
              }}
            >
              <Input value={vin} onChange={(e) => setVin(e.target.value.toUpperCase())} placeholder="17-character VIN" className="h-11 font-mono uppercase" autoCapitalize="characters" autoCorrect="off" spellCheck={false} maxLength={18} data-testid="garage-vin" />
              <Button type="submit" className="h-11" disabled={status === "empty" || status === "invalid"} data-testid="garage-vin-go">
                <SearchIcon /> Decode
              </Button>
            </form>
            <p className="mt-1 text-caption text-muted-foreground">{status === "invalid" ? "A VIN has 17 characters and never I, O or Q." : status === "warn" ? "Check digit does not match; some imports are like that." : "Decoded through NHTSA; nothing is saved until you add the car to a customer."}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CarFrontIcon className="size-4 text-primary" /> Cars on file
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                router.push(q.trim() ? `/intel/garage?q=${encodeURIComponent(q.trim())}` : "/intel/garage");
              }}
            >
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by make, model, plate or VIN" className="h-11" data-testid="garage-search" />
              <Button type="submit" variant="outline" className="h-11">
                <SearchIcon /> Search
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {data.lookup && (
        <section className="mt-6" data-testid="garage-lookup">
          {data.lookup.error || !data.lookup.decoded ? (
            <EmptyState tone="error" title="Could not decode that VIN" description={data.lookup.error ?? "NHTSA returned no usable decode."} />
          ) : (
            <div className="space-y-4">
              <Card>
                <CardContent className="pt-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-title" data-testid="garage-lookup-name">{name(data.lookup.decoded)}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{[data.lookup.decoded.trim, data.lookup.decoded.engine, data.lookup.decoded.driveType, data.lookup.decoded.transmission].filter(Boolean).join(" · ")}</div>
                      <div className="mt-1 font-mono text-caption text-muted-foreground">{data.lookup.vin}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <SourceBadge source="NHTSA" />
                      <Button asChild size="sm">
                        <Link href={`/retail/customers/new?vin=${data.lookup.vin}`}>
                          <UserPlusIcon /> Add to a customer
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              {data.lookup.nhtsa && (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div>
                    <h2 className="mb-2 text-label text-subtle">Recalls</h2>
                    <RecallsList recalls={data.lookup.nhtsa.recalls} error={data.lookup.nhtsa.errors.recalls} />
                  </div>
                  <div>
                    <h2 className="mb-2 text-label text-subtle">Complaints by component</h2>
                    {data.lookup.nhtsa.errors.complaints ? <EmptyState tone="error" title="NHTSA complaint data unavailable" description={data.lookup.nhtsa.errors.complaints} /> : data.lookup.nhtsa.complaints.length ? <ComplaintGroups groups={groupByComponent(data.lookup.nhtsa.complaints)} total={data.lookup.nhtsa.complaints.length} /> : <EmptyState title="No owner complaints on file" />}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      <section className="mt-6">
        {data.vehicles.length === 0 ? (
          <EmptyState icon={CarFrontIcon} title={data.q ? "No car matches" : "No cars on file yet"} description={data.q ? "Try the plate, the model or part of the VIN." : "Cars are added on a customer's record (Retail → Customers)."} />
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card" data-testid="garage-list">
            {data.vehicles.map((v) => (
              <li key={v.id}>
                <Link href={`/intel/vehicles/${v.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-accent/60">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{name(v)}</p>
                    <p className="truncate text-caption text-muted-foreground">{[v.customer?.display_name, v.engine, v.plate ? `Plate ${v.plate}` : null, v.vin].filter(Boolean).join(" · ")}</p>
                  </div>
                  <span className="text-caption text-primary">Intel</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Page>
  );
}
