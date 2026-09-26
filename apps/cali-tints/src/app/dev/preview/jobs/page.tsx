import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { Page, PageHeader } from "@/components/app/page-header";
import { JobsFilters } from "@/components/jobs/jobs-filters";
import { JobsTable } from "@/components/jobs/jobs-table";
import { AuditTimeline } from "@/components/jobs/audit-timeline";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { JobListRow } from "@/lib/jobs/query";
import type { AuditLog, Company, Profile } from "@/lib/db/types";
import { isoDaysAgo } from "@/lib/dates";

/** Dev-only fixture preview of the job list + audit timeline. 404 in production. */
export default function DevJobsPreview() {
  if (process.env.NODE_ENV === "production") notFound();

  const company = { id: "c1", name: "Cali Tints", payment_terms: "Net 30", tax_rate: 0, invoice_prefix: "INV-", next_invoice_number: 1, reminder_days: 30, timezone: "America/Los_Angeles" } as Company;
  const profile = { id: "u1", company_id: "c1", role: "owner", full_name: "Mike (preview)", email: null, active: true } as Profile;

  const rows: JobListRow[] = [
    {
      id: "j1", tag_number: "4821", vin: "W1KZF8DB3NA123456", year: 2024, make: "Mercedes-Benz", model: "GLE 450", color: "Obsidian Black",
      performed_at: isoDaysAgo(0), ro_po_number: null, status: "logged", invoice_id: null, deleted_at: null,
      dealership: { name: "Mercedes-Benz of Anaheim" }, detailer: { full_name: "Marco R." }, invoice: null,
      job_services: [{ price: 150, service: { name: "Used Car Detail (Full)" } }, { price: 35, service: { name: "PDI (New Car Prep)" } }],
    },
    {
      id: "j2", tag_number: "K-118", vin: null, year: 2023, make: "Mercedes-Benz", model: "C 300", color: "Polar White",
      performed_at: isoDaysAgo(2), ro_po_number: "RO-55821", status: "invoiced", invoice_id: "i1", deleted_at: null,
      dealership: { name: "Mercedes-Benz of Irvine" }, detailer: { full_name: "Dee One" }, invoice: { display_number: "INV-000012", status: "submitted" },
      job_services: [{ price: 399, service: { name: "Window Tint (Full)" } }],
    },
    {
      id: "j3", tag_number: "7702", vin: "WDDGF4HB3CR227845", year: 2012, make: "Mercedes-Benz", model: "C-Class", color: null,
      performed_at: isoDaysAgo(9), ro_po_number: null, status: "invoiced", invoice_id: "i0", deleted_at: null,
      dealership: { name: "Mercedes-Benz of Anaheim" }, detailer: { full_name: "Marco R." }, invoice: { display_number: "INV-000009", status: "paid" },
      job_services: [{ price: 45, service: { name: "Service Wash" } }, { price: 185, service: { name: "CPO Detail" } }],
    },
  ];

  const audit: AuditLog[] = [
    { id: 3, company_id: "c1", actor_id: "u1", table_name: "jobs", row_id: "j1", action: "update", old_data: { color: null, notes: null }, new_data: { color: "Obsidian Black", notes: "Curb rash rear left" }, changed: ["color", "notes"], created_at: isoDaysAgo(0) },
    { id: 2, company_id: "c1", actor_id: "u2", table_name: "job_services", row_id: "s1", action: "insert", old_data: null, new_data: { price: 150 }, changed: null, created_at: isoDaysAgo(1) },
    { id: 1, company_id: "c1", actor_id: "u2", table_name: "jobs", row_id: "j1", action: "insert", old_data: null, new_data: {}, changed: null, created_at: isoDaysAgo(1) },
  ];

  return (
    <SessionProvider value={{ userId: profile.id, email: null, profile, company, isAdmin: true }}>
      <SyncProvider>
        <AppShell>
          <Page>
            <PageHeader title="Jobs" description="3 jobs match" />
            <div className="mt-5 flex flex-col gap-4">
              <Suspense>
                <JobsFilters
                  filters={{ status: "all", page: 1 }}
                  services={[{ id: "s1", name: "Used Car Detail (Full)" }, { id: "s2", name: "PDI (New Car Prep)" }]}
                  detailers={[{ id: "u2", full_name: "Marco R." }]}
                  dealerships={[{ id: "d1", name: "Mercedes-Benz of Anaheim" }, { id: "d2", name: "Mercedes-Benz of Irvine" }]}
                  isAdmin
                />
              </Suspense>
              <JobsTable rows={rows} page={1} pages={1} isAdmin />
              <Card>
                <CardHeader><CardTitle>History</CardTitle></CardHeader>
                <CardContent><AuditTimeline entries={audit} actorNames={{ u1: "Mike", u2: "Marco R." }} /></CardContent>
              </Card>
            </div>
          </Page>
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
