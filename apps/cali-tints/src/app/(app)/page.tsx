import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Dashboard, resolveBreakdownMonth, resolveRange } from "@/components/dashboard/dashboard";
import type { DashboardStats } from "@/lib/db/types";
import { todayIn } from "@/lib/dates";

export default async function HomePage(props: PageProps<"/">) {
  const session = await getSession();
  if (!session.isAdmin) redirect("/jobs/new");
  const sp = await props.searchParams;
  const range = resolveRange(sp);
  const today = todayIn(session.company.timezone);
  const bm = resolveBreakdownMonth(sp, today);
  const supabase = await createClient();
  const [{ data, error }, { data: monthData }, { data: cloverUnmatched }] = await Promise.all([
    supabase.rpc("dashboard_stats", { p_start: range.start, p_end: range.end }),
    // The breakdown month is usually not the income range: one more call, same function.
    supabase.rpc("dashboard_stats", { p_start: bm.start, p_end: bm.end }),
    session.company.clover_enabled ? supabase.rpc("clover_unmatched_count") : Promise.resolve({ data: 0 }),
  ]);
  if (error || !data) throw new Error(error?.message ?? "Could not load dashboard");
  const month = (monthData as DashboardStats | null) ?? (data as DashboardStats);
  return <Dashboard stats={data as DashboardStats} range={range} companyName={session.company.name} cloverUnmatched={Number(cloverUnmatched ?? 0)} today={today} breakdown={{ ...bm, stats: { by_service: month.by_service, by_day: month.by_day } }} />;
}
