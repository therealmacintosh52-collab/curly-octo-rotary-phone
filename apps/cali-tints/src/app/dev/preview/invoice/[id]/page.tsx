import { SessionProvider } from "@/components/app/session-provider";
import { SyncProvider } from "@/components/offline/sync-provider";
import { AppShell } from "@/components/app/app-shell";
import { InvoiceDetail, type InvoiceDetailProps } from "@/components/invoices/invoice-detail";
import { invoiceBundleFixture, invoiceListFixture, priceListFixture } from "@/test/fixtures";
import type { Invoice, InvoiceItem, InvoiceListRow, InvoicePayment, Profile } from "@/lib/db/types";

/** Every row of the demo list opens as its own invoice: this builds the page from the list fixture (guest demo in production). */
export default async function DevInvoiceByIdPreview(props: PageProps<"/dev/preview/invoice/[id]">) {
  const { id } = await props.params;
  const rows = invoiceListFixture();
  const legacy = rows.find((r) => r.display_number === "INV-000012")!; // the old multi-car batch; also the fallback for unknown ids
  const row = rows.find((r) => r.id === id) ?? legacy;
  const base = invoiceBundleFixture();
  const profile = { id: "u1", company_id: base.company.id, role: "owner", full_name: "Owner (preview)", email: null, active: true } as Profile;
  const p = row === legacy ? legacyProps(base) : carProps(row, base);

  return (
    <SessionProvider value={{ userId: profile.id, email: null, profile, company: base.company, isAdmin: true, demo: true }}>
      <SyncProvider>
        <AppShell>
          <InvoiceDetail {...p} />
        </AppShell>
      </SyncProvider>
    </SessionProvider>
  );
}

const common = (base: ReturnType<typeof invoiceBundleFixture>) => ({
  company: base.company,
  priceList: priceListFixture(),
  detailers: [
    { id: "u1", full_name: "Owner (preview)" },
    { id: "u2", full_name: "Marco R." },
    { id: "u3", full_name: "Dee One" },
  ],
  isAdmin: true,
  reminderDays: 30,
  clover: { enabled: true, card: { publicKey: "demo", merchantId: "7G9V9DP834ZY2", sdkUrl: "about:blank" }, device: true, payLink: true, orderUrl: null as string | null },
});

/** The bundle fixture as-is: INV-000012, six cars, partly paid, overdue. */
function legacyProps(base: ReturnType<typeof invoiceBundleFixture>): InvoiceDetailProps {
  return {
    ...common(base),
    invoice: base.invoice,
    items: base.items,
    dealership: base.dealership,
    payments: base.payments,
    submissions: [
      { id: "s1", company_id: base.company.id, invoice_id: base.invoice.id, method: "email", status: "sent", recipients: ["ap@mbeldoradohills.example"], cc: ["billing@calitints.example"], provider: "resend", message_id: "3f1c2b0e-9d8a-4b1e-8c5a-1a2b3c4d5e6f", error: null, note: null, confirmation_path: null, created_by: "u1", created_at: base.invoice.submitted_at ?? base.invoice.created_at, created_by_name: "Owner", confirmation_url: null },
    ],
    car: null,
    canEdit: false,
    canDelete: false,
    lockedReason: null,
    archived: false,
    clover: { ...common(base).clover, orderUrl: "https://sandbox.dev.clover.com/orders/m/7G9V9DP834ZY2/ABC123" },
  };
}

/** A one-car invoice from a list row. */
function carProps(row: InvoiceListRow, base: ReturnType<typeof invoiceBundleFixture>): InvoiceDetailProps {
  const prices = Object.fromEntries(priceListFixture().map((s) => [s.name, s]));
  const c = row.cars[0];
  const [year, make, ...model] = (c.vehicle ?? "").split(" ");
  const performedAt = `${row.period_start}T17:30:00.000Z`;
  const dealership = { ...base.dealership, id: row.dealership_id, name: row.dealership, payment_terms: row.dealership_id === "d2" ? "Net 45" : null };
  // Service prices from the menu; the last line absorbs any rounding so the lines add up to the row's total.
  const lines = row.services.map((name) => ({ name, price: Number(prices[name]?.price ?? 0), service_id: prices[name]?.service_id ?? "s8" }));
  const sum = lines.reduce((s, l) => s + l.price, 0);
  if (lines.length && sum !== row.total) lines[lines.length - 1].price += row.total - sum;
  const items: InvoiceItem[] = lines.map((l, i) => ({
    id: `${row.id}-${i}`,
    company_id: base.company.id,
    invoice_id: row.id,
    job_id: `job-${row.id}`,
    job_service_id: null,
    sort_order: i + 1,
    performed_at: performedAt,
    tag_number: c.tag,
    vin: c.vin,
    year: Number(year) || null,
    make: make ?? null,
    model: model.join(" ") || null,
    color: c.tag === "4821" ? "Obsidian Black" : null,
    ro_po_number: row.ro_po_number,
    detailer_name: c.detailer,
    service_name: l.name,
    price: l.price,
  }));
  const invoice: Invoice = {
    ...base.invoice,
    id: row.id,
    dealership_id: row.dealership_id,
    number: Number(row.display_number.slice(4)),
    display_number: row.display_number,
    period_start: row.period_start,
    period_end: row.period_end,
    ro_po_number: row.ro_po_number,
    subtotal: row.total,
    tax: 0,
    total: row.total,
    amount_paid: row.amount_paid,
    status: row.status,
    payment_terms: dealership.payment_terms ?? base.company.payment_terms,
    notes: null,
    submitted_at: row.submitted_at,
    paid_at: row.paid_at ? row.paid_at.slice(0, 10) : null, // a date column in the database
    voided_at: row.status === "void" ? row.created_at : null,
    void_reason: row.status === "void" ? "Logged twice" : null,
    clover_order_id: row.status === "draft" ? null : `ORD${row.display_number.slice(-3)}`,
    clover_pushed_at: row.status === "draft" ? null : row.created_at,
    clover_checkout_url: null,
    clover_checkout_expires_at: null,
    created_at: row.created_at,
    updated_at: row.created_at,
  };
  const payments: InvoicePayment[] =
    row.amount_paid > 0
      ? [{ id: `pay-${row.id}`, company_id: base.company.id, invoice_id: row.id, amount: row.amount_paid, paid_at: (row.paid_at ?? row.created_at).slice(0, 10), method: row.status === "paid" ? "card" : "check", reference: row.status === "paid" ? null : "10488", note: null, created_by: null, source: row.status === "paid" ? "clover_pos" : "manual", clover_payment_id: row.status === "paid" ? "DEMO-POS-2" : null, clover_charge_id: null, created_at: row.paid_at ?? row.created_at }]
      : [];
  const isDraft = row.status === "draft" && row.amount_paid === 0;
  return {
    ...common(base),
    invoice,
    items,
    dealership,
    payments,
    submissions: row.submitted_at
      ? [{ id: `sub-${row.id}`, company_id: base.company.id, invoice_id: row.id, method: "email", status: "sent", recipients: ["ap@mbeldoradohills.example"], cc: ["billing@calitints.example"], provider: "resend", message_id: `msg-${row.display_number.toLowerCase()}`, error: null, note: null, confirmation_path: null, created_by: "u1", created_at: row.submitted_at, created_by_name: "Owner", confirmation_url: null }]
      : [],
    car: {
      id: `job-${row.id}`,
      dealership_id: row.dealership_id,
      detailer_id: c.detailer === "Dee One" ? "u3" : "u2",
      tag_number: c.tag,
      vin: c.vin,
      year: Number(year) || null,
      make: make ?? null,
      model: model.join(" ") || null,
      color: c.tag === "4821" ? "Obsidian Black" : null,
      performed_at: performedAt,
      ro_po_number: row.ro_po_number,
      notes: c.tag === "4821" ? "Customer waiting · light scratch on rear bumper noted before work" : null,
      detailer_name: c.detailer,
      services: lines.map((l) => ({ service_id: l.service_id, name: l.name, price: l.price, override_reason: null })),
    },
    canEdit: isDraft,
    canDelete: isDraft,
    archived: row.deleted,
    lockedReason: !isDraft && row.status !== "void" ? (row.amount_paid > 0 ? "A payment is recorded, so the car is locked" : "Sent to the dealership, so the car is locked") : null,
  };
}
