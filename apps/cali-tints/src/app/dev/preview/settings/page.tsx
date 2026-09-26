import { notFound } from "next/navigation";
import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { Page, PageHeader } from "@/components/app/page-header";
import { SettingsNav } from "@/components/settings/settings-nav";
import { ServicesManager } from "@/components/settings/services-manager";
import { DealershipsManager } from "@/components/settings/dealerships-manager";
import { UsersManager } from "@/components/settings/users-manager";
import { invoiceBundleFixture } from "@/test/fixtures";
import type { Profile, Service } from "@/lib/db/types";

/** Dev-only settings preview with fixtures. 404 in production. */
export default function DevSettingsPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  const { company, dealership } = invoiceBundleFixture();
  const profile = { id: "u1", company_id: company.id, role: "owner", full_name: "Vincent (preview)", email: "vincent@example.com", active: true, created_at: "", updated_at: "" } as Profile;
  const svc = (id: string, name: string, price: number, sort: number, active = true): Service => ({
    id, company_id: company.id, name, description: null, default_price: price, active, sort_order: sort, created_at: "", updated_at: "",
  });
  const services = [svc("s1", "Full Detail", 150, 10), svc("s2", "Exterior Wash & Wax", 45, 20), svc("s3", "Delivery Prep", 35, 40), svc("s4", "Headlight Restore", 60, 90, false)];
  const dealerships = [dealership, { ...dealership, id: "d2", name: "Mercedes-Benz of Irvine", invoice_mode: "per_job" as const, submission_method: "portal" as const, ap_emails: [], payment_terms: "Net 45" }];
  const users: Profile[] = [profile, { ...profile, id: "u2", role: "detailer", full_name: "Marco R.", email: "marco@example.com" }, { ...profile, id: "u3", role: "detailer", full_name: "Dee One", email: "dee@example.com", active: false }];

  return (
    <SessionProvider value={{ userId: profile.id, email: profile.email, profile, company, isAdmin: true }}>
      <SyncProvider>
        <AppShell>
          <Page>
            <PageHeader title="Settings" description="Company profile, dealerships, price list, users and data export." />
            <div className="mt-5">
              <SettingsNav />
            </div>
            <div className="mt-5 flex flex-col gap-10">
              <ServicesManager services={services} dealerships={dealerships.map((d) => ({ id: d.id, name: d.name }))} prices={[{ dealership_id: "d2", service_id: "s1", price: 165 }]} />
              <DealershipsManager dealerships={dealerships} />
              <UsersManager users={users} currentUserId="u1" currentRole="owner" emailConfigured />
            </div>
          </Page>
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
