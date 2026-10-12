import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { Page, PageHeader } from "@/components/app/page-header";
import { RetailNav } from "@/components/retail/retail-nav";
import { CustomerForm } from "@/components/retail/customer-form";
import { previewSession } from "@/test/preview-session";

/** Fixture preview of Retail → New customer. */
export default async function DevCustomerNewPreview(props: PageProps<"/dev/preview/retail/customer-new">) {
  const sp = await props.searchParams;
  const { session } = previewSession(sp);
  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <RetailNav />
          </div>
          <Page narrow>
            <Link href="/retail/customers" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeftIcon className="size-4" /> Customers
            </Link>
            <PageHeader title="New customer" description="Name and phone are enough to start. Consents are asked, never assumed." />
            <div className="mt-5">
              <CustomerForm />
            </div>
          </Page>
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
