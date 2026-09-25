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

export const metadata: Metadata = { title: "Jobs" };

export default async function JobsPage(props: PageProps<"/jobs">) {
  const sp = await props.searchParams;
  const filters = parseJobFilters(sp);
  const session = await getSession();
  const supabase = await createClient();

  const [result, { data: services }, { data: detailers }, { data: dealerships }] = await Promise.all([
    queryJobs(filters),
    supabase.from("services").select("id, name").order("sort_order"),
    session.isAdmin ? supabase.from("profiles").select("id, full_name").order("full_name") : Promise.resolve({ data: [] }),
    supabase.from("dealerships").select("id, name").order("name"),
  ]);

  return (
    <Page>
      <PageHeader
        title={session.isAdmin ? "Jobs" : "My jobs"}
        description={`${result.total.toLocaleString()} ${result.total === 1 ? "job" : "jobs"} match`}
        actions={
          <Button asChild>
            <Link href="/jobs/new">
              <PlusIcon /> Log job
            </Link>
          </Button>
        }
      />
      <div className="mt-5 flex flex-col gap-4">
        <JobsFilters filters={filters} services={services ?? []} detailers={detailers ?? []} dealerships={dealerships ?? []} isAdmin={session.isAdmin} />
        <JobsTable rows={result.rows} page={result.page} pages={result.pages} isAdmin={session.isAdmin} />
      </div>
    </Page>
  );
}
