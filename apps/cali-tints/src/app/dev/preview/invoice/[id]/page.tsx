import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { InvoiceDetail, type InvoiceDetailProps } from "@/components/invoices/invoice-detail";
import { fixtureMonth, invoiceBundleFixture, invoiceListFixture, priceListFixture } from "@/test/fixtures";
import type { Invoice, InvoiceItem, InvoiceListRow, InvoicePayment, Profile } from "@/lib/db/types";

/** Every row of the demo list opens as its own invoice: one dealership, one month, every car (guest demo in production). */
export default async function DevInvoiceByIdPreview(props: PageProps<"/dev/preview/invoice/[id]">) {
  const { id } = await props.params;
  const rows = invoiceListFixture();
  const row = rows.find((r) => r.id === id) ?? rows[0];
  const base = invoiceBundleFixture();
  const profile = { id: "u1", company_id: base.company.id, role: "owner", full_name: "Mike", email: null, active: true } as Profile;
  const p = monthProps(row, base);

  return (
    <SessionProvider value={{ userId: profile.id, email: null, profile, company: base.company, isAdmin: true, canSettings: true, canMoney: true, canPrices: true, demo: true }}>
      <SyncProvider>
        <AppShell>
          <InvoiceDetail {...p} quickbooks={{ connected: true, appUrl: "https://app.qbo.intuit.com" }} />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}

/** A month's invoice from a list row: the same cars the fixtures put in that month. */
function monthProps(row: InvoiceListRow, base: ReturnType<typeof invoiceBundleFixture>): InvoiceDetailProps {
  const [y, m] = row.period_start.split("-").map(Number);
  const dealer = { dealership_id: row.dealership_id, dealership: row.dealership };
  const cars = fixtureMonth(new Date(y, m - 1, 1), dealer).filter((c, i) => row.dealership_id === "d1" || i % 2 === 0);
  const dealership = { ...base.dealership, id: row.dealership_id, name: row.dealership, payment_terms: null, ap_emails: row.dealership_id === "d1" ? ["ap@mbeldoradohills.example"] : ["ap@mbsacramento.example"] };
  const items: InvoiceItem[] = cars.map((c, i) => {
    const [year, make, ...model] = c.vehicle.split(" ");
    return {
      id: `${row.id}-${i}`,
      company_id: base.company.id,
      invoice_id: row.id,
      job_id: `job-${row.id}-${i}`,
      job_service_id: null,
      sort_order: i + 1,
      performed_at: c.performed_at,
      tag_number: c.tag,
      vin: c.vin,
      year: Number(year) || null,
      make: make ?? null,
      model: model.join(" ") || null,
      color: null,
      ro_po_number: null,
      detailer_name: c.detailer,
      service_name: c.service,
      price: c.price,
    };
  });
  const invoice: Invoice = {
    ...base.invoice,
    id: row.id,
    dealership_id: row.dealership_id,
    number: Number(row.display_number.slice(4)),
    display_number: row.display_number,
    period_start: row.period_start,
    period_end: row.period_end,
    ro_po_number: null,
    subtotal: row.total,
    tax: 0,
    tax_rate: 0,
    total: row.total,
    amount_paid: row.amount_paid,
    status: row.status,
    payment_terms: "",
    notes: null,
    submitted_at: row.submitted_at,
    paid_at: row.paid_at ? row.paid_at.slice(0, 10) : null, // a date column in the database
    voided_at: row.status === "void" ? row.created_at : null,
    void_reason: row.status === "void" ? "Dealer asked for a split invoice" : null,
    created_at: row.created_at,
    updated_at: row.created_at,
  };
  const payments: InvoicePayment[] =
    row.amount_paid > 0
      ? [{ id: `pay-${row.id}`, company_id: base.company.id, invoice_id: row.id, amount: row.amount_paid, paid_at: (row.paid_at ?? row.created_at).slice(0, 10), method: "check", reference: `10${row.display_number.slice(-3)}`, note: null, created_by: null, created_at: row.paid_at ?? row.created_at }]
      : [];
  return {
    company: base.company,
    priceList: priceListFixture(),
    detailers: [
      { id: "u1", full_name: "Mike" },
      { id: "u2", full_name: "Victor" },
      { id: "u3", full_name: "Dee One" },
    ],
    isAdmin: true,
    reminderDays: 30,
    invoice,
    items,
    dealership,
    payments,
    submissions: row.submitted_at
      ? [{ id: `sub-${row.id}`, company_id: base.company.id, invoice_id: row.id, method: "email", status: "sent", recipients: dealership.ap_emails, cc: ["billing@calitints.example"], provider: "resend", message_id: `msg-${row.display_number.toLowerCase()}`, error: null, note: null, confirmation_path: null, created_by: null, created_at: row.submitted_at, created_by_name: "Month close", confirmation_url: null }]
      : [],
    car: null,
    canEdit: false,
    canDelete: false,
    lockedReason: null,
    archived: row.deleted,
  };
}
