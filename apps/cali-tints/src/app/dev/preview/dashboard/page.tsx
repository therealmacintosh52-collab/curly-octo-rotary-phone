import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { Dashboard, resolveRange } from "@/components/dashboard/dashboard";
import type { DashboardStats, Profile } from "@/lib/db/types";
import { invoiceBundleFixture } from "@/test/fixtures";

/** Dev-only dashboard with fixture stats (guest preview in production). The range picker works; the sample numbers stay the same. */
export default async function DevDashboardPreview(props: PageProps<"/dev/preview/dashboard">) {
  const range = resolveRange(await props.searchParams);
  const { company } = invoiceBundleFixture();
  const profile = { id: "u1", company_id: company.id, role: "owner", full_name: "Mike (preview)", email: null, active: true } as Profile;

  const days = Array.from({ length: 26 }, (_, i) => {
    const d = new Date(2026, 8, i + 1);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const jobs = weekend ? 0 : 3 + ((i * 7) % 6);
    return { day: d.toISOString().slice(0, 10), jobs, revenue: jobs * (95 + ((i * 13) % 60)) };
  }).filter((d) => d.jobs > 0);

  const stats: DashboardStats = {
    range: { start: range.start, end: range.end },
    week: { jobs: 23, revenue: 3185 },
    month: { jobs: 118, revenue: 15940 },
    uninvoiced_total: 6420,
    uninvoiced_jobs: 47,
    outstanding_total: 9385.5,
    outstanding_invoices: 3,
    draft_total: 1200.34,
    avg_days_to_pay: 27.4,
    paid_last_90: 21870,
    by_service: [
      { service_id: "s3", name: "Used", jobs: 41, revenue: 8200 },
      { service_id: "s4", name: "Service Loaner Detail", jobs: 28, revenue: 3500 },
      { service_id: "s1", name: "PDI", jobs: 38, revenue: 2280 },
      { service_id: "s2", name: "Sold", jobs: 33, revenue: 660 },
    ],
    by_detailer: [
      { detailer_id: "u2", name: "Marco R.", jobs: 52, revenue: 7010 },
      { detailer_id: "u3", name: "Dee One", jobs: 39, revenue: 5120 },
      { detailer_id: "u4", name: "Dee Two", jobs: 27, revenue: 3810 },
    ],
    by_day: days,
    overdue: [
      { id: "i1", display_number: "INV-000009", dealership: "Mercedes-Benz of Anaheim", total: 4210, amount_paid: 0, submitted_at: "2026-08-02T17:00:00Z", days_outstanding: 55 },
      { id: "i2", display_number: "INV-000011", dealership: "Mercedes-Benz of Irvine", total: 1875.5, amount_paid: 500, submitted_at: "2026-08-20T17:00:00Z", days_outstanding: 37 },
    ],
    reminder_days: 30,
  };

  return (
    <SessionProvider value={{ userId: profile.id, email: null, profile, company, isAdmin: true, demo: true }}>
      <SyncProvider>
        <AppShell>
          <Dashboard stats={stats} range={range} companyName={company.name} />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
