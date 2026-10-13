import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { IntelNav } from "@/components/intel/intel-nav";
import { FixForm, type FixFormInitial } from "@/components/intel/fix-form";
import { garageRowsFixture } from "@/test/intel-fixtures";
import { parseDtcList } from "@/lib/intel/dtc";
import { previewSession } from "@/test/preview-session";

/** Fixture preview of the new-fix form (guest demo in production). `?codes=` and `?vehicle=` prefill like the real page. */
export default async function DevIntelNewFixPreview(props: PageProps<"/dev/preview/intel/fixes/new">) {
  const sp = await props.searchParams;
  const { session } = previewSession(sp);
  const rows = garageRowsFixture().filter((r) => r.year && r.make && r.model);
  const vehicles = rows.map((r) => ({ id: r.id, year: r.year!, make: r.make!, model: r.model!, engine: r.engine, label: `${r.year} ${r.make} ${r.model}${r.plate ? ` · ${r.plate}` : ""}${r.customer?.display_name ? ` · ${r.customer.display_name}` : ""}` }));
  const v = vehicles.find((x) => x.id === sp.vehicle);
  const initial: FixFormInitial = { codes: parseDtcList(typeof sp.codes === "string" ? sp.codes : ""), ...(v ? { vehicle_id: v.id, year: v.year, make: v.make, model: v.model, engine: v.engine } : {}) };
  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <IntelNav />
          </div>
          <FixForm vehicles={vehicles} initial={initial} />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
