import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { RetailDashboard, type DashboardTab } from "@/components/retail/retail-dashboard";

export const metadata: Metadata = { title: "Retail" };

const TABS: DashboardTab[] = ["action", "board", "open", "closed"];

/** Retail opens on the dashboard: what needs doing across every customer visit. Retail has estimates and invoices, never jobs. */
export default async function RetailDashboardPage(props: PageProps<"/retail">) {
  const sp = await props.searchParams;
  const tab: DashboardTab = (TABS as string[]).includes(String(sp.tab)) ? (sp.tab as DashboardTab) : "action";
  const session = await getSession();
  const supabase = await createClient();
  const { data: shops } = await supabase.from("dealerships").select("id, name").eq("retail", true).eq("active", true).order("name");
  const [{ data: open }, { data: closed }, { data: customers }, { data: appts }, { data: texts }, { data: money }] = await Promise.all([
    supabase.rpc("estimates_filtered", { p_status: "all", p_stage: "open", p_limit: 200 }),
    tab === "closed" ? supabase.rpc("estimates_filtered", { p_status: "all", p_stage: "closed", p_limit: 50 }) : Promise.resolve({ data: null }),
    supabase.rpc("customers_filtered", { p_limit: 1 }),
    supabase.rpc("retail_today_appointments"),
    supabase.rpc("text_queue_list"),
    session.canPrices ? supabase.rpc("retail_money_summary") : Promise.resolve({ data: null }),
  ]);
  return (
    <RetailDashboard
      shopName={shops?.map((s) => s.name).join(" · ") || "Retail"}
      tz={session.company.timezone}
      data={{ tab, customers: customers?.count ?? 0, open: open?.rows ?? [], closed: closed?.rows ?? [], counts: open?.counts ?? {}, leads: appts?.leads ?? [], holds: appts?.holds ?? [], appointments: appts?.today ?? [], texts: texts ?? [], showMoney: session.canPrices, money: money ?? null }}
    />
  );
}
