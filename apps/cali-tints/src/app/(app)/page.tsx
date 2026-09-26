import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Dashboard, resolveRange } from "@/components/dashboard/dashboard";
import type { DashboardStats } from "@/lib/db/types";

export default async function HomePage(props: PageProps<"/">) {
  const session = await getSession();
  if (!session.isAdmin) redirect("/jobs/new");
  const range = resolveRange(await props.searchParams);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dashboard_stats", { p_start: range.start, p_end: range.end });
  if (error || !data) throw new Error(error?.message ?? "Could not load dashboard");
  return <Dashboard stats={data as DashboardStats} range={range} companyName={session.company.name} />;
}
