import { notFound } from "next/navigation";
import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { IntelNav } from "@/components/intel/intel-nav";
import { VehicleIntel } from "@/components/intel/vehicle-intel";
import { vehicleIntelFixture } from "@/test/intel-fixtures";
import { previewSession } from "@/test/preview-session";

/** Fixture preview of one car's intel (guest demo in production). */
export default async function DevIntelVehiclePreview(props: PageProps<"/dev/preview/intel/vehicle/[id]">) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  const { session } = previewSession(sp);
  const data = vehicleIntelFixture(id, typeof sp.tab === "string" ? sp.tab : undefined);
  if (!data) notFound();
  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <IntelNav />
          </div>
          <VehicleIntel data={data} />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
