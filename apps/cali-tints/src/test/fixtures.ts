import type { InvoiceBundle } from "@/lib/invoices/load";
import type { InvoiceListRow, JobListRow, PriceListRow } from "@/lib/db/types";

/** A realistic invoice bundle for renderer tests and previews. */
export function invoiceBundleFixture(overrides: Partial<InvoiceBundle> = {}): InvoiceBundle {
  const companyId = "00000000-0000-4000-8000-000000000001";
  const invoiceId = "30000000-0000-4000-8000-000000000001";
  const base: InvoiceBundle = {
    company: {
      id: companyId,
      name: "Cali Tints",
      email: "billing@calitints.example",
      phone: "(555) 010-2030",
      address_line1: "1200 Auto Center Dr",
      address_line2: null,
      city: "Anaheim",
      state: "CA",
      postal_code: "92806",
      ein: "12-3456789",
      payment_terms: "",
      tax_rate: 0,
      invoice_prefix: "INV-",
      next_invoice_number: 13,
      reminder_days: 30,
      timezone: "America/Los_Angeles",
      auto_invoice: false,
      auto_send_monthly: true,
      quickbooks_realm_id: "9130357481234567",
      quickbooks_company_name: "Cali Tints LLC",
      quickbooks_env: "production",
      quickbooks_connected_at: "2026-09-01T16:00:00Z",
      quickbooks_item_id: "19",
      quickbooks_item_name: "Auto detailing",
      quickbooks_auto_push: true,
      quickbooks_last_sync_at: "2026-10-01T14:02:00Z",
      quickbooks_last_error: null,
      logo_path: null,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    dealership: {
      id: "00000000-0000-4000-8000-000000000101",
      company_id: companyId,
      name: "Mercedes-Benz of El Dorado Hills",
      address_line1: "1000 Mercedes Ln",
      address_line2: null,
      city: "El Dorado Hills",
      state: "CA",
      postal_code: "95762",
      contact_name: "Service Manager",
      contact_phone: null,
      ap_contact_name: "Accounts Payable",
      ap_emails: ["ap@mbeldoradohills.example"],
      submission_method: "email",
      invoice_mode: "batch",
      payment_terms: null,
      tax_rate: null,
      active: true,
      quickbooks_customer_id: "58",
      retail: false,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
    invoice: {
      id: invoiceId,
      company_id: companyId,
      dealership_id: "00000000-0000-4000-8000-000000000101",
      number: 12,
      display_number: "INV-000012",
      period_start: "2026-09-01",
      period_end: "2026-09-30",
      ro_po_number: null,
      subtotal: 790,
      tax_rate: 0,
      tax: 0,
      total: 790,
      amount_paid: 500,
      status: "partial",
      payment_terms: "",
      notes: "September batch. Includes two loaner returns.",
      submitted_at: "2026-10-01T17:00:00Z",
      paid_at: null,
      voided_at: null,
      void_reason: null,
      created_by: null,
      quickbooks_invoice_id: "1042",
      quickbooks_doc_number: "INV-000012",
      quickbooks_sync_token: "2",
      quickbooks_synced_at: "2026-10-01T16:31:00Z",
      quickbooks_error: null,
      quickbooks_balance: 290,
      quickbooks_balance_at: "2026-10-01T14:02:00Z",
      created_at: "2026-10-01T16:30:00Z",
      updated_at: "2026-10-01T16:30:00Z",
    },
    items: [
      ["2026-09-02T18:10:00Z", "4821", "W1KZF8DB3NA123456", 2024, "GLE 450", "Obsidian Black", "Used", 200],
      ["2026-09-03T18:10:00Z", "4829", "W1KZF8DB3NA123457", 2026, "GLE 450", "Obsidian Black", "PDI", 60],
      ["2026-09-05T20:00:00Z", "K-118", null, 2025, "C 300", "Polar White", "Service Loaner Detail", 125],
      ["2026-09-09T15:45:00Z", "7702", "WDDGF4HB3CR227845", 2023, "C-Class", null, "Used", 200],
      ["2026-09-12T15:45:00Z", "7702", "WDDGF4HB3CR227845", 2023, "C-Class", null, "Sold", 20],
      ["2026-09-18T21:20:00Z", "3310", "W1N4M4HB0PW412221", 2026, "GLB 250", "Iridium Silver", "PDI", 60],
      ["2026-09-26T16:00:00Z", "9051", null, 2022, "E 350", "Selenite Grey", "Service Loaner Detail", 125],
    ].map(([performed_at, tag, vin, year, model, color, service, price], i) => ({
      id: `40000000-0000-4000-8000-00000000000${i + 1}`,
      company_id: companyId,
      invoice_id: invoiceId,
      job_id: null,
      job_service_id: null,
      sort_order: i + 1,
      performed_at: performed_at as string,
      tag_number: tag as string,
      vin: vin as string | null,
      year: year as number,
      make: "Mercedes-Benz",
      model: model as string,
      color: color as string | null,
      ro_po_number: null,
      detailer_name: null,
      service_name: service as string,
      price: price as number,
    })),
    payments: [
      {
        id: "50000000-0000-4000-8000-000000000001",
        company_id: companyId,
        invoice_id: invoiceId,
        amount: 500,
        paid_at: "2026-10-20",
        method: "check",
        reference: "10442",
        note: null,
        created_by: null,
        created_at: "2026-10-20T00:00:00Z",
      },
    ],
    submissions: [],
    logoDataUri: null,
  };
  return { ...base, ...overrides };
}

const EDH = { dealership_id: "d1", dealership: "Mercedes-Benz of El Dorado Hills" };
const SAC = { dealership_id: "d2", dealership: "Mercedes-Benz of Sacramento" };
const FUL = { dealership_id: "d3", dealership: "Cali Tint · Fulton Ave" };
const PRICE: Record<string, number> = { Used: 200, PDI: 60, Sold: 20, "Service Loaner Detail": 125, "Touch Up Detail": 30, "Paint Correction (1-step)": 50 };
const MODELS = ["GLE 450", "GLC 300", "E 350", "GLB 250", "C 300", "GLA 250", "EQE 350", "S 580", "GLE 350", "A 220", "CLA 250", "EQB 300"];
const VINS = ["W1KZF8DB3NA123456", "W1N0G8DB5PV220114", "W1KZF8DB1RA331902", "W1N4M4HB0PW412221", "4JGFB4JB5SA901221", "W1K6G7GB3NA000111", "4JGFB4KB1MA228870", "W1KAF4HB3SR118204"];
const DETAILERS = ["Victor", "Dee One", "Sam"];

const ymdOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};

/** One day's worth of fixture cars for a dealership: about 3 Used, 2 PDI, 4 Sold, the odd loaner. Deterministic. */
export interface FixtureCar {
  tag: string;
  vehicle: string;
  vin: string | null;
  detailer: string;
  service: string;
  price: number;
  dealership_id: string;
  dealership: string;
  day: string;
  performed_at: string;
}
export function fixtureCars(day: Date, dealer: typeof EDH, seed: number): FixtureCar[] {
  const dow = day.getDay();
  const count = dow === 0 ? 3 : dow === 6 ? 4 : 7 + (seed % 3); // a quiet Sunday, a short Saturday
  const out: FixtureCar[] = [];
  for (let i = 0; i < count; i++) {
    const k = seed * 7 + i;
    const service = i < 3 ? "Used" : i < 5 ? "PDI" : i === 5 && k % 4 === 0 ? "Service Loaner Detail" : "Sold";
    const year = 2021 + (k % 6);
    const model = MODELS[k % MODELS.length];
    const tag = dealer === SAC ? `K-${100 + ((k * 13) % 90)}` : String(4700 + ((k * 37) % 160));
    const price = dealer === SAC && service === "Used" ? 215 : PRICE[service];
    const at = new Date(day);
    at.setHours(8 + (i % 9), (k * 11) % 60, 0, 0);
    // Today's cars never sit in the future (the previews run at any hour): fold them into the minutes just gone.
    const now = Date.now();
    if (at.getTime() > now && ymdOf(day) === ymdOf(new Date(now))) at.setTime(now - (i + 1) * 7 * 60000);
    out.push({ tag, vehicle: `${year} Mercedes-Benz ${model}`, vin: service === "Sold" ? null : VINS[k % VINS.length], detailer: DETAILERS[k % 3], service, price, ...dealer, day: ymdOf(day), performed_at: at.toISOString() });
  }
  return out;
}

/** Every car of a calendar month for a dealership (the month's invoice lines). */
export function fixtureMonth(monthStart: Date, dealer: typeof EDH): FixtureCar[] {
  const out: FixtureCar[] = [];
  const d = new Date(monthStart);
  while (d.getMonth() === monthStart.getMonth()) {
    out.push(...fixtureCars(new Date(d), dealer, d.getDate() + (dealer === SAC ? 50 : 0)));
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/**
 * The Invoices list preview: one invoice per dealership per month for the
 * last six months (never the month in progress), in every state: not sent,
 * sent, partly paid, paid, overdue, and one deleted.
 */
export function invoiceListFixture(): InvoiceListRow[] {
  const rows: InvoiceListRow[] = [];
  const now = new Date();
  let n = 61;
  for (let back = 1; back <= 6; back++) {
    const start = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - back + 1, 0);
    for (const dealer of [EDH, SAC]) {
      n -= 1;
      // Sacramento invoices fewer cars: a smaller store.
      const cars = fixtureMonth(start, dealer).filter((c, i) => dealer === EDH || i % 2 === 0);
      const total = Math.round(cars.reduce((s, c) => s + c.price, 0) * 100) / 100;
      const status: InvoiceListRow["status"] = back === 1 ? (dealer === EDH ? "submitted" : "draft") : back === 2 ? (dealer === SAC ? "partial" : "paid") : back === 3 && dealer === EDH ? "submitted" : back === 5 && dealer === SAC ? "void" : "paid";
      const amount_paid = status === "paid" ? total : status === "partial" ? Math.round(total * 0.6) : 0;
      const sentAt = new Date(end);
      sentAt.setDate(sentAt.getDate() + 1);
      sentAt.setHours(14, 5, 0, 0);
      const paidAt = new Date(sentAt);
      paidAt.setDate(paidAt.getDate() + 22);
      const deleted = status === "void";
      rows.push({
        id: `30000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`,
        display_number: `INV-${String(n).padStart(6, "0")}`,
        status,
        overdue: status === "submitted" && back >= 3,
        deleted,
        total,
        amount_paid,
        balance: status === "paid" || status === "void" ? 0 : total - amount_paid,
        period_start: ymdOf(start),
        period_end: ymdOf(end),
        ro_po_number: null,
        submitted_at: status === "draft" || status === "void" ? null : sentAt.toISOString(),
        paid_at: status === "paid" ? paidAt.toISOString() : null,
        created_at: sentAt.toISOString(),
        ...dealer,
        car_count: cars.length,
        cars: cars.slice(0, 4).map((c) => ({ tag: c.tag, vin: c.vin, vehicle: c.vehicle, detailer: null })),
        services: [...new Set(cars.map((c) => c.service))],
        quickbooks_invoice_id: status === "void" ? null : String(1000 + n),
        quickbooks_doc_number: status === "void" ? null : String(1000 + n),
        quickbooks_error: null,
      });
    }
  }
  return rows;
}

/**
 * The Jobs list preview: the month in progress (today, yesterday, two days
 * ago and back to the 1st, not invoiced yet) plus last month's cars, which
 * sit on last month's invoices.
 */
export function jobListFixture(): JobListRow[] {
  const rows: JobListRow[] = [];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonth = invoiceListFixture().filter((r) => r.period_start === ymdOf(new Date(now.getFullYear(), now.getMonth() - 1, 1)));
  let n = 0;
  const push = (c: FixtureCar, invoice: InvoiceListRow | null, deleted = false) => {
    n += 1;
    rows.push({
      id: `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
      performed_at: c.performed_at,
      day: c.day,
      tag: c.tag,
      vin: c.vin,
      vehicle: c.vehicle,
      color: n % 3 === 0 ? "Obsidian Black" : n % 3 === 1 ? "Polar White" : null,
      ...{ dealership_id: c.dealership_id, dealership: c.dealership },
      detailer_id: c.detailer === "Victor" ? "u2" : c.detailer === "Dee One" ? "u3" : "u5",
      detailer: null,
      // The second car of the month-in-progress was logged with "Other" and no price: the owner's "Needs price" flag in previews.
      services: n === 2 && !invoice ? [c.service, "Other"] : c.service === "Used" && n % 5 === 0 ? [c.service, "Touch Up Detail"] : [c.service],
      invoice_id: invoice?.id ?? null,
      display_number: invoice?.display_number ?? null,
      invoice_status: invoice?.status ?? null,
      quickbooks_doc_number: deleted ? null : invoice ? invoice.quickbooks_invoice_id ?? null : c.dealership_id === "d1" ? "1061" : "1062",
      photo_count: n % 4 === 0 ? 2 : n % 7 === 0 ? 1 : 0,
      deleted,
    });
  };
  // This month, newest first, never later than now.
  for (let back = 0; ; back++) {
    const day = daysAgo(back);
    if (day < monthStart) break;
    for (const dealer of [EDH, SAC]) {
      const cars = fixtureCars(day, dealer, day.getDate() + (dealer === SAC ? 50 : 0)).filter((c, i) => dealer === EDH || i % 2 === 0);
      for (const c of cars) if (new Date(c.performed_at) <= now) push(c, null);
    }
  }
  // The shop: two walk-in customers today, one paid on the Clover, one still to collect.
  const nowIso = new Date().toISOString();
  for (const [tag, vehicle, paid] of [["R-101", "2019 Toyota Camry", true], ["R-102", "2022 Tesla Model 3", false]] as const) {
    n += 1;
    rows.push({
      id: `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
      performed_at: new Date(Date.now() - (paid ? 150 : 40) * 60000).toISOString(),
      day: ymdOf(new Date()),
      tag,
      vin: null,
      vehicle,
      color: paid ? "Silver" : "Red",
      ...FUL,
      detailer_id: "u2",
      detailer: "Victor",
      services: ["Used"],
      invoice_id: null,
      display_number: null,
      invoice_status: null,
      quickbooks_doc_number: null,
      retail: true,
      paid_at: paid ? nowIso : null,
      photo_count: 0,
      deleted: false,
    });
  }
  // One deleted one from yesterday, for the archive.
  const yd = fixtureCars(daysAgo(1), EDH, 99)[0];
  if (yd) push({ ...yd, tag: "4799" }, null, true);
  // Last month: invoiced.
  for (const inv of lastMonth) {
    const dealer = inv.dealership_id === "d1" ? EDH : SAC;
    const cars = fixtureMonth(new Date(now.getFullYear(), now.getMonth() - 1, 1), dealer).filter((c, i) => dealer === EDH || i % 2 === 0);
    for (const c of cars) push(c, inv);
  }
  rows.sort((a, b) => (a.performed_at < b.performed_at ? 1 : -1));
  return rows;
}

/** The seeded menu, as the price list RPC returns it (previews). Everyone but the owner gets it without prices. */
export function priceListFixture(owner = true): PriceListRow[] {
  const rows: PriceListRow[] = [
    { service_id: "s1", name: "PDI", description: "New car pre-delivery inspection prep", category: "new", price: 60, price_min: null, price_max: null, is_override: false, sort_order: 10, open_amount: false },
    { service_id: "s2", name: "Sold", description: "Delivery clean on a sold unit", category: "new", price: 20, price_min: null, price_max: null, is_override: false, sort_order: 20, open_amount: false },
    { service_id: "s3", name: "Used", description: "Used car full detail", category: "used", price: 200, price_min: null, price_max: null, is_override: false, sort_order: 30, open_amount: false },
    { service_id: "s4", name: "Service Loaner Detail", description: "Full detail on a service loaner", category: "service", price: 125, price_min: null, price_max: null, is_override: false, sort_order: 40, open_amount: false },
    { service_id: "s5", name: "Touch Up Detail", description: "Quick touch-up by condition", category: "addon", price: 30, price_min: 20, price_max: 40, is_override: false, sort_order: 50, open_amount: false },
    { service_id: "s6", name: "Tint Removal", description: "Strip old tint on a used unit", category: "addon", price: 40, price_min: null, price_max: null, is_override: false, sort_order: 60, open_amount: false },
    { service_id: "s7", name: "Paint Correction (1-step)", description: "Single-stage machine polish", category: "addon", price: 50, price_min: 40, price_max: 60, is_override: false, sort_order: 70, open_amount: false },
    { service_id: "s8", name: "Other", description: "Anything not on the menu", category: "addon", price: 0, price_min: 0, price_max: 100000, is_override: false, sort_order: 80, open_amount: true },
  ];
  return owner ? rows : rows.map((r) => ({ ...r, price: null, price_min: null, price_max: null, is_override: false }));
}
