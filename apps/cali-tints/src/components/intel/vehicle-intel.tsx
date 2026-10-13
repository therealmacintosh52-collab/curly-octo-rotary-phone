import Link from "next/link";
import { ActivityIcon, ArrowLeftIcon, CarFrontIcon, HistoryIcon } from "lucide-react";
import type { NhtsaBundle, DecodedVehicle } from "@/lib/intel/types";
import { groupByComponent, trendByYear } from "@/lib/intel/complaints";
import { Page } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDate } from "@/lib/dates";
import { SourceBadge } from "./source-badge";
import { RecallsList } from "./recalls-list";
import { ComplaintGroups, ComplaintTrendChart } from "./complaints-panel";

export interface VehicleIntelData {
  vehicle: { id: string; name: string; vin: string | null; trim: string | null; engine: string | null; color: string | null; plate: string | null; customer: { id: string; display_name: string | null } | null; specs_source: string | null };
  decoded: DecodedVehicle | null;
  nhtsa: NhtsaBundle;
  /** This app's jobs on the car (the history tab). */
  jobs: { id: string; performed_at: string; tag: string; ro_number: string | null; services: string[]; paid_at: string | null }[];
  tab?: string;
}

/**
 * One car's intelligence: decoded specs, NHTSA recalls and complaints (with
 * the per-year trend and component groups), the shop's history on it. The
 * fixes tab arrives with the fix library.
 */
export function VehicleIntel({ data }: { data: VehicleIntelData }) {
  const { vehicle: v, decoded, nhtsa, jobs } = data;
  const groups = groupByComponent(nhtsa.complaints);
  const trend = trendByYear(nhtsa.complaints);
  const specEntries = Object.entries(decoded?.specs ?? {});
  return (
    <Page>
      <Link href="/intel/garage" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Garage
      </Link>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-title" data-testid="intel-vehicle-name">{v.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{[v.trim, decoded?.engine ?? v.engine, decoded?.driveType, decoded?.transmission].filter(Boolean).join(" · ") || "No decoded details yet"}</p>
          <p className="mt-1 flex flex-wrap items-center gap-2 text-caption text-muted-foreground">
            {v.vin && <span className="font-mono">{v.vin}</span>}
            {v.plate && <span>Plate {v.plate}</span>}
            {v.color && <span>{v.color}</span>}
            {v.customer && (
              <Link href={`/retail/customers/${v.customer.id}`} className="hover:text-foreground">
                {v.customer.display_name ?? "Customer"}
              </Link>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button asChild>
            <Link href={`/intel/dtc?vehicle=${v.id}`} data-testid="intel-vehicle-codes">
              <ActivityIcon /> Look up codes
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/retail/vehicles/${v.id}`}>
              <CarFrontIcon /> Customer record
            </Link>
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 sm:max-w-md">
        <Stat label="Recalls" value={nhtsa.errors.recalls ? "—" : nhtsa.recalls.length} tone={nhtsa.recalls.length ? "warn" : "ok"} testId="intel-stat-recalls" />
        <Stat label="Complaints" value={nhtsa.errors.complaints ? "—" : nhtsa.complaints.length} testId="intel-stat-complaints" />
        <Stat label="Visits here" value={jobs.length} />
      </div>

      <Tabs defaultValue={data.tab ?? "specs"} className="mt-5">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="specs">Specs</TabsTrigger>
          <TabsTrigger value="recalls" data-testid="intel-tab-recalls">Recalls{nhtsa.recalls.length ? ` (${nhtsa.recalls.length})` : ""}</TabsTrigger>
          <TabsTrigger value="complaints" data-testid="intel-tab-complaints">Complaints{nhtsa.complaints.length ? ` (${nhtsa.complaints.length})` : ""}</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="specs">
          {specEntries.length ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-3" data-testid="intel-specs">
              {specEntries.map(([k, val]) => (
                <div key={k} className="min-w-0">
                  <dt className="truncate text-caption text-muted-foreground">{k.replace(/([a-z])([A-Z])/g, "$1 $2")}</dt>
                  <dd className="truncate font-medium" title={val}>
                    {val}
                  </dd>
                </div>
              ))}
              <div className="col-span-full pt-1">
                <SourceBadge source="NHTSA" />
              </div>
            </dl>
          ) : (
            <EmptyState icon={CarFrontIcon} title="No decoded specs" description={v.vin ? "NHTSA did not answer for this VIN yet; open the page again in a moment." : "This car has no VIN on file. Add it on the customer record and the specs decode on their own."} />
          )}
        </TabsContent>

        <TabsContent value="recalls">
          <RecallsList recalls={nhtsa.recalls} error={nhtsa.errors.recalls} />
        </TabsContent>

        <TabsContent value="complaints">
          {nhtsa.errors.complaints ? (
            <EmptyState tone="error" title="NHTSA complaint data unavailable" description={nhtsa.errors.complaints} />
          ) : !nhtsa.complaints.length ? (
            <EmptyState title="No owner complaints on file with NHTSA" />
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <ComplaintTrendChart data={trend} />
                <p className="mt-2 flex items-center gap-2 text-caption text-muted-foreground">
                  {nhtsa.complaints.length} complaints · grouped by primary component <SourceBadge source="NHTSA" />
                </p>
              </div>
              <ComplaintGroups groups={groups} total={nhtsa.complaints.length} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="history">
          {!jobs.length ? (
            <EmptyState icon={HistoryIcon} title="No visits logged on this car yet" />
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card" data-testid="intel-history">
              {jobs.map((j) => (
                <li key={j.id}>
                  <Link href={`/jobs/${j.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-accent/60">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{j.ro_number ?? j.tag} · {j.services.join(", ") || "No services"}</p>
                      <p className="text-caption text-muted-foreground">{formatDate(j.performed_at)}</p>
                    </div>
                    <Badge variant={j.paid_at ? "secondary" : "outline"}>{j.paid_at ? "Paid" : "Open"}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </Page>
  );
}

function Stat({ label, value, tone, testId }: { label: string; value: number | string; tone?: "ok" | "warn"; testId?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3" data-testid={testId}>
      <p className={`text-2xl font-bold tabular-nums ${tone === "warn" ? "text-warning" : tone === "ok" ? "text-success" : ""}`}>{value}</p>
      <p className="text-caption text-muted-foreground">{label}</p>
    </div>
  );
}
