import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { JobForm } from "@/components/jobs/job-form";
import type { Company, Dealership, PriceListRow, Profile } from "@/lib/db/types";

/**
 * Development-only preview of the job form with fixture data, so the UI can
 * be iterated on (and screenshot-tested) without a Supabase project.
 * Returns 404 in production builds.
 */
export default function DevPreviewPage() {

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
    payment_terms: "Net 30",
    tax_rate: 0,
    invoice_prefix: "INV-",
    next_invoice_number: 1,
    reminder_days: 30,
    timezone: "America/Los_Angeles",
    logo_path: null,
    created_at: "",
    updated_at: "",
  };
  const profile: Profile = {
    id: "10000000-0000-4000-8000-000000000001",
    company_id: company.id,
    role: "owner",
    full_name: "Mike (preview)",
    email: "owner@example.com",
    active: true,
    created_at: "",
    updated_at: "",
  };
  const dealerships: Dealership[] = [
    {
      id: "d1",
      company_id: company.id,
      name: "Mercedes-Benz of Anaheim",
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
      created_at: "",
      updated_at: "",
    },
    {
      id: "d2",
      company_id: company.id,
      name: "Mercedes-Benz of Irvine",
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
      created_at: "",
      updated_at: "",
    },
  ];
  const list: PriceListRow[] = [
    { service_id: "s1", name: "PDI (New Car Prep)", description: null, category: "new", price: 35, is_override: false, sort_order: 10 },
    { service_id: "s2", name: "New Car Delivery", description: null, category: "new", price: 35, is_override: false, sort_order: 20 },
    { service_id: "s3", name: "Used Car Detail (Full)", description: null, category: "used", price: 150, is_override: false, sort_order: 30 },
    { service_id: "s4", name: "CPO Detail", description: null, category: "used", price: 185, is_override: false, sort_order: 40 },
    { service_id: "s5", name: "Service Wash", description: null, category: "service", price: 45, is_override: false, sort_order: 60 },
    { service_id: "s6", name: "Loaner Return Clean", description: null, category: "service", price: 35, is_override: false, sort_order: 70 },
    { service_id: "s7", name: "Window Tint (Full)", description: null, category: "addon", price: 399, is_override: false, sort_order: 90 },
    { service_id: "s8", name: "Engine Bay", description: null, category: "addon", price: 40, is_override: false, sort_order: 120 },
  ];

  return (
    <SessionProvider value={{ userId: profile.id, email: profile.email, profile, company, isAdmin: true, demo: true }}>
      <SyncProvider>
        <AppShell>
          <JobForm
            dealerships={dealerships}
            priceLists={{ d1: list, d2: list }}
            detailers={[
              { id: profile.id, full_name: profile.full_name },
              { id: "u2", full_name: "Marco R." },
            ]}
            recentJobs={[]}
          />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
