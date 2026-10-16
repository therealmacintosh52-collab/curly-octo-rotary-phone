import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Dashboard, resolveBreakdownMonth, resolveRange } from "@/components/dashboard/dashboard";
import { DetailerDashboard } from "@/components/dashboard/detailer-dashboard";
import { TeamDashboard } from "@/components/dashboard/team-dashboard";
import { NeedsPriceBanner } from "@/components/dashboard/needs-price-banner";
import { SoldChargeBanner } from "@/components/dashboard/sold-charge-banner";
import type { DashboardStats, DetailerStats, RetailDashboard, TeamStats } from "@/lib/db/types";
import { isOwner } from "@/lib/roles";
import { todayIn } from "@/lib/dates";

export default async function HomePage(props: PageProps<"/">) {
  const session = await getSession();
  const today = todayIn(session.company.timezone);
  const supabase = await createClient();
  const who = { name: session.profile.full_name, tz: session.company.timezone };

  // Detailers get their own dashboard: their cars, no money.
  if (!session.isAdmin) {
    const { data, error } = await supabase.rpc("my_dashboard", {});
    if (error || !data) throw new Error(error?.message ?? "Could not load dashboard");
    return <DetailerDashboard stats={data as DetailerStats} today={today} who={who} />;
  }

  // Admins and managers: the whole team's day, no money. Admins also see which jobs still need a price.
  if (!isOwner(session.profile.role)) {
    const [{ data, error }, { data: needsPrice }, { data: retail }, { data: soldMissing }] = await Promise.all([supabase.rpc("team_dashboard", {}), session.canPrices ? supabase.rpc("jobs_needing_price", {}) : Promise.resolve({ data: 0 }), supabase.rpc("retail_dashboard", {}), supabase.rpc("jobs_missing_sold_charge", {})]);
    if (error || !data) throw new Error(error?.message ?? "Could not load dashboard");
    return (
      <>
        <NeedsPriceBanner count={Number(needsPrice ?? 0)} />
        <SoldChargeBanner count={soldMissing?.length ?? 0} />
        <TeamDashboard stats={data as TeamStats} today={today} who={who} retail={(retail as RetailDashboard | null) ?? null} />
      </>
    );
  }

  const sp = await props.searchParams;
  const range = resolveRange(sp);
  const bm = resolveBreakdownMonth(sp, today);
  const [{ data, error }, { data: monthData }, { data: needsPrice }, { data: retail }, { data: soldMissing }] = await Promise.all([
    supabase.rpc("dashboard_stats", { p_start: range.start, p_end: range.end }),
    // The breakdown month is usually not the income range: one more call, same function.
    supabase.rpc("dashboard_stats", { p_start: bm.start, p_end: bm.end }),
    // Open jobs where someone logged "Other" without a price.
    supabase.rpc("jobs_needing_price", {}),
    // The shop's own side: shown in a block of its own, never mixed into the dealership numbers.
    supabase.rpc("retail_dashboard", {}),
    // Sold cars without PDI or Used (0071).
    supabase.rpc("jobs_missing_sold_charge", {}),
  ]);
  if (error || !data) throw new Error(error?.message ?? "Could not load dashboard");
  const month = (monthData as DashboardStats | null) ?? (data as DashboardStats);
  return (
    <>
      <NeedsPriceBanner count={Number(needsPrice ?? 0)} />
      <SoldChargeBanner count={soldMissing?.length ?? 0} />
      <Dashboard stats={data as DashboardStats} range={range} today={today} who={who} breakdown={{ ...bm, stats: { by_service: month.by_service, by_day: month.by_day } }} retail={(retail as RetailDashboard | null) ?? null} />
    </>
  );
}
