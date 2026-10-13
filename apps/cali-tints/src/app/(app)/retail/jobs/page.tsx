import type { Metadata } from "next";
import Link from "next/link";
import { FileTextIcon, SearchIcon } from "lucide-react";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { JobListResult } from "@/lib/db/types";
import { EMPTY_JOB_LIST, JOB_PAGE_SIZE } from "@/lib/jobs/query";
import { todayIn } from "@/lib/dates";
import { Page, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { JobList } from "@/components/jobs/job-list";

export const metadata: Metadata = { title: "Retail work" };

/**
 * The shop's own work: repair orders (each one an invoice) that came from an approved estimate or a booked appointment, newest first. Apart from the
 * dealerships' Jobs tab: a retail car never shows up there. An admin sees every
 * RO, a detailer their own.
 */
export default async function RetailJobsPage(props: PageProps<"/retail/jobs">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp.page) || 1);
  const session = await getSession();
  const today = todayIn(session.company.timezone);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("jobs_filtered", { p_q: q || null, p_scope: "retail", p_status: "all", p_limit: JOB_PAGE_SIZE, p_offset: (page - 1) * JOB_PAGE_SIZE });
  if (error) throw new Error(error.message);
  const result = (data as JobListResult | null) ?? EMPTY_JOB_LIST;
  const params = new URLSearchParams(q ? { q } : {}).toString();
  return (
    <Page>
      <PageHeader
        title={session.isAdmin ? "Work" : "My work"}
        description={`${result.count.toLocaleString()} ${result.count === 1 ? "repair order" : "repair orders"}${q ? ` matching “${q}”` : ""} · they start from an approved estimate`}
        actions={
          session.canPrices ? (
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
          <Input name="q" defaultValue={q} placeholder="RO or invoice number, name, phone or car" aria-label="Search retail jobs" className="pl-9" autoComplete="off" enterKeyHint="search" />
        </form>
        <JobList rows={result.rows} page={page} count={result.count} params={params} filtered={!!q} today={today} />
      </div>
    </Page>
  );
}
