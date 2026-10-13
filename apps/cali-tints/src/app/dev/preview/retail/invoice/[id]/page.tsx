import { notFound } from "next/navigation";
import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { RetailNav } from "@/components/retail/retail-nav";
import { RetailInvoiceDetail } from "@/components/retail/retail-invoice-detail";
import { retailInvoiceDetailFixture } from "@/test/retail-fixtures";
import { previewSession } from "@/test/preview-session";

/** Fixture preview of one retail invoice. */
export default async function DevRetailInvoicePreview(props: PageProps<"/dev/preview/retail/invoice/[id]">) {
  const [{ id }, sp] = await Promise.all([props.params, props.searchParams]);
  const { session } = previewSession(sp);
  const inv = retailInvoiceDetailFixture(id);
  if (!inv) notFound();
  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <RetailNav />
          </div>
          <RetailInvoiceDetail inv={inv} />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
