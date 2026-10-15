import type { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadPickerCustomers } from "@/lib/retail/pick";
import { addDays, dayKeyIn, monthGrid } from "@/lib/retail/slots";
import { CalendarView } from "@/components/retail/calendar-view";
import { ScheduleEstimate } from "@/components/retail/schedule-estimate";
import type { EstimateForBooking } from "@/components/retail/appointment-sheet";

export const metadata: Metadata = { title: "Calendar" };

/** The shop's calendar: opens on the month of today (grid + list); a week or a day on request. `?estimate=<id>` opens the booking sheet for an approved estimate. */
export default async function CalendarPage(props: PageProps<"/retail/calendar">) {
  const sp = await props.searchParams;
  const session = await getSession();
  const tz = session.company.timezone;
  const today = dayKeyIn(new Date(), tz);
  const day = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const view = sp.view === "week" ? "week" : sp.view === "day" ? "day" : "month";
  const supabase = await createClient();
  const grid = monthGrid(day);
  const from = view === "day" ? addDays(day, -1) : view === "week" ? addDays(day, -8) : addDays(grid[0][0], -1);
  const to = view === "day" ? addDays(day, 2) : view === "week" ? addDays(day, 9) : addDays(grid.at(-1)![6], 2);
  const [{ data }, { data: catalog }, picker] = await Promise.all([
    supabase.rpc("calendar_range", { p_from: `${from}T00:00:00Z`, p_to: `${to}T00:00:00Z` }),
    session.isAdmin ? supabase.rpc("retail_catalog") : Promise.resolve({ data: null }),
    session.isAdmin ? loadPickerCustomers(supabase, {}) : Promise.resolve({ recent: [], initialPick: null }),
  ]);
  let estimate: EstimateForBooking | null = null;
  if (session.isAdmin && typeof sp.estimate === "string") {
    const { data: e } = await supabase.rpc("estimate_detail", { p_id: sp.estimate });
    if (e?.status === "accepted") {
      const chosen = e.options.find((o) => o.id === e.selected_option_id);
      const lines = [...(chosen?.lines ?? []), ...e.addons.filter((a) => a.customer_approved === true)].filter((l) => l.service_id);
      estimate = { id: e.id, display_number: e.display_number, customer: e.customer.display_name ?? e.customer.first_name, vehicle: e.vehicle?.name ?? null, size_class: e.size_class, lines: lines.map((l) => ({ service_id: l.service_id!, qty: l.qty, label: l.name, price: l.unit_price, modifiers: l.modifiers.map((m) => m.code) })) };
    }
  }
  return (
    <>
      <CalendarView data={data ?? { resources: [], hours: [], blackouts: [], items: [] }} day={day} view={view} tz={tz} catalog={catalog ?? null} recent={picker.recent} />
      {estimate && catalog && <ScheduleEstimate catalog={catalog} estimate={estimate} tz={tz} />}
    </>
  );
}
