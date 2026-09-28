import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import Link from "next/link";
import { Dashboard, resolveBreakdownMonth, resolveRange } from "@/components/dashboard/dashboard";
import { DetailerDashboard } from "@/components/dashboard/detailer-dashboard";
import { toDateInput } from "@/lib/dates";
import type { DashboardStats, DetailerStats, Profile } from "@/lib/db/types";
import { invoiceBundleFixture } from "@/test/fixtures";

/** Dev-only dashboard with fixture stats (guest preview in production). The range picker works; the sample numbers stay the same. */
export default async function DevDashboardPreview(props: PageProps<"/dev/preview/dashboard">) {
  const sp = await props.searchParams;
  const range = resolveRange(sp);
  const today = toDateInput(new Date());
  const bm = resolveBreakdownMonth(sp, today);
  const { company } = invoiceBundleFixture();
  const profile = { id: "u1", company_id: company.id, role: "owner", full_name: "Mike", email: null, active: true } as Profile;

  const days = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(2026, 8, i + 1);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    const jobs = weekend ? 0 : 3 + ((i * 7) % 6);
    return { day: d.toISOString().slice(0, 10), jobs, revenue: jobs * (95 + ((i * 13) % 60)) };
  }).filter((d) => d.jobs > 0);

  const stats: DashboardStats = {
    range: { start: range.start, end: range.end },
    week: { jobs: 23, revenue: 3185 },
    month: { jobs: 118, revenue: 15940 },
    today: {
      jobs: 9,
      revenue: 800,
      by_service: [
        { service_id: "s1", name: "PDI", jobs: 2, revenue: 120 },
        { service_id: "s2", name: "Sold", jobs: 4, revenue: 80 },
        { service_id: "s3", name: "Used", jobs: 3, revenue: 600 },
      ],
    },
    income: { jobs: days.reduce((s, d) => s + d.jobs, 0), revenue: days.reduce((s, d) => s + d.revenue, 0), collected: 12640, payments: 6, avg_per_car: 135.08 },
    collected_by_day: [
      { day: "2026-09-03", payments: 1, amount: 4210 },
      { day: "2026-09-10", payments: 2, amount: 2380 },
      { day: "2026-09-16", payments: 1, amount: 1875.5 },
      { day: "2026-09-22", payments: 2, amount: 4174.5 },
    ],
    uninvoiced_total: 0,
    uninvoiced_jobs: 0,
    unpaid_total: 10585.84,
    unpaid_invoices: 41,
    outstanding_total: 9385.5,
    outstanding_invoices: 3,
    draft_total: 1200.34,
    draft_invoices: 6,
    avg_days_to_pay: 27.4,
    paid_last_90: 21870,
    by_service: [
      { service_id: "s3", name: "Used", jobs: 41, revenue: 8200 },
      { service_id: "s4", name: "Service Loaner Detail", jobs: 28, revenue: 3500 },
      { service_id: "s1", name: "PDI", jobs: 38, revenue: 2280 },
      { service_id: "s2", name: "Sold", jobs: 33, revenue: 660 },
    ],
    by_detailer: [
      { detailer_id: "u2", name: "Victor", jobs: 52, revenue: 7010 },
      { detailer_id: "u3", name: "Dee One", jobs: 39, revenue: 5120 },
      { detailer_id: "u4", name: "Dee Two", jobs: 27, revenue: 3810 },
    ],
    by_day: days,
    week_by_day: Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + i);
      const key = toDateInput(d);
      const known = days.find((x) => x.day === key);
      const jobs = key > today ? 0 : (known?.jobs ?? [9, 8, 6, 9, 7, 0, 0][i]);
      return { day: key, jobs, revenue: known?.revenue ?? jobs * 90 };
    }).filter((d) => d.jobs > 0),
    overdue: [
      { id: "i1", display_number: "INV-000009", dealership: "Mercedes-Benz of El Dorado Hills", total: 4210, amount_paid: 0, submitted_at: "2026-08-02T17:00:00Z", days_outstanding: 55 },
      { id: "i2", display_number: "INV-000011", dealership: "Mercedes-Benz of Sacramento", total: 1875.5, amount_paid: 500, submitted_at: "2026-08-20T17:00:00Z", days_outstanding: 37 },
    ],
    reminder_days: 30,
  };

  // ?as=detailer: the same page as a detailer sees it (their own cars, no money).
  if (sp.as === "detailer") {
    const dee = { ...profile, id: "u3", role: "detailer", full_name: "Dee One" } as Profile;
    const mine = detailerFixture(today);
    return (
      <SessionProvider value={{ userId: dee.id, email: null, profile: dee, company, isAdmin: false, demo: true }}>
        <SyncProvider>
          <AppShell>
            <DetailerDashboard stats={mine} today={today} who={{ name: dee.full_name, tz: company.timezone }} />
            <p className="mt-8 text-center text-caption text-muted-foreground">
              Guest preview · this is what a detailer sees ·{" "}
              <Link href="/" className="text-primary underline-offset-4 hover:underline">
                back to the owner view
              </Link>
            </p>
          </AppShell>
        </SyncProvider>
      </SessionProvider>
    );
  }

  return (
    <SessionProvider value={{ userId: profile.id, email: null, profile, company, isAdmin: true, demo: true }}>
      <SyncProvider>
        <AppShell>
          <Dashboard stats={stats} range={range} today={today} who={{ name: profile.full_name, tz: company.timezone }} breakdown={{ ...bm, stats: { by_service: stats.by_service, by_day: stats.by_day } }} />
          <p className="mt-8 text-center text-caption text-muted-foreground">
            Guest preview ·{" "}
            <Link href="/?as=detailer" className="text-primary underline-offset-4 hover:underline" data-testid="view-as-detailer">
              see what a detailer sees
            </Link>
          </p>
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}

/** Dee's sample month: about four cars a weekday, four logged so far today. */
function detailerFixture(today: string): DetailerStats {
  const now = Date.now();
  const ymd = (n: number) => toDateInput(new Date(now - n * 86400000));
  const ago = (min: number) => new Date(now - min * 60000).toISOString();
  const EDH = "Mercedes-Benz of El Dorado Hills";
  return {
    today: { cars: 4, by_service: [{ service_id: "s1", name: "PDI", cars: 1 }, { service_id: "s2", name: "Sold", cars: 2 }, { service_id: "s3", name: "Used", cars: 1 }] },
    week: { cars: 13 },
    month: { cars: 52 },
    week_by_day: [],
    by_day: Array.from({ length: 30 }, (_, i) => ({ day: ymd(29 - i), cars: [0, 4, 5, 3, 4, 6, 0][new Date(now - (29 - i) * 86400000).getDay()] })).filter((d) => d.cars > 0),
    today_cars: [
      { id: "j1", invoice_id: "30000000-0000-4000-8000-000000000060", display_number: "INV-000060", tag: "4821", vehicle: "2024 Mercedes-Benz GLE 450", dealership: EDH, performed_at: ago(20), services: ["Used"] },
      { id: "j2", invoice_id: "30000000-0000-4000-8000-000000000056", display_number: "INV-000056", tag: "4836", vehicle: "2026 Mercedes-Benz GLE 350", dealership: EDH, performed_at: ago(95), services: ["PDI"] },
      { id: "j3", invoice_id: "30000000-0000-4000-8000-000000000054", display_number: "INV-000054", tag: "4819", vehicle: "2024 Mercedes-Benz GLA 250", dealership: EDH, performed_at: ago(150), services: ["Sold"] },
      { id: "j4", invoice_id: "30000000-0000-4000-8000-000000000052", display_number: "INV-000052", tag: "4827", vehicle: "2026 Mercedes-Benz EQE 350", dealership: EDH, performed_at: ago(200), services: ["Sold"] },
    ],
    range: { start: ymd(29), end: today },
  };
}
