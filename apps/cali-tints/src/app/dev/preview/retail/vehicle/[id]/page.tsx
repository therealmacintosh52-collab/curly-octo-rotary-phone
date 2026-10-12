import { notFound } from "next/navigation";
import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { RetailNav } from "@/components/retail/retail-nav";
import { VehicleDetail } from "@/components/retail/vehicle-detail";
import { vehicleDetailFixture } from "@/test/retail-fixtures";
import { previewSession } from "@/test/preview-session";

/** Fixture preview of one vehicle. */
export default async function DevVehiclePreview(props: PageProps<"/dev/preview/retail/vehicle/[id]">) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  const { session } = previewSession(sp);
  const data = vehicleDetailFixture(id);
  if (!data) notFound();
  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <RetailNav />
          </div>
          <VehicleDetail data={data} />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
