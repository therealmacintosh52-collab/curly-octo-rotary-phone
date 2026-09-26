import type { Metadata } from "next";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseJobFilters, queryJobs } from "@/lib/jobs/query";
import { Page, PageHeader } from "@/components/app/page-header";
import { JobsFilters } from "@/components/jobs/jobs-filters";
import { JobsTable } from "@/components/jobs/jobs-table";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { formatDateOnly } from "@/lib/dates";

export const metadata: Metadata = { title: "Jobs" };

export default async function JobsPage(props: PageProps<"/jobs">) {
  const sp = await props.searchParams;
  const filters = parseJobFilters(sp);
  const session = await getSession();
  const supabase = await createClient();

  const [result, { data: services }, { data: detailers }, { data: dealerships }, { data: summary }] = await Promise.all([
    queryJobs(filters),
    supabase.from("services").select("id, name").order("sort_order"),
    filters.detailer && session.isAdmin ? supabase.from("profiles").select("id, full_name").eq("id", filters.detailer) : Promise.resolve({ data: [] }),
    supabase.from("dealerships").select("id, name").order("name"),
    supabase.rpc("jobs_filter_summary", {
      p_q: filters.q ?? null,
      p_service: filters.service ?? null,
      p_detailer: filters.detailer ?? null,
      p_dealership: filters.dealership ?? null,
      p_from: filters.from ? `${filters.from}T00:00:00` : null,
      p_to: filters.to ? `${filters.to}T23:59:59.999` : null,
      p_status: filters.status ?? "all",
    }),
  ]);
  const totals = (summary as { jobs: number; revenue: number } | null) ?? { jobs: result.total, revenue: 0 };
  const scope = [
    filters.service ? services?.find((s) => s.id === filters.service)?.name : null,
    filters.detailer ? detailers?.find((d) => d.id === filters.detailer)?.full_name : null,
    filters.dealership ? dealerships?.find((d) => d.id === filters.dealership)?.name : null,
    filters.status && filters.status !== "all" ? filters.status : null,
    filters.from || filters.to ? `${filters.from ? formatDateOnly(filters.from, "MMM d, yyyy") : "…"} – ${filters.to ? formatDateOnly(filters.to, "MMM d, yyyy") : "…"}` : null,
  ].filter(Boolean);

  return (
    <Page>
      <PageHeader
        title={session.isAdmin ? "Jobs" : "My jobs"}
        description={`${totals.jobs.toLocaleString()} ${totals.jobs === 1 ? "job" : "jobs"} · ${formatMoney(totals.revenue)}${scope.length ? ` · ${scope.join(" · ")}` : ""}`}
        actions={
          <Button asChild>
            <Link href="/jobs/new">
              <PlusIcon /> Log job
            </Link>
          </Button>
        }
      />
      <div className="mt-5 flex flex-col gap-4">
        <JobsFilters filters={filters} services={services ?? []} dealerships={dealerships ?? []} isAdmin={session.isAdmin} />
        <JobsTable rows={result.rows} page={result.page} pages={result.pages} isAdmin={session.isAdmin} />
      </div>
    </Page>
  );
}
