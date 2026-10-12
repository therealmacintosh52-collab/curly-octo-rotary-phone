import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { JobDetail } from "@/components/jobs/job-detail";
import { jobListFixture, priceListFixture } from "@/test/fixtures";
import { fromLastTimeFixture, jobEstimatesFixture, jobFindingsFixture, retailChargeFixture, retailServicesFixture } from "@/test/retail-fixtures";
import { previewSession } from "@/test/preview-session";

/** Every row of the demo Jobs list opens as its own page (guest demo in production). */
export default async function DevJobByIdPreview(props: PageProps<"/dev/preview/job/[id]">) {
  const { id } = await props.params;
  const rows = jobListFixture();
  const row = rows.find((r) => r.id === id) ?? rows.find((r) => !r.invoice_id && !r.deleted) ?? rows[0];
  const sp = await props.searchParams;
  const { profile, isAdmin, canMoney, session } = previewSession(sp);
  const prices = Object.fromEntries(priceListFixture().map((s) => [s.name, s]));
  const [year, make, ...model] = (row.vehicle ?? "").split(" ");
  const open = !row.invoice_id && !row.deleted;

  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>
          <JobDetail
            job={{
              id: row.id,
              dealership_id: row.dealership_id,
              detailer_id: row.detailer_id,
              tag_number: row.tag,
              vin: row.vin,
              year: Number(year) || null,
              make: make ?? null,
              model: model.join(" ") || null,
              color: row.color,
              performed_at: row.performed_at,
              ro_po_number: null,
              notes: row.tag === "4821" ? "Customer waiting · light scratch on rear bumper noted before work" : null,
              services: row.services.map((name) => ({ service_id: prices[name]?.service_id ?? "s8", name, price: 0, override_reason: null, needs_price: isAdmin && open && name === "Other" })),
              dealership_name: row.dealership,
              customer: row.customer_id && row.customer ? { id: row.customer_id, name: row.customer } : null,
              vehicle: row.vehicle_id ? { id: row.vehicle_id, name: row.vehicle ?? "Vehicle" } : null,
              invoice: row.invoice_id ? { id: row.invoice_id, display_number: row.display_number ?? "", status: row.invoice_status ?? "draft" } : null,
              quickbooks_doc_number: row.quickbooks_doc_number ?? null,
              retail: !!row.retail,
              ro_number: row.ro_number ?? null,
              payment: { paid_at: row.paid_at ?? null, paid_amount: row.paid_at ? 200 : null, payment_method: row.paid_at ? ("clover" as const) : null, payment_ref: row.paid_at ? "K7Q2M3" : null },
              deleted_at: row.deleted ? row.performed_at : null,
              deleted_reason: row.deleted ? "Logged twice" : null,
              created_at: row.performed_at,
            }}
            photos={
              row.photo_count > 0
                ? [
                    { id: `${row.id}-b`, kind: "photo" as const, url: "/demo/before.svg", created_at: row.performed_at },
                    ...(row.photo_count > 1 ? [{ id: `${row.id}-a`, kind: "photo" as const, url: "/demo/after.svg", created_at: row.performed_at }] : []),
                  ]
                : []
            }
            priceList={priceListFixture(false)}
            detailers={[
              { id: "u2", full_name: "Victor" },
              { id: "u3", full_name: "Dee One" },
              { id: "u5", full_name: "Sam" },
            ]}
            isAdmin={isAdmin}
            canSetAmount={isAdmin}
            charge={row.retail ? retailChargeFixture(row.id, isAdmin) : null}
            canEdit={open && (isAdmin || row.detailer_id === "u5")}
            canDelete={open && isAdmin}
            canRestore={row.deleted && isAdmin}
            findings={row.retail ? jobFindingsFixture(row.id) : []}
            fromLastTime={row.retail ? fromLastTimeFixture(row.id) : []}
            retailServices={row.retail ? retailServicesFixture(canMoney).filter((s) => s.retail).map((s) => ({ id: s.id, name: s.name })) : []}
            canNote={open && (isAdmin || row.detailer_id === "u5")}
            userId={profile.id}
            initialTab={sp.tab === "notes" ? "notes" : "job"}
            estimates={row.retail ? jobEstimatesFixture(row.id, isAdmin) : []}
          />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
