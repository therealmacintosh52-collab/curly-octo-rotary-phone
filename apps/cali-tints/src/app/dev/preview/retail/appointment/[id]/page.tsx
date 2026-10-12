import { notFound } from "next/navigation";
import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { RetailNav } from "@/components/retail/retail-nav";
import { AppointmentDetail } from "@/components/retail/appointment-detail";
import { APPOINTMENT_TOKEN, appointmentViewFixture } from "@/test/retail-fixtures";
import { previewSession } from "@/test/preview-session";

/** Fixture preview of one appointment. */
export default async function DevAppointmentPreview(props: PageProps<"/dev/preview/retail/appointment/[id]">) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  const { session, canPrices, isAdmin } = previewSession(sp);
  const a = appointmentViewFixture(id, canPrices);
  if (!a) notFound();
  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <RetailNav />
          </div>
          <AppointmentDetail a={a} showMoney={canPrices} publicUrl={isAdmin ? `/a/${APPOINTMENT_TOKEN}` : null} depositsOnline />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
