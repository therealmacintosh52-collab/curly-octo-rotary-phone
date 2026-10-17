import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { PartOrder } from "@/lib/db/types";
import { PartsManager, type PartsTab } from "@/components/retail/parts-manager";

export const metadata: Metadata = { title: "Parts" };

/** What is on the shelf, the orders to vendors and the vendors. Anyone signed in reads the shelf (no prices); owner, admin and advisor see money, write and order. */
export default async function PartsPage(props: PageProps<"/retail/parts">) {
  const sp = await props.searchParams;
  const session = await getSession();
  const tab: PartsTab = session.canPrices && (sp.tab === "orders" || sp.tab === "vendors") ? sp.tab : "parts";
  const q = typeof sp.q === "string" ? sp.q.slice(0, 60) : "";
  const low = sp.low === "1";
  const supabase = await createClient();
  const openId = typeof sp.open === "string" && /^[0-9a-f-]{36}$/i.test(sp.open) ? sp.open : null;
  const [{ data: items }, { data: orders }, { data: vendors }, { data: openOrder }] = await Promise.all([
    supabase.rpc("inventory_list", { p_q: q || null, p_low: low, p_limit: 200 }),
    tab === "orders" ? supabase.rpc("part_orders_list", {}) : Promise.resolve({ data: [] as PartOrder[] }),
    session.canPrices ? supabase.rpc("vendors_list") : Promise.resolve({ data: [] }),
    tab === "orders" && openId ? supabase.rpc("part_order_detail", { p_id: openId }) : Promise.resolve({ data: null }),
  ]);
  return <PartsManager tab={tab} items={items ?? []} orders={orders ?? []} vendors={vendors ?? []} q={q} low={low} canEdit={session.canPrices} showMoney={session.canPrices} openOrder={openOrder} />;
}
