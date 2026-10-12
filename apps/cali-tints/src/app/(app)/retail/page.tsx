import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { todayIn } from "@/lib/dates";
import { RetailToday, type RetailTodayCar } from "@/components/retail/retail-today";

export const metadata: Metadata = { title: "Retail" };

type Row = { id: string; tag_number: string; year: number | null; make: string | null; model: string | null; performed_at: string; paid_at: string | null; customer: { display_name: string | null } | null; job_services: { label: string | null; service: { name: string } | null }[] };

const toCar = (r: Row): RetailTodayCar => ({
  id: r.id,
  tag: r.tag_number,
  vehicle: [r.year, r.make, r.model].filter(Boolean).join(" ") || null,
  customer: r.customer?.display_name ?? null,
  performed_at: r.performed_at,
  paid_at: r.paid_at,
  services: r.job_services.map((s) => s.label || s.service?.name || "").filter(Boolean),
});

/** The shop's day. Retail jobs are the ones on the dealership row flagged retail. */
export default async function RetailTodayPage() {
  const session = await getSession();
  const supabase = await createClient();
  const { data: shops } = await supabase.from("dealerships").select("id, name").eq("retail", true).eq("active", true).order("name");
  const shopIds = (shops ?? []).map((s) => s.id);
  const today = todayIn(session.company.timezone);
  const sel = "id, tag_number, year, make, model, performed_at, paid_at, customer:customers(display_name), job_services(label, service:services(name))";
  const [{ data: todayRows }, { data: unpaidRows }, { data: customers }, { data: appts }, { data: money }, { data: texts }] = await Promise.all([
    shopIds.length ? supabase.from("jobs").select(sel).in("dealership_id", shopIds).is("deleted_at", null).gte("performed_at", `${today}T00:00:00`).order("performed_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
    shopIds.length ? supabase.from("jobs").select(sel).in("dealership_id", shopIds).is("deleted_at", null).is("paid_at", null).order("performed_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
    supabase.rpc("customers_filtered", { p_limit: 1 }),
    supabase.rpc("retail_today_appointments"),
    session.canPrices ? supabase.rpc("retail_money_summary") : Promise.resolve({ data: null }),
    supabase.rpc("text_queue_list"),
  ]);
  return (
    <RetailToday
      shopName={shops?.map((s) => s.name).join(" · ") || "Retail"}
      tz={session.company.timezone}
      data={{ customers: customers?.count ?? 0, today: ((todayRows ?? []) as unknown as Row[]).map(toCar), unpaid: ((unpaidRows ?? []) as unknown as Row[]).map(toCar), leads: appts?.leads ?? [], holds: appts?.holds ?? [], appointments: appts?.today ?? [], money: money ?? null, texts: texts ?? [] }}
    />
  );
}
