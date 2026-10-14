import { notFound } from "next/navigation";
import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { RetailNav } from "@/components/retail/retail-nav";
import { RetailInvoiceDetail } from "@/components/retail/retail-invoice-detail";
import { INVOICE_TOKEN, retailInvoiceDetailFixture, retailServicesFixture } from "@/test/retail-fixtures";
import { RoNotes } from "@/components/jobs/ro-notes";
import { SendFindings } from "@/components/retail/send-findings";
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
          <RetailInvoiceDetail
            inv={inv}
            findingsCount={(inv.findings ?? []).length}
            notes={
              <RoNotes
                jobId={inv.job_id}
                roNumber={inv.ro_number}
                findings={inv.findings ?? []}
                fromLastTime={[]}
                services={retailServicesFixture(false).filter((s) => s.retail).map((s) => ({ id: s.id, name: s.name }))}
                canWrite={inv.status !== "paid" && !inv.deleted}
                canDeleteAny
                userId="u2"
                canQuote
                jobOpen={inv.status !== "paid" && !inv.deleted}
                extra={<SendFindings estimateId={inv.job_id} firstName={inv.customer?.first_name ?? ""} vehicle={inv.vehicle} phone="(916) 555-0142" email="marcus@example.com" url={`/r/${INVOICE_TOKEN}`} sentAt={null} count={(inv.findings ?? []).filter((f) => f.customer_visible !== false).length} />}
              />
            }
          />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
