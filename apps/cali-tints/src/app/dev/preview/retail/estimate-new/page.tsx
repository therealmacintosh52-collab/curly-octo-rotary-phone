import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { RetailNav } from "@/components/retail/retail-nav";
import { EstimateBuilder } from "@/components/retail/estimate-builder";
import type { CustomerPick } from "@/components/retail/customer-picker";
import { pickedCustomersFixture, retailCatalogFixture } from "@/test/retail-fixtures";
import { previewSession } from "@/test/preview-session";

/** Fixture preview of the estimate builder (owner/admin). `?customer=&vehicle=` arrives from a customer's page. */
export default async function DevEstimateNewPreview(props: PageProps<"/dev/preview/retail/estimate-new">) {
  const sp = await props.searchParams;
  const { session, canPrices } = previewSession(sp);
  const recent = pickedCustomersFixture();
  const picked = typeof sp.customer === "string" ? recent.find((c) => c.id === sp.customer) : undefined;
  const initialPick: CustomerPick | null = picked ? { customer: picked, vehicleId: typeof sp.vehicle === "string" && picked.vehicles.some((v) => v.id === sp.vehicle) ? sp.vehicle : picked.vehicles.length === 1 ? picked.vehicles[0].id : null } : null;
  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <RetailNav />
          </div>
          <EstimateBuilder catalog={retailCatalogFixture(canPrices)} recent={recent} initialPick={initialPick} />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
