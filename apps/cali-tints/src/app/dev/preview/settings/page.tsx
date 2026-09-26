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
  const { company, dealership } = invoiceBundleFixture();
  const profile = { id: "u1", company_id: company.id, role: "owner", full_name: "Mike (preview)", email: "mike@example.com", active: true, created_at: "", updated_at: "" } as Profile;
  const svc = (id: string, name: string, category: Service["category"], price: number, sort: number, active = true): Service => ({
    id, company_id: company.id, name, description: null, category, default_price: price, active, sort_order: sort, created_at: "", updated_at: "",
  });
  const services = [svc("s1", "PDI", "new", 60, 10), svc("s2", "Sold", "new", 20, 20), svc("s3", "Used", "used", 200, 30), svc("s4", "Service Loaner Detail", "service", 125, 40)];
  const dealerships = [dealership, { ...dealership, id: "d2", name: "Mercedes-Benz of Irvine", invoice_mode: "per_job" as const, submission_method: "portal" as const, ap_emails: [], payment_terms: "Net 45" }];
  const users: Profile[] = [profile, { ...profile, id: "u2", role: "detailer", full_name: "Marco R.", email: "marco@example.com" }, { ...profile, id: "u3", role: "detailer", full_name: "Dee One", email: "dee@example.com", active: false }];

  return (
    <SessionProvider value={{ userId: profile.id, email: profile.email, profile, company, isAdmin: true, demo: true }}>
      <SyncProvider>
        <AppShell>
          <Page>
            <PageHeader title="Settings" description="Company profile, dealerships, price list, users and data export." />
            <div className="mt-5">
              <SettingsNav />
            </div>
            <div className="mt-5 flex flex-col gap-10">
              <ServicesManager services={services} dealerships={dealerships.map((d) => ({ id: d.id, name: d.name }))} prices={[{ dealership_id: "d2", service_id: "s3", price: 215 }]} />
              <DealershipsManager dealerships={dealerships} />
              <UsersManager users={users} currentUserId="u1" currentRole="owner" emailConfigured />
            </div>
          </Page>
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
