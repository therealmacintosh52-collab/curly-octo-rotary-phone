import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { JobDetail } from "@/components/jobs/job-detail";
import { invoiceBundleFixture, jobListFixture, priceListFixture } from "@/test/fixtures";
import type { Profile } from "@/lib/db/types";

/** Every row of the demo Jobs list opens as its own page (guest demo in production). */
export default async function DevJobByIdPreview(props: PageProps<"/dev/preview/job/[id]">) {
  const { id } = await props.params;
  const rows = jobListFixture();
  const row = rows.find((r) => r.id === id) ?? rows.find((r) => !r.invoice_id && !r.deleted) ?? rows[0];
  const { company } = invoiceBundleFixture();
  const sp = await props.searchParams;
  const asDetailer = sp.as === "detailer";
  const asTeam = sp.as === "team";
  const profile = (asDetailer
    ? { id: "u5", company_id: company.id, role: "detailer", full_name: "Sam", email: null, active: true }
    : asTeam
      ? { id: "u4", company_id: company.id, role: "admin", full_name: "Manny", email: null, active: true }
      : { id: "u1", company_id: company.id, role: "owner", full_name: "Mike", email: null, active: true }) as Profile;
  const isAdmin = !asDetailer;
  const canMoney = !asDetailer && !asTeam;
  const prices = Object.fromEntries(priceListFixture().map((s) => [s.name, s]));
  const [year, make, ...model] = (row.vehicle ?? "").split(" ");
  const open = !row.invoice_id && !row.deleted;

  return (
    <SessionProvider value={{ userId: profile.id, email: null, profile, company, isAdmin, canSettings: isAdmin, canMoney, demo: true }}>
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
              services: row.services.map((name) => ({ service_id: prices[name]?.service_id ?? "s8", name, price: canMoney ? Number(prices[name]?.price ?? 0) : 0, override_reason: null, needs_price: canMoney && open && name === "Other" })),
              dealership_name: row.dealership,
              detailer_name: row.detailer,
              invoice: row.invoice_id ? { id: row.invoice_id, display_number: row.display_number ?? "", status: row.invoice_status ?? "draft" } : null,
              deleted_at: row.deleted ? row.performed_at : null,
              deleted_reason: row.deleted ? "Logged twice" : null,
              created_at: row.performed_at,
            }}
            photos={[]}
            priceList={priceListFixture(canMoney)}
            detailers={[
              { id: "u2", full_name: "Victor" },
              { id: "u3", full_name: "Dee One" },
              { id: "u5", full_name: "Sam" },
            ]}
            isAdmin={isAdmin}
            canSeeMoney={canMoney}
            canEdit={open && (isAdmin || row.detailer_id === "u5")}
            canDelete={open && isAdmin}
            canRestore={row.deleted && isAdmin}
          />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
