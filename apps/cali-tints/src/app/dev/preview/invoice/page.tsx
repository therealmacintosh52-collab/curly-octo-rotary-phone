import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { Page } from "@/components/app/page-header";
import { InvoiceActions } from "@/components/invoices/invoice-actions";
import { PaymentsCard } from "@/components/invoices/payments-card";
import { SubmissionsCard } from "@/components/invoices/submissions-card";
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge";
import { InvoiceBuilder } from "@/components/invoices/invoice-builder";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { invoiceBundleFixture } from "@/test/fixtures";
import { formatMoney } from "@/lib/money";
import { isoDaysAgo } from "@/lib/dates";
import type { Profile } from "@/lib/db/types";

/** Dev-only fixture preview of the invoice detail widgets and the builder. 404 in production. */
export default function DevInvoicePreview() {
  const b = invoiceBundleFixture();
  const profile = { id: "u1", company_id: b.company.id, role: "owner", full_name: "Owner (preview)", email: null, active: true } as Profile;
  const balance = Number(b.invoice.total) - Number(b.invoice.amount_paid);

  return (
    <SessionProvider value={{ userId: profile.id, email: null, profile, company: b.company, isAdmin: true, demo: true }}>
      <SyncProvider>
        <AppShell>
          <Page>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">{b.invoice.display_number}</h1>
              <InvoiceStatusBadge status={b.invoice.status} overdue />
            </div>
            <p className="mt-1 text-lg">{b.dealership.name}</p>
            <div className="mt-5">
              <InvoiceActions
                invoice={{ id: b.invoice.id, status: b.invoice.status, display_number: b.invoice.display_number, amount_paid: 500, total: Number(b.invoice.total), notes: null }}
                dealership={{ name: b.dealership.name, ap_emails: b.dealership.ap_emails, submission_method: "email" }}
                companyEmail={b.company.email}
              />
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_360px]">
              <Card>
                <CardHeader>
                  <CardTitle>Line items</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {b.items.length} lines · {formatMoney(b.invoice.total)}
                </CardContent>
              </Card>
              <div className="flex flex-col gap-4">
                <PaymentsCard invoiceId={b.invoice.id} payments={b.payments} balance={balance} status={b.invoice.status} />
                <SubmissionsCard
                  submittedAt={b.invoice.submitted_at}
                  submissions={[
                    { id: "s1", company_id: b.company.id, invoice_id: b.invoice.id, method: "email", status: "sent", recipients: ["ap@mbanaheim.example"], cc: ["billing@calitints.example"], provider: "resend", message_id: "3f1c2b0e-9d8a-4b1e-8c5a-1a2b3c4d5e6f", error: null, note: null, confirmation_path: null, created_by: "u1", created_at: isoDaysAgo(3), created_by_name: "Owner", confirmation_url: null },
                    { id: "s2", company_id: b.company.id, invoice_id: b.invoice.id, method: "email", status: "failed", recipients: ["ap@mbanaheim.example"], cc: [], provider: "resend", message_id: null, error: "Email is not configured: set RESEND_API_KEY and EMAIL_FROM", note: null, confirmation_path: null, created_by: "u1", created_at: isoDaysAgo(4), created_by_name: "Owner", confirmation_url: null },
                  ]}
                />
              </div>
            </div>
            <div className="mt-10 border-t border-border pt-8">
              <h2 className="mb-4 text-xl font-semibold">Builder</h2>
              <InvoiceBuilder
                conflicts={[
                  { job_id: "j0", other_job_id: "x1", kind: "invoiced", other_tag: "4821", other_vin: "W1KZF8DB3NA123456", other_performed_at: "2026-08-20T18:00:00Z", other_invoice_number: "INV-000009", other_services: "Used", shared_services: "Used", match_on: "vin" },
                  { job_id: "j2", other_job_id: "x2", kind: "in_batch", other_tag: "K-118", other_vin: null, other_performed_at: "2026-09-04T18:00:00Z", other_invoice_number: null, other_services: "PDI", shared_services: null, match_on: "tag" },
                ]}
                dealerships={[b.dealership, { ...b.dealership, id: "d2", name: "Mercedes-Benz of Irvine", invoice_mode: "per_job" }]}
                dealershipId={b.dealership.id}
                from="2026-09-01"
                to="2026-09-30"
                taxRate={0}
                preview={b.items.slice(0, 4).map((it, i) => ({
                  id: `j${i}`,
                  tag_number: it.tag_number,
                  vin: it.vin,
                  year: it.year,
                  make: it.make,
                  model: it.model,
                  performed_at: it.performed_at,
                  ro_po_number: it.ro_po_number,
                  detailer: it.detailer_name ?? "",
                  services: [{ name: it.service_name, price: Number(it.price) }],
                  total: Number(it.price),
                  dup_review_note: i === 3 ? "Second job on same unit, approved by SM" : null,
                }))}
              />
            </div>
          </Page>
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}
