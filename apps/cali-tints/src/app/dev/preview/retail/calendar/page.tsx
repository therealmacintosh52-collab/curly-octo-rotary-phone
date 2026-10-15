import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { RetailNav } from "@/components/retail/retail-nav";
import { CalendarView } from "@/components/retail/calendar-view";
import { ScheduleEstimate } from "@/components/retail/schedule-estimate";
import { dayKeyIn } from "@/lib/retail/slots";
import { calendarRangeFixture, estimateViewFixture, pickedCustomersFixture, retailCatalogFixture } from "@/test/retail-fixtures";
import { previewSession } from "@/test/preview-session";
import type { EstimateForBooking } from "@/components/retail/appointment-sheet";

/** Fixture preview of Retail → Calendar. */
export default async function DevCalendarPreview(props: PageProps<"/dev/preview/retail/calendar">) {
  const sp = await props.searchParams;
  const { session, canPrices, isAdmin } = previewSession(sp);
  const tz = "America/Los_Angeles";
  const today = dayKeyIn(new Date(), tz);
  const day = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const view = sp.view === "week" ? "week" : sp.view === "day" ? "day" : "month";
  const catalog = retailCatalogFixture(canPrices);
  let estimate: EstimateForBooking | null = null;
  if (typeof sp.estimate === "string") {
    const e = estimateViewFixture(sp.estimate, canPrices);
    if (e?.status === "accepted") {
      const chosen = e.options.find((o) => o.id === e.selected_option_id);
      const lines = [...(chosen?.lines ?? []), ...e.addons.filter((a) => a.customer_approved === true)].filter((l) => l.service_id);
      estimate = { id: e.id, display_number: e.display_number, customer: e.customer.display_name ?? e.customer.first_name, vehicle: e.vehicle?.name ?? null, size_class: e.size_class, lines: lines.map((l) => ({ service_id: l.service_id!, qty: l.qty, label: l.name, price: l.unit_price, modifiers: l.modifiers.map((m) => m.code) })) };
    }
  }
  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <RetailNav />
          </div>
          <CalendarView data={calendarRangeFixture(canPrices)} day={day} view={view} tz={tz} catalog={isAdmin ? catalog : null} recent={pickedCustomersFixture()} />
          {estimate && isAdmin && <ScheduleEstimate catalog={catalog} estimate={estimate} tz={tz} />}
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
