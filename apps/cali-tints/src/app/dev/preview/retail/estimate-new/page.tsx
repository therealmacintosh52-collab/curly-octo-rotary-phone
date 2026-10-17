import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { RetailNav } from "@/components/retail/retail-nav";
import { EstimateBuilder } from "@/components/retail/estimate-builder";
import type { CustomerPick } from "@/components/retail/customer-picker";
import { jobFindingsFixture, pickedCustomersFixture, retailCatalogFixture, RETAIL_JOB_CUSTOMER, cannedJobsFixture, inventoryFixture, pastServicesFixture, retailTechniciansFixture } from "@/test/retail-fixtures";
import { linesFromFindings } from "@/lib/estimates/from-findings";
import { previewSession } from "@/test/preview-session";

/** Fixture preview of the estimate builder (owner/admin). `?customer=&vehicle=` arrives from a customer's page. */
export default async function DevEstimateNewPreview(props: PageProps<"/dev/preview/retail/estimate-new">) {
  const sp = await props.searchParams;
  const { session, canPrices } = previewSession(sp);
  const recent = pickedCustomersFixture();
  const jobId = typeof sp.job === "string" ? sp.job : null;
  const job = jobId ? RETAIL_JOB_CUSTOMER[jobId.endsWith("999") ? "R-102" : "R-101"] : undefined;
  const catalog = retailCatalogFixture(canPrices);
  const picked = job ? recent.find((c) => c.id === job.id) : typeof sp.customer === "string" ? recent.find((c) => c.id === sp.customer) : undefined;
  const initialPick: CustomerPick | null = picked ? { customer: picked, vehicleId: typeof sp.vehicle === "string" && picked.vehicles.some((v) => v.id === sp.vehicle) ? sp.vehicle : picked.vehicles.length === 1 ? picked.vehicles[0].id : null } : null;
  const lines = jobId ? linesFromFindings(jobFindingsFixture(jobId), typeof sp.findings === "string" ? sp.findings.split(",") : [], catalog) : [];
  const initialLines = lines.length ? lines : undefined;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).slice(0, 40) : "");
  const carHint = { vin: str("vin"), plate: str("plate"), year: str("year"), make: str("make"), model: str("model"), odometer: str("odometer").replace(/[^\d]/g, "") };
  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <RetailNav />
          </div>
          <EstimateBuilder canned={cannedJobsFixture()} technicians={retailTechniciansFixture()} demoPast={pastServicesFixture()} demoInventory={inventoryFixture(true)} key={JSON.stringify(sp)} catalog={catalog} recent={recent} initialPick={initialPick} carHint={carHint} job={jobId && job ? { id: jobId, ro_number: jobId.endsWith("999") ? "RO-000042" : "RO-000041", tag_number: jobId.endsWith("999") ? "R-102" : "R-101" } : null} initialLines={initialLines} />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
