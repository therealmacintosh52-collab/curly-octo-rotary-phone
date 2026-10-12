import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Page, Empty } from "@/components/shell/page";
import { VehicleLookup } from "@/components/vehicles/vehicle-lookup";
import { SourceBadge } from "@/components/source-badge";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils";

export const metadata = { title: "Garage" };

export default async function GaragePage() {
  const supabase = await createClient();
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, vin, year, make, model, trim, engine, nickname, plate, mileage, specs_source, updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);

  return (
    <Page title="Garage" subtitle="Look up a vehicle or open one you saved.">
      <section className="rounded-xl border border-border bg-card p-4">
        <VehicleLookup />
      </section>

      <h2 className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Saved vehicles</h2>
      {!vehicles?.length ? (
        <Empty title="No vehicles yet">Decode a VIN above to add the first one.</Empty>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {vehicles.map((v) => (
            <li key={v.id}>
              <Link href={`/vehicles/${v.id}`} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-accent">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {v.nickname ? `${v.nickname} · ` : ""}
                    {v.year} {v.make} {v.model}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {[v.engine, v.plate, v.vin, v.mileage ? `${v.mileage.toLocaleString()} mi` : null].filter(Boolean).join(" · ") || formatDate(v.updated_at)}
                  </p>
                </div>
                <SourceBadge source={v.specs_source} />
                <ChevronRight className="size-5 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
