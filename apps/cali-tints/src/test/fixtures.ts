import type { InvoiceBundle } from "@/lib/invoices/load";
import type { InvoiceListRow, PriceListRow, TerminalTransaction } from "@/lib/db/types";

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
      payment_terms: "Net 30",
      tax_rate: 0,
      invoice_prefix: "INV-",
      next_invoice_number: 13,
      reminder_days: 30,
      timezone: "America/Los_Angeles",
      clover_enabled: false,
      clover_env: "sandbox",
      clover_merchant_id: null,
      clover_push_orders: true,
      clover_hosted_checkout: true,
      clover_last_sync_at: null, clover_verified_at: null, clover_connected_at: null, clover_merchant_name: null, clover_device_id: null, clover_pos_id: "Cali Tints app", auto_invoice: true,
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
      payment_terms: "Net 30",
      notes: "September batch. Includes two loaner returns.",
      submitted_at: "2026-10-01T17:00:00Z",
      paid_at: null,
      voided_at: null,
      void_reason: null,
      clover_order_id: null,
      clover_pushed_at: null,
      clover_checkout_session_id: null,
      clover_checkout_url: null,
      clover_checkout_expires_at: null,
      created_by: null,
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
      detailer_name: i % 2 ? "Dee One" : "Marco R.",
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
        source: "manual",
        clover_payment_id: null,
        clover_charge_id: null,
        created_at: "2026-10-20T00:00:00Z",
      },
    ],
    submissions: [],
    logoDataUri: null,
  };
  return { ...base, ...overrides };
}

/** A day at the till for the Terminal preview: sales, a partial refund, an invoice payment recorded elsewhere. */
export function terminalTransactionsFixture(): TerminalTransaction[] {
  const day = new Date();
  const at = (h: number, m: number) => new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).toISOString();
  const base = { refund_of: null, group_id: null, customer_email: null, reference: null, receipt_sent_at: null, refunded_amount: 0, status: "captured" as const, kind: "sale" as const };
  const g = "70000000-0000-4000-8000-00000000000a";
  return [
    { ...base, id: "70000000-0000-4000-8000-000000000008", group_id: g, amount: 4210, method: "card", source: "clover_pos", invoice_id: "30000000-0000-4000-8000-000000000003", invoice_number: "INV-000010", dealership: "Mercedes-Benz of Sacramento", payment_id: "70000000-0000-4000-8000-000000000018", description: null, customer_name: "Mercedes-Benz of Sacramento", customer_email: "ap@mbsacramento.example", card_brand: "VISA", last4: "9010", clover_payment_id: "DEMO-POS-8", at: at(16, 20) },
    { ...base, id: "70000000-0000-4000-8000-000000000007", group_id: g, amount: 1375.5, method: "card", source: "clover_pos", invoice_id: "30000000-0000-4000-8000-000000000002", invoice_number: "INV-000011", dealership: "Mercedes-Benz of Sacramento", payment_id: "70000000-0000-4000-8000-000000000017", description: null, customer_name: "Mercedes-Benz of Sacramento", customer_email: "ap@mbsacramento.example", card_brand: "VISA", last4: "9010", clover_payment_id: "DEMO-POS-8", at: at(16, 20) },
    { ...base, id: "70000000-0000-4000-8000-000000000006", amount: 285, method: "card", source: "clover_pos", invoice_id: null, invoice_number: null, dealership: null, payment_id: null, description: "Full detail · black GLE 450", customer_name: "R. Alvarez", card_brand: "VISA", last4: "4242", clover_payment_id: "DEMO-POS-6", at: at(15, 40) },
    { ...base, id: "70000000-0000-4000-8000-000000000005", kind: "refund", amount: 40, method: "card", source: "clover_card", invoice_id: null, invoice_number: null, dealership: null, payment_id: null, refund_of: "70000000-0000-4000-8000-000000000003", description: "Tint · 2 front windows", customer_name: "Walk-in", card_brand: "MC", last4: "1111", clover_payment_id: "charge_DEMO3", at: at(14, 5) },
    { ...base, id: "70000000-0000-4000-8000-000000000004", amount: 1875.5, method: "check", source: "manual", invoice_id: "30000000-0000-4000-8000-000000000002", invoice_number: "INV-000011", dealership: "Mercedes-Benz of Sacramento", payment_id: "70000000-0000-4000-8000-000000000004", description: null, customer_name: null, reference: "10488", card_brand: null, last4: null, clover_payment_id: null, at: at(13, 12) },
    { ...base, id: "70000000-0000-4000-8000-000000000003", status: "partially_refunded", refunded_amount: 40, amount: 160, method: "card", source: "clover_card", invoice_id: null, invoice_number: null, dealership: null, payment_id: null, description: "Tint · 2 front windows", customer_name: "Walk-in", card_brand: "MC", last4: "1111", clover_payment_id: "charge_DEMO3", receipt_sent_at: at(11, 31), customer_email: "walkin@example.com", at: at(11, 30) },
    { ...base, id: "70000000-0000-4000-8000-000000000002", amount: 500, method: "card", source: "clover_pos", invoice_id: "30000000-0000-4000-8000-000000000001", invoice_number: "INV-000012", dealership: "Mercedes-Benz of El Dorado Hills", payment_id: "70000000-0000-4000-8000-000000000012", description: null, customer_name: null, card_brand: "AMEX", last4: "0005", clover_payment_id: "DEMO-POS-2", at: at(10, 2) },
    { ...base, id: "70000000-0000-4000-8000-000000000001", amount: 60, method: "cash", source: "manual", invoice_id: null, invoice_number: null, dealership: null, payment_id: null, description: "Headlight restoration", customer_name: "J. Kim", card_brand: null, last4: null, clover_payment_id: null, at: at(9, 15) },
  ];
}

/**
 * The Invoices list preview: three real days (a normal day is about 3 Used,
 * 2 PDI and 4 Sold), plus a few older rows so every state shows up: a loaner,
 * an overdue one, a paid one, a void one and the old multi-car batch.
 */
export function invoiceListFixture(): InvoiceListRow[] {
  const day = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };
  const iso = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
  const EDH = { dealership_id: "d1", dealership: "Mercedes-Benz of El Dorado Hills" };
  const SAC = { dealership_id: "d2", dealership: "Mercedes-Benz of Sacramento" };
  const PRICE: Record<string, number> = { Used: 200, PDI: 60, Sold: 20, "Service Loaner Detail": 125, "Paint Correction (1-step)": 250 };
  type Spec = [tag: string, vehicle: string, vin: string | null, detailer: string, service: string, dealer?: typeof EDH];
  let n = 61;
  const row = (ago: number, status: InvoiceListRow["status"], [tag, vehicle, vin, detailer, service, dealer = EDH]: Spec, extra: Partial<InvoiceListRow> = {}): InvoiceListRow => {
    n -= 1;
    const total = (dealer === SAC && service === "Used" ? 215 : PRICE[service]) ?? 0;
    return {
      id: `30000000-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`,
      display_number: `INV-${String(n).padStart(6, "0")}`,
      status,
      overdue: false,
      total,
      amount_paid: status === "paid" ? total : 0,
      balance: status === "paid" || status === "void" ? 0 : total,
      period_start: day(ago),
      period_end: day(ago),
      ro_po_number: null,
      submitted_at: status === "draft" || status === "void" ? null : iso(ago),
      paid_at: status === "paid" ? iso(Math.max(0, ago - 1)) : null,
      created_at: iso(ago),
      ...dealer,
      car_count: 1,
      cars: [{ tag, vin, vehicle, detailer }],
      services: [service],
      ...extra,
    };
  };
  const M = "Marco R.";
  const D = "Dee One";
  const today: Spec[] = [
    ["4821", "2024 Mercedes-Benz GLE 450", "W1KZF8DB3NA123456", M, "Used"],
    ["4833", "2023 Mercedes-Benz GLC 300", "W1N0G8DB5PV220114", D, "Used"],
    ["K-131", "2025 Mercedes-Benz E 350", "W1KZF8DB1RA331902", M, "Used", SAC],
    ["4830", "2026 Mercedes-Benz GLB 250", "W1N4M4HB0PW412221", D, "PDI"],
    ["4836", "2026 Mercedes-Benz GLE 350", "4JGFB4JB5SA901221", M, "PDI"],
    ["4812", "2025 Mercedes-Benz C 300", null, D, "Sold"],
    ["4819", "2024 Mercedes-Benz GLA 250", null, M, "Sold"],
    ["K-128", "2025 Mercedes-Benz GLC 300", null, D, "Sold", SAC],
    ["4827", "2026 Mercedes-Benz EQE 350", null, M, "Sold"],
  ];
  const yesterday: Spec[] = [
    ["4809", "2022 Mercedes-Benz S 580", "W1K6G7GB3NA000111", M, "Used"],
    ["K-121", "2025 Mercedes-Benz E 350", "W1KZF8DB5NA777001", D, "Used", SAC],
    ["4815", "2021 Mercedes-Benz GLE 450", "4JGFB4KB1MA228870", M, "Used"],
    ["4838", "2026 Mercedes-Benz C 300", "W1KAF4HB3SR118204", D, "PDI"],
    ["K-126", "2026 Mercedes-Benz GLC 300", "W1NKM4HB9SF334410", M, "PDI", SAC],
    ["4801", "2025 Mercedes-Benz GLB 250", null, D, "Sold"],
    ["4806", "2024 Mercedes-Benz E 350", null, M, "Sold"],
    ["4811", "2025 Mercedes-Benz GLE 350", null, D, "Sold"],
    ["K-119", "2024 Mercedes-Benz A 220", null, M, "Sold", SAC],
    ["K-118", "2023 Mercedes-Benz C 300", null, D, "Service Loaner Detail", SAC],
  ];
  const twoDays: Spec[] = [
    ["7702", "2023 Mercedes-Benz C-Class", "WDDGF4HB3CR227845", D, "Used"],
    ["K-099", "2021 Mercedes-Benz GLC 300", "W1N0G8DB1MV555002", M, "Used", SAC],
    ["4798", "2022 Mercedes-Benz GLA 250", "W1N4N4GB6NJ410233", D, "Used"],
    ["4840", "2026 Mercedes-Benz GLE 450", "4JGFB4JB7SA905510", M, "PDI"],
    ["4841", "2026 Mercedes-Benz EQB 300", "W1N9M0KB3SN220981", D, "PDI"],
    ["4790", "2023 Mercedes-Benz C 300", null, M, "Sold"],
    ["4793", "2024 Mercedes-Benz GLC 300", null, D, "Sold"],
    ["K-110", "2025 Mercedes-Benz CLA 250", null, M, "Sold", SAC],
    ["4796", "2022 Mercedes-Benz E 450", null, D, "Sold"],
  ];
  const rows: InvoiceListRow[] = [
    ...today.map((sp) => row(0, "draft", sp)),
    ...yesterday.map((sp) => row(1, "submitted", sp)),
    ...twoDays.map((sp, i) => (i === 1 ? row(2, "partial", sp, { amount_paid: 100, balance: 115 }) : row(2, i % 3 === 0 ? "paid" : "submitted", sp))),
    row(9, "paid", ["9051", "2022 Mercedes-Benz E 350", null, D, "Service Loaner Detail"]),
    row(14, "void", ["K-087", "2026 Mercedes-Benz GLA 250", null, M, "PDI", SAC]),
    row(34, "submitted", ["3310", "2026 Mercedes-Benz GLB 250", "W1N4M4HB0PW412221", M, "Used"], { overdue: true }),
    row(41, "paid", ["K-070", "2024 Mercedes-Benz A 220", null, M, "PDI", SAC]),
  ];
  // The old multi-car batch invoice (INV-000012), partly paid and overdue.
  n = 13;
  rows.push(
    row(45, "partial", ["4821", "2024 Mercedes-Benz GLE 450", "W1KZF8DB3NA123456", M, "Used"], {
      total: 790,
      amount_paid: 500,
      balance: 290,
      overdue: true,
      period_start: day(75),
      period_end: day(45),
      car_count: 6,
      cars: [
        { tag: "4821", vin: "W1KZF8DB3NA123456", vehicle: "2024 Mercedes-Benz GLE 450", detailer: M },
        { tag: "4829", vin: "W1KZF8DB3NA123457", vehicle: "2026 Mercedes-Benz GLE 450", detailer: D },
        { tag: "K-118", vin: null, vehicle: "2025 Mercedes-Benz C 300", detailer: M },
        { tag: "7702", vin: "WDDGF4HB3CR227845", vehicle: "2023 Mercedes-Benz C-Class", detailer: D },
      ],
      services: ["Used", "PDI", "Service Loaner Detail", "Sold"],
    }),
  );
  return rows;
}

/** The seeded menu, as the price list RPC returns it (previews). */
export function priceListFixture(): PriceListRow[] {
  return [
    { service_id: "s1", name: "PDI", description: "New car pre-delivery inspection prep", category: "new", price: 60, price_min: null, price_max: null, is_override: false, sort_order: 10 },
    { service_id: "s2", name: "Sold", description: "Delivery clean on a sold unit", category: "new", price: 20, price_min: null, price_max: null, is_override: false, sort_order: 20 },
    { service_id: "s3", name: "Used", description: "Used car full detail", category: "used", price: 200, price_min: null, price_max: null, is_override: false, sort_order: 30 },
    { service_id: "s4", name: "Service Loaner Detail", description: "Full detail on a service loaner", category: "service", price: 125, price_min: null, price_max: null, is_override: false, sort_order: 40 },
    { service_id: "s5", name: "Touch Up Detail", description: "$20–40 by condition", category: "addon", price: 30, price_min: 20, price_max: 40, is_override: false, sort_order: 50 },
    { service_id: "s6", name: "Tint Removal", description: "Strip old tint on a used unit", category: "addon", price: 40, price_min: null, price_max: null, is_override: false, sort_order: 60 },
    { service_id: "s7", name: "Paint Correction (1-step)", description: "Single-stage machine polish", category: "addon", price: 250, price_min: null, price_max: null, is_override: false, sort_order: 70 },
    { service_id: "s8", name: "Other", description: "Anything not on the menu; set the amount", category: "addon", price: 0, price_min: 0, price_max: 100000, is_override: false, sort_order: 80 },
  ];
}
