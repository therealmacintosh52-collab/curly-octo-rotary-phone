import { notFound } from "next/navigation";
import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { RetailNav } from "@/components/retail/retail-nav";
import { CustomerDetail } from "@/components/retail/customer-detail";
import { customerTimelineFixture } from "@/test/retail-fixtures";
import { previewSession } from "@/test/preview-session";

/** Fixture preview of one customer. */
export default async function DevCustomerPreview(props: PageProps<"/dev/preview/retail/customer/[id]">) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  const { session, canPrices } = previewSession(sp);
  const data = customerTimelineFixture(id, canPrices);
  if (!data) notFound();
  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <RetailNav />
          </div>
          <CustomerDetail data={data} showMoney={canPrices} />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
