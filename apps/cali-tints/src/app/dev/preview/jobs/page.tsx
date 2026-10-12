import { Suspense } from "react";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { Page, PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { JobFilters } from "@/components/jobs/job-filters";
import { JobList } from "@/components/jobs/job-list";
import { invoiceBundleFixture, jobListFixture } from "@/test/fixtures";
import { JOB_STATUS_LABELS, parseJobFilters, resolveJobFilters } from "@/lib/jobs/query";
import type { Profile } from "@/lib/db/types";
import { toDateInput } from "@/lib/dates";

const SERVICES = [
  { id: "s1", name: "PDI" },
  { id: "s2", name: "Sold" },
  { id: "s3", name: "Used" },
  { id: "s4", name: "Service Loaner Detail" },
  { id: "s5", name: "Touch Up Detail" },
  { id: "s7", name: "Paint Correction (1-step)" },
];
const DEALERSHIPS = [
  { id: "d1", name: "Mercedes-Benz of El Dorado Hills" },
  { id: "d2", name: "Mercedes-Benz of Sacramento" },
  { id: "d3", name: "Cali Tint · Fulton Ave" },
];
const DETAILERS = [
  { id: "u2", full_name: "Victor" },
  { id: "u3", full_name: "Dee One" },
  { id: "u5", full_name: "Sam" },
];

/** Fixture preview of the Jobs list (guest demo in production). `?as=team` is an admin's view, `?as=detailer` Sam's own jobs. */
export default async function DevJobsPreview(props: PageProps<"/dev/preview/jobs">) {
  const sp = await props.searchParams;
  const typed = parseJobFilters(sp);
  const { company } = invoiceBundleFixture();
  const asDetailer = sp.as === "detailer";
  const asTeam = sp.as === "team";
  const profile = (asDetailer
    ? { id: "u5", company_id: company.id, role: "detailer", full_name: "Sam", email: null, active: true }
    : asTeam
      ? { id: "u4", company_id: company.id, role: "admin", full_name: "Manny", email: null, active: true }
      : { id: "u1", company_id: company.id, role: "owner", full_name: "Mike", email: null, active: true }) as Profile;
  const isAdmin = !asDetailer;
  const canMoney = !asDetailer && !asTeam;
  // The owner sees which open jobs still need a price (fixture: the one logged with "Other").
  const flagged = canMoney ? jobListFixture().filter((r) => r.services.includes("Other") && !r.invoice_id && !r.deleted).map((r) => r.id) : [];

  const today = toDateInput(new Date());
  const filters = resolveJobFilters(typed, today);
  const q = filters.q?.toUpperCase();
  const rows = jobListFixture().filter((r) => {
    if (!isAdmin && r.detailer_id !== "u5") return false;
    const st = filters.status;
    if (st === "all" && r.deleted) return false;
    if (st === "open" && (r.deleted || r.invoice_id)) return false;
    if (st === "invoiced" && (r.deleted || !r.invoice_id)) return false;
    if (st === "deleted" && !r.deleted) return false;
    if (filters.dealership && r.dealership_id !== filters.dealership) return false;
    if (filters.detailer && r.detailer_id !== filters.detailer) return false;
    if (filters.service && !r.services.includes(SERVICES.find((s) => s.id === filters.service)?.name ?? "")) return false;
    if (filters.from && r.day < filters.from) return false;
    if (filters.to && r.day > filters.to) return false;
    if (q && !(r.tag.includes(q) || (r.vin ?? "").includes(q) || (r.vehicle ?? "").toUpperCase().includes(q) || r.services.some((s) => s.toUpperCase().includes(q)) || r.dealership.toUpperCase().includes(q) || (r.display_number ?? "").includes(q))) return false;
    return true;
  });
  const scope = [filters.status !== "all" ? JOB_STATUS_LABELS[filters.status] : null, filters.dealership ? DEALERSHIPS.find((d) => d.id === filters.dealership)?.name : null, filters.detailer ? DETAILERS.find((d) => d.id === filters.detailer)?.full_name : null, filters.service ? SERVICES.find((s) => s.id === filters.service)?.name : null, filters.searchDate?.label ?? null].filter(Boolean);
  const filtered = scope.length > 0 || !!filters.q || !!filters.from || !!filters.to;
  const summary = [`${rows.length} ${rows.length === 1 ? "car" : "cars"}`, ...scope].filter(Boolean);
  const params = new URLSearchParams(Object.entries(sp).flatMap(([k, v]) => (typeof v === "string" ? [[k, v]] : []))).toString();

  return (
    <SessionProvider value={{ userId: profile.id, email: null, profile, company, isAdmin, canSettings: isAdmin, canMoney, canPrices: isAdmin && !asDetailer, demo: true }}>
      <SyncProvider>
        <AppShell>
          <Page>
            <PageHeader
              title={isAdmin ? "Jobs" : "My jobs"}
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
                <JobFilters filters={typed} searchDate={filters.searchDate} services={SERVICES} dealerships={DEALERSHIPS} detailers={DETAILERS} isAdmin={isAdmin} />
              </Suspense>
              <JobList rows={rows.slice(0, 50)} page={1} count={rows.length} params={params} isAdmin={isAdmin} filtered={filtered} today={today} flagged={flagged} />
            </div>
          </Page>
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
