import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PlusIcon } from "lucide-react";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { JobListResult } from "@/lib/db/types";
import { EMPTY_JOB_LIST, JOB_STATUS_LABELS, jobFilterArgs, parseJobFilters, resolveJobFilters } from "@/lib/jobs/query";
import { formatDateOnly, todayIn } from "@/lib/dates";
import { Page, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { JobFilters } from "@/components/jobs/job-filters";
import { JobList } from "@/components/jobs/job-list";

export const metadata: Metadata = { title: "Jobs" };

const plural = (n: number, one: string, many: string) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

/**
 * Every car logged, newest first under day headers. Admins and managers see
 * the whole company; a detailer sees their own. No money here: the month's
 * jobs become one invoice per dealership on the 1st (Invoices, owner only).
 */
export default async function JobsPage(props: PageProps<"/jobs">) {
  const sp = await props.searchParams;
  const typed = parseJobFilters(sp);
  const session = await getSession();
  const today = todayIn(session.company.timezone);
  const filters = resolveJobFilters(typed, today);
  const supabase = await createClient();

  // Owner only: open jobs with a line logged as "Other" and no price yet. `?needs_price=1` narrows the list to them.
  const needsPriceOnly = session.canPrices && sp.needs_price === "1";
  const [{ data: list, error }, { data: services }, { data: dealerships }, { data: detailers }, { data: flaggedRows }] = await Promise.all([
    supabase.rpc("jobs_filtered", needsPriceOnly ? { ...jobFilterArgs(filters), p_limit: 500, p_offset: 0 } : jobFilterArgs(filters)),
    supabase.from("services").select("id, name").is("line_kind", null).order("sort_order"),
    supabase.from("dealerships").select("id, name").eq("retail", false).order("name"),
    session.isAdmin ? supabase.from("profiles").select("id, full_name").eq("active", true).order("full_name") : Promise.resolve({ data: [] as { id: string; full_name: string }[] }),
    session.canPrices ? supabase.from("job_service_prices_v").select("job_id").eq("needs_price", true).is("invoice_id", null).is("deleted_at", null) : Promise.resolve({ data: [] as { job_id: string }[] }),
  ]);
  if (error) throw new Error(error.message);
  const flagged = new Set((flaggedRows ?? []).map((r) => r.job_id));
  let result = (list as JobListResult | null) ?? EMPTY_JOB_LIST;
  if (needsPriceOnly) {
    const rows = result.rows.filter((r) => flagged.has(r.id));
    result = { count: rows.length, rows };
  }

  const scope = [
    needsPriceOnly ? "Needing a price" : null,
    filters.status !== "all" ? JOB_STATUS_LABELS[filters.status] : null,
    filters.dealership ? dealerships?.find((d) => d.id === filters.dealership)?.name : null,
    filters.detailer ? detailers?.find((d) => d.id === filters.detailer)?.full_name : null,
    filters.service ? services?.find((s) => s.id === filters.service)?.name : null,
    filters.searchDate ? filters.searchDate.label : filters.from || filters.to ? `${filters.from ? formatDateOnly(filters.from, "MMM d, yyyy") : "…"} – ${filters.to ? formatDateOnly(filters.to, "MMM d, yyyy") : "…"}` : null,
  ].filter(Boolean);
  const filtered = scope.length > 0 || !!filters.q;
  const summary = [plural(result.count, "car", "cars"), ...scope].filter(Boolean);
  const params = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))).toString();

  return (
    <Page>
      <PageHeader
        title={session.isAdmin ? "Jobs" : "My jobs"}
        description={summary.join(" · ")}
        actions={
          <Button asChild>
            <Link href="/jobs/new">
              <PlusIcon /> New job
            </Link>
          </Button>
        }
      />
      <div className="mt-5 flex flex-col gap-4">
        <Suspense
          fallback={
            <div className="flex flex-col gap-3">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full sm:w-96" />
            </div>
          }
        >
          <JobFilters filters={typed} searchDate={filters.searchDate} services={services ?? []} dealerships={dealerships ?? []} detailers={detailers ?? []} isAdmin={session.isAdmin} />
        </Suspense>
        <JobList rows={result.rows} page={filters.page} count={result.count} params={params} filtered={filtered} today={today} flagged={flagged.size > 0 ? [...flagged] : undefined} />
      </div>
    </Page>
  );
}
