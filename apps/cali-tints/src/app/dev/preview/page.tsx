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
    full_name: "Owner (preview)",
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
    { service_id: "s1", name: "PDI", description: "New car pre-delivery inspection prep", category: "new", price: 60, price_min: null, price_max: null, is_override: false, sort_order: 10 },
    { service_id: "s2", name: "Sold", description: "Delivery clean on a sold unit", category: "new", price: 20, price_min: null, price_max: null, is_override: false, sort_order: 20 },
    { service_id: "s3", name: "Used", description: "Used car full detail", category: "used", price: 200, price_min: null, price_max: null, is_override: false, sort_order: 30 },
    { service_id: "s4", name: "Service Loaner Detail", description: "Full detail on a service loaner", category: "service", price: 125, price_min: null, price_max: null, is_override: false, sort_order: 40 },
    { service_id: "s5", name: "Touch Up Detail", description: "$20–40 by condition", category: "addon", price: 30, price_min: 20, price_max: 40, is_override: false, sort_order: 50 },
    { service_id: "s6", name: "Tint Removal", description: "Strip old tint on a used unit", category: "addon", price: 40, price_min: null, price_max: null, is_override: false, sort_order: 60 },
    { service_id: "s7", name: "Paint Correction (1-step)", description: "Single-stage machine polish", category: "addon", price: 250, price_min: null, price_max: null, is_override: false, sort_order: 70 },
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
