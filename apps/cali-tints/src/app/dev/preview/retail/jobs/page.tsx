import Link from "next/link";
import { FileTextIcon, SearchIcon } from "lucide-react";
import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { Page, PageHeader } from "@/components/app/page-header";
import { RetailNav } from "@/components/retail/retail-nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JobList } from "@/components/jobs/job-list";
import { jobListFixture } from "@/test/fixtures";
import { previewSession } from "@/test/preview-session";
import { toDateInput } from "@/lib/dates";

/** Fixture preview of Retail → Jobs: the shop's repair orders, apart from the dealership Jobs tab. */
export default async function DevRetailJobsPreview(props: PageProps<"/dev/preview/retail/jobs">) {
  const sp = await props.searchParams;
  const { session, isAdmin, canPrices } = previewSession(sp);
  const q = typeof sp.q === "string" ? sp.q.trim().toUpperCase() : "";
  const rows = jobListFixture().filter((r) => r.retail && !r.deleted && (isAdmin || r.detailer_id === "u5") && (!q || [r.tag, r.ro_number, r.retail_invoice_number, r.vehicle, r.customer].some((v) => (v ?? "").toUpperCase().includes(q))));
  return (
    <SessionProvider value={session}>
      <SyncProvider>
        <AppShell>
          <div className="mx-auto w-full max-w-7xl px-4 pt-4 sm:px-6 lg:px-8">
            <RetailNav />
          </div>
          <Page>
            <PageHeader
              title={isAdmin ? "Work" : "My work"}
              description={`${rows.length} ${rows.length === 1 ? "repair order" : "repair orders"}${q ? ` matching “${q}”` : ""} · they start from an approved estimate`}
              actions={
                canPrices ? (
                  <Button asChild>
                    <Link href="/retail/estimates/new">
                      <FileTextIcon /> New estimate
                    </Link>
                  </Button>
                ) : undefined
              }
            />
            <div className="mt-5 flex flex-col gap-4">
              <form className="relative" role="search">
                <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input name="q" defaultValue={typeof sp.q === "string" ? sp.q : ""} placeholder="RO or invoice number, name, phone or car" aria-label="Search retail jobs" className="pl-9" autoComplete="off" enterKeyHint="search" />
              </form>
              <JobList rows={rows} page={1} count={rows.length} params="" filtered={!!q} today={toDateInput(new Date())} />
            </div>
          </Page>
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
