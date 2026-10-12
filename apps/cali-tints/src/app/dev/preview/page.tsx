import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import Link from "next/link";
import { JobForm } from "@/components/jobs/job-form";
import type { Company, Dealership, Profile } from "@/lib/db/types";
import { priceListFixture } from "@/test/fixtures";
import { pickedCustomersFixture, retailPriceListFixture } from "@/test/retail-fixtures";

/**
 * Fixture preview of New job (guest demo in production). `?as=detailer`
 * shows the form as everyone but the owner gets it: services, no prices.
 */
export default async function DevPreviewPage(props: PageProps<"/dev/preview">) {
  const sp = await props.searchParams;
  const asDetailer = sp.as === "detailer";

  const company: Company = {
    id: "00000000-0000-4000-8000-000000000001",
    name: "Cali Tints",
    email: "billing@calitints.example",
    phone: null,
    address_line1: null,
    address_line2: null,
    city: null,
    state: null,
    postal_code: null,
    ein: null,
    payment_terms: "",
    tax_rate: 0,
    invoice_prefix: "INV-",
    next_invoice_number: 1,
    reminder_days: 30,
    timezone: "America/Los_Angeles", auto_invoice: false, auto_send_monthly: true,
    quickbooks_realm_id: null, quickbooks_company_name: null, quickbooks_env: "production", quickbooks_connected_at: null, quickbooks_item_id: null, quickbooks_item_name: "Auto detailing", quickbooks_auto_push: true, quickbooks_last_sync_at: null, quickbooks_last_error: null,
    logo_path: null,
    created_at: "",
    updated_at: "",
  };
  const profile: Profile = {
    id: "10000000-0000-4000-8000-000000000001",
    company_id: company.id,
    role: asDetailer ? "detailer" : "owner",
    full_name: asDetailer ? "Sam" : "Mike",
    email: "owner@example.com",
    active: true,
    guide_seen_at: null,
    created_at: "",
    updated_at: "",
  };
  const dealerships: Dealership[] = [
    {
      id: "d1",
      company_id: company.id,
      name: "Mercedes-Benz of El Dorado Hills",
      address_line1: null,
      address_line2: null,
      city: null,
      state: null,
      postal_code: null,
      contact_name: null,
      contact_phone: null,
      ap_contact_name: null,
      ap_emails: [],
      submission_method: "email",
      invoice_mode: "batch",
      payment_terms: null,
      tax_rate: null,
      active: true,
      quickbooks_customer_id: null,
      retail: false,
      created_at: "",
      updated_at: "",
    },
    {
      id: "d2",
      company_id: company.id,
      name: "Mercedes-Benz of Sacramento",
      address_line1: null,
      address_line2: null,
      city: null,
      state: null,
      postal_code: null,
      contact_name: null,
      contact_phone: null,
      ap_contact_name: null,
      ap_emails: [],
      submission_method: "portal",
      invoice_mode: "per_job",
      payment_terms: null,
      tax_rate: null,
      active: true,
      quickbooks_customer_id: null,
      retail: false,
      created_at: "",
      updated_at: "",
    },
    {
      id: "d3",
      company_id: company.id,
      name: "Cali Tint · Fulton Ave",
      address_line1: "Fulton Ave",
      address_line2: null,
      city: "Sacramento",
      state: "CA",
      postal_code: "95825",
      contact_name: null,
      contact_phone: null,
      ap_contact_name: null,
      ap_emails: [],
      submission_method: "paper",
      invoice_mode: "batch",
      payment_terms: null,
      tax_rate: null,
      active: true,
      quickbooks_customer_id: null,
      retail: true,
      created_at: "",
      updated_at: "",
    },
  ];
  const list = priceListFixture(false); // no prices on a job, whoever is logging it

  return (
    <SessionProvider value={{ userId: profile.id, email: profile.email, profile, company, isAdmin: !asDetailer, canSettings: !asDetailer, canMoney: !asDetailer, canPrices: !asDetailer, demo: true }}>
      <SyncProvider>
        <AppShell>
          <JobForm
            dealerships={dealerships}
            priceLists={{ d1: list, d2: list, d3: retailPriceListFixture() }}
            detailers={[
              { id: profile.id, full_name: profile.full_name },
              { id: "u2", full_name: "Victor" },
            ]}
            recentJobs={[]} retailCustomers={pickedCustomersFixture()} />
          <p className="pb-28 text-center text-caption text-muted-foreground">
            Guest preview ·{" "}
            {asDetailer ? (
              <Link href="/jobs/new" className="text-primary underline-offset-4 hover:underline">
                back to the owner view
              </Link>
            ) : (
              <Link href="/jobs/new?as=detailer" className="text-primary underline-offset-4 hover:underline" data-testid="view-as-detailer">
                see it as a detailer (no prices)
              </Link>
            )}
          </p>
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
