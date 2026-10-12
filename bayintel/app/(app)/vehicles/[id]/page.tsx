import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, Sparkles, FileText, ClipboardList } from "lucide-react";
import { Page, Empty } from "@/components/shell/page";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { VehicleHeader } from "@/components/vehicles/vehicle-header";
import { RecallsList } from "@/components/vehicles/recalls-list";
import { ComplaintGroups, ComplaintTrendChart } from "@/components/vehicles/complaints-panel";
import { FixCard } from "@/components/fixes/fix-card";
import { SourceBadge } from "@/components/source-badge";
import { getNhtsaBundle, getVehicle } from "@/lib/vehicles/data";
import { groupByComponent, trendByYear } from "@/lib/vehicles/complaints";
import { rankFixes } from "@/lib/fixes/queries";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export default async function VehiclePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> }) {
  const { id } = await params;
  const { tab } = await searchParams;
  const vehicle = await getVehicle(id);
  if (!vehicle) notFound();

  const supabase = await createClient();
  const [nhtsa, fixes, ros] = await Promise.all([
    getNhtsaBundle(vehicle),
    rankFixes({ make: vehicle.make, model: vehicle.model, year: vehicle.year, engine: vehicle.engine, limit: 10 }),
    supabase.from("repair_orders").select("id, ro_number, status, concern, mileage, created_at").eq("vehicle_id", id).order("created_at", { ascending: false }).limit(20),
  ]);
  const groups = groupByComponent(nhtsa.complaints);
  const trend = trendByYear(nhtsa.complaints);
  const specEntries = Object.entries(vehicle.specs as Record<string, string>);

  return (
    <Page>
      <VehicleHeader vehicle={vehicle} />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Button asChild variant="secondary" className="h-14 flex-col gap-0.5 text-xs">
          <Link href={`/dtc?vehicle=${vehicle.id}`}>
            <Activity /> DTC lookup
          </Link>
        </Button>
        <Button asChild variant="secondary" className="h-14 flex-col gap-0.5 text-xs">
          <Link href={`/assistant/new?vehicle=${vehicle.id}`}>
            <Sparkles /> AI diagnose
          </Link>
        </Button>
        <Button asChild variant="secondary" className="h-14 flex-col gap-0.5 text-xs">
          <Link href={`/repair-orders/new?vehicle=${vehicle.id}`}>
            <ClipboardList /> New RO
          </Link>
        </Button>
        <Button asChild variant="secondary" className="h-14 flex-col gap-0.5 text-xs">
          <Link href={`/estimates/new?vehicle=${vehicle.id}`}>
            <FileText /> Estimate
          </Link>
        </Button>
      </div>

      <Tabs defaultValue={tab ?? "overview"}>
        <TabsList>
          <TabsTrigger value="overview">Specs</TabsTrigger>
          <TabsTrigger value="recalls">Recalls {nhtsa.recalls.length ? `(${nhtsa.recalls.length})` : ""}</TabsTrigger>
          <TabsTrigger value="complaints">Complaints {nhtsa.complaints.length ? `(${nhtsa.complaints.length})` : ""}</TabsTrigger>
          <TabsTrigger value="fixes">Fixes {fixes.length ? `(${fixes.length})` : ""}</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="mb-3 grid grid-cols-3 gap-2 text-center">
            <Stat label="Open recalls" value={nhtsa.errors.recalls ? "—" : nhtsa.recalls.length} tone={nhtsa.recalls.length ? "warn" : "ok"} />
            <Stat label="Complaints" value={nhtsa.errors.complaints ? "—" : nhtsa.complaints.length} />
            <Stat label="Fixes on file" value={fixes.length} />
          </div>
          {specEntries.length ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-border bg-card p-4 text-sm sm:grid-cols-3">
              {specEntries.map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="truncate text-xs text-muted-foreground">{k.replace(/([a-z])([A-Z])/g, "$1 $2")}</dt>
                  <dd className="truncate font-medium" title={v}>
                    {v}
                  </dd>
                </div>
              ))}
              <div className="col-span-full pt-1">
                <SourceBadge source={vehicle.specs_source} />
              </div>
            </dl>
          ) : (
            <Empty title="No decoded specs">This vehicle was entered by year, make and model. Decode its VIN to pull NHTSA specs.</Empty>
          )}
        </TabsContent>

        <TabsContent value="recalls">
          <RecallsList recalls={nhtsa.recalls} error={nhtsa.errors.recalls} />
        </TabsContent>

        <TabsContent value="complaints">
          {nhtsa.errors.complaints ? (
            <Empty title="NHTSA complaint data unavailable">{nhtsa.errors.complaints}</Empty>
          ) : !nhtsa.complaints.length ? (
            <Empty title="No owner complaints on file with NHTSA" />
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-card p-4">
                <ComplaintTrendChart data={trend} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {nhtsa.complaints.length} complaints · grouped by primary component · <SourceBadge source="NHTSA" />
                </p>
              </div>
              <ComplaintGroups groups={groups} total={nhtsa.complaints.length} />
            </div>
          )}
        </TabsContent>

        <TabsContent value="fixes" className="space-y-3">
          {!fixes.length ? (
            <Empty title="No confirmed fixes for this vehicle yet">
              <Link href={`/fixes/new?vehicle=${vehicle.id}`} className="text-primary underline">
                Be the first to submit one
              </Link>
              .
            </Empty>
          ) : (
            fixes.map((f) => <FixCard key={f.fix.id} item={f} />)
          )}
          <Button asChild variant="outline" className="w-full">
            <Link href={`/fixes/new?vehicle=${vehicle.id}`}>Submit a confirmed fix</Link>
          </Button>
        </TabsContent>

        <TabsContent value="history" className="space-y-3">
          {!ros.data?.length ? (
            <Empty title="No repair orders yet">
              <Link href={`/repair-orders/new?vehicle=${vehicle.id}`} className="text-primary underline">
                Open the first repair order
              </Link>
              .
            </Empty>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
              {ros.data.map((ro) => (
                <li key={ro.id}>
                  <Link href={`/repair-orders/${ro.id}`} className="flex min-h-14 items-center gap-3 px-4 py-2 hover:bg-accent">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">
                        RO #{ro.ro_number} · {ro.concern}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(ro.created_at)}
                        {ro.mileage ? ` · ${ro.mileage.toLocaleString()} mi` : ""}
                      </p>
                    </div>
                    <span className="text-xs uppercase text-muted-foreground">{ro.status.replace("_", " ")}</span>
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

function Stat({ label, value, tone }: { label: string; value: number | string; tone?: "ok" | "warn" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className={`text-2xl font-bold tabular-nums ${tone === "warn" ? "text-warning" : tone === "ok" ? "text-success" : ""}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
