import type { Customer, CustomerListRow, CustomerTimeline, Vehicle, JobFinding } from "@/lib/db/types";
import type { PickedCustomer } from "@/components/retail/customer-picker";
import type { RetailTodayData } from "@/components/retail/retail-today";
import type { VehicleDetailData } from "@/components/retail/vehicle-detail";

/** Fixture retail customers for the guest demo and the e2e. Ids are stable so links work. */
const C1 = "60000000-0000-4000-8000-000000000001";
const C2 = "60000000-0000-4000-8000-000000000002";
const C3 = "60000000-0000-4000-8000-000000000003";
const C4 = "60000000-0000-4000-8000-000000000004";
const C5 = "60000000-0000-4000-8000-000000000005";
const V1 = "70000000-0000-4000-8000-000000000001";
const V2 = "70000000-0000-4000-8000-000000000002";
const V3 = "70000000-0000-4000-8000-000000000003";
const V4 = "70000000-0000-4000-8000-000000000004";
const V5 = "70000000-0000-4000-8000-000000000005";
const V6 = "70000000-0000-4000-8000-000000000006";

export const RETAIL_CUSTOMER_IDS = { ana: C1, marcus: C2, priya: C3, dana: C4, luis: C5 };
export const RETAIL_VEHICLE_IDS = { camry: V1, model3: V2, f150: V3, mini: V4, odyssey: V5, civic: V6 };

const RI_OLD_UNPAID = "40000000-0000-4000-8000-000000000990";
const RI_OLD_VOID = "40000000-0000-4000-8000-000000000991";
const RI_LUIS = "40000000-0000-4000-8000-000000000993";

const ago = (days: number, hours = 0) => new Date(Date.now() - days * 86400000 - hours * 3600000).toISOString();

const base = (over: Partial<Customer>): Customer => withDerived({
  id: "",
  company_id: "c1",
  first_name: "",
  last_name: "",
  display_name: null,
  phone: null,
  phone_digits: null,
  email: null,
  email_lc: null,
  address_line1: null,
  address_line2: null,
  city: "Sacramento",
  state: "CA",
  postal_code: null,
  source: "walk_in",
  tags: [],
  marketing_opt_in: false,
  marketing_opt_in_at: null,
  sms_opt_in: false,
  sms_opt_in_at: null,
  consent_source: null,
  notes: null,
  archived_at: null,
  merged_into_id: null,
  created_by: "u1",
  created_at: ago(120),
  updated_at: ago(2),
  ...over,
});

/** The generated columns, as Postgres would compute them. */
function withDerived(c: Customer): Customer {
  return { ...c, phone_digits: c.phone ? c.phone.replace(/\D/g, "") : null, email_lc: c.email ? c.email.toLowerCase() : null, display_name: [c.first_name, c.last_name].filter(Boolean).join(" ") || null };
}

export const customersFixture: Customer[] = [
  base({ id: C1, first_name: "Ana", last_name: "Lopez", phone: "(916) 555-0100", email: "ana.lopez@example.com", source: "referral", tags: ["vip"], sms_opt_in: true, sms_opt_in_at: ago(120), marketing_opt_in: true, marketing_opt_in_at: ago(120), consent_source: "in person", notes: "Prefers mornings. Rear bumper scratch noted before first visit.", created_at: ago(120), review_requested_at: ago(60), reviewed_at: ago(58) }),
  base({ id: C2, first_name: "Marcus", last_name: "Reed", phone: "(916) 555-0142", email: "marcus@example.com", source: "social", tags: [], sms_opt_in: true, sms_opt_in_at: ago(40), consent_source: "in person", created_at: ago(40) }),
  base({ id: C3, first_name: "Priya", last_name: "Nair", phone: "(530) 555-0177", source: "online_booking", tags: ["fleet"], sms_opt_in: true, sms_opt_in_at: ago(300), marketing_opt_in: true, marketing_opt_in_at: ago(300), created_at: ago(300) }),
  base({ id: C4, first_name: "Dana", last_name: "Whitfield", phone: "(916) 555-0199", email: "dana.w@example.com", source: "walk_in", tags: [], created_at: ago(15) }),
  base({ id: C5, first_name: "Luis", last_name: "Ortega", phone: "(916) 555-0123", source: "phone", tags: ["paint correction"], sms_opt_in: true, sms_opt_in_at: ago(200), created_at: ago(200) }),
];

const vbase = (over: Partial<Vehicle>): Vehicle => ({
  id: "",
  company_id: "c1",
  customer_id: "",
  vin: null,
  year: null,
  make: null,
  model: null,
  trim: null,
  body_class: null,
  size_class: "sedan",
  size_class_source: "nhtsa",
  color: null,
  plate: null,
  notes: null,
  archived_at: null,
  created_by: "u1",
  created_at: ago(100),
  updated_at: ago(2),
  ...over,
});

export const vehiclesFixture: Vehicle[] = [
  vbase({ id: V1, customer_id: C1, vin: "4T1BF1FK5CU123456", year: 2019, make: "Toyota", model: "Camry", trim: "SE", engine_size: "2.5L", engine_code: "A25A-FKS", body_class: "Sedan/Saloon", size_class: "sedan", color: "Silver", plate: "8KLM432", created_at: ago(120) }),
  vbase({ id: V2, customer_id: C2, vin: "5YJ3E1EA7NF123456", year: 2022, make: "Tesla", model: "Model 3", body_class: "Sedan/Saloon", size_class: "sedan", color: "Red", plate: "9EVX221", created_at: ago(40) }),
  vbase({ id: V3, customer_id: C3, vin: "1FTEW1EP7MFA12345", year: 2021, make: "Ford", model: "F-150", trim: "Lariat", engine_size: "2.7L", engine_code: "EcoBoost", body_class: "Pickup", size_class: "suv_truck", color: "Obsidian Black", plate: "7FLT009", notes: "Fleet truck · bed liner", created_at: ago(300) }),
  vbase({ id: V4, customer_id: C3, year: 2020, make: "Ford", model: "Transit", body_class: "Cargo Van", size_class: "xl", color: "Polar White", plate: "7FLT010", created_at: ago(290) }),
  vbase({ id: V5, customer_id: C4, year: 2018, make: "Honda", model: "Odyssey", body_class: "Minivan", size_class: "xl", color: "Gray", created_at: ago(15) }),
  vbase({ id: V6, customer_id: C5, vin: "2HGFC2F59JH123456", year: 2018, make: "Honda", model: "Civic", body_class: "Coupe", size_class: "compact", color: "Blue", plate: "8CIV118", created_at: ago(200) }),
];

const vehicleName = (v: Vehicle) => [v.year, v.make, v.model].filter(Boolean).join(" ");

/** Visits per customer: the shop's two walk-ins today (R-101 paid, R-102 to collect) plus history. */
type FixtureJob = CustomerTimeline["jobs"][number];
const JOBS: Record<string, FixtureJob[]> = {
  [C1]: [
    { id: "40000000-0000-4000-8000-000000000998", performed_at: ago(0, 2.5), tag: "R-101", ro_number: "RO-000041", vehicle: "2019 Toyota Camry", vehicle_id: V1, services: ["Full detail"], paid_at: ago(0, 1), payment_method: "clover", paid_amount: 200, deleted_at: null },
    { id: "40000000-0000-4000-8000-000000000901", performed_at: ago(62), tag: "R-044", vehicle: "2019 Toyota Camry", vehicle_id: V1, services: ["Clay bar", "Tire shine"], paid_at: ago(62), payment_method: "cash", paid_amount: 95, deleted_at: null },
    { id: "40000000-0000-4000-8000-000000000902", performed_at: ago(118), tag: "R-012", vehicle: "2019 Toyota Camry", vehicle_id: V1, services: ["Full detail"], paid_at: ago(118), payment_method: "clover", paid_amount: 200, deleted_at: null },
  ],
  [C2]: [{ id: "40000000-0000-4000-8000-000000000999", performed_at: ago(0, 0.7), tag: "R-102", ro_number: "RO-000042", vehicle: "2022 Tesla Model 3", vehicle_id: V2, services: ["Full detail"], paid_at: null, payment_method: null, paid_amount: null, deleted_at: null }],
  [C3]: [
    { id: "40000000-0000-4000-8000-000000000903", performed_at: ago(20), tag: "R-088", vehicle: "2021 Ford F-150", vehicle_id: V3, services: ["Full detail", "Odor bomb"], paid_at: ago(20), payment_method: "check", paid_amount: 290, deleted_at: null },
    { id: "40000000-0000-4000-8000-000000000904", performed_at: ago(50), tag: "R-061", vehicle: "2020 Ford Transit", vehicle_id: V4, services: ["Full detail"], paid_at: ago(50), payment_method: "check", paid_amount: 290, deleted_at: null },
  ],
  [C4]: [],
  [C5]: [{ id: "40000000-0000-4000-8000-000000000905", performed_at: ago(9), tag: "R-095", vehicle: "2018 Honda Civic", vehicle_id: V6, services: ["Paint correction (1-stage)"], paid_at: ago(9), payment_method: "clover", paid_amount: 450, deleted_at: null }],
};

export function customerListFixture(owner: boolean, q = "", archived = false): CustomerListRow[] {
  const t = q.trim().toLowerCase();
  const digits = t.replace(/\D/g, "");
  return customersFixture
    .filter((c) => (archived ? !!c.archived_at : !c.archived_at))
    .filter((c) => {
      if (!t) return true;
      const vs = vehiclesFixture.filter((v) => v.customer_id === c.id);
      return (
        (c.display_name ?? "").toLowerCase().includes(t) ||
        (c.email ?? "").toLowerCase().includes(t) ||
        (digits.length >= 3 && (c.phone_digits ?? "").includes(digits)) ||
        vs.some((v) => vehicleName(v).toLowerCase().includes(t) || (v.plate ?? "").toLowerCase().includes(t) || (v.vin ?? "").toLowerCase().includes(t))
      );
    })
    .map((c) => {
      const jobs = JOBS[c.id] ?? [];
      return {
        id: c.id,
        display_name: c.display_name,
        phone: c.phone,
        email: c.email,
        tags: c.tags,
        archived_at: c.archived_at,
        vehicles: vehiclesFixture.filter((v) => v.customer_id === c.id && !v.archived_at).map(vehicleName),
        visits: jobs.length,
        last_visit: jobs[0]?.performed_at ?? null,
        lifetime_spend: owner ? jobs.reduce((s, j) => s + (j.paid_amount ?? 0), 0) : null,
      };
    })
    .sort((a, b) => (a.display_name ?? "").localeCompare(b.display_name ?? ""));
}

export function customerTimelineFixture(id: string, owner: boolean): CustomerTimeline | null {
  const c = customersFixture.find((x) => x.id === id);
  if (!c) return null;
  const jobs = (JOBS[c.id] ?? []).map((j) => ({ ...j, paid_amount: owner ? j.paid_amount : null }));
  return {
    customer: c,
    merged_into: null,
    vehicles: vehiclesFixture
      .filter((v) => v.customer_id === c.id)
      .map((v) => {
        const vj = jobs.filter((j) => j.vehicle_id === v.id);
        return { ...v, odometer: v.id === V1 ? { reading: 48210, read_at: ago(0, 2.5) } : v.id === V3 ? { reading: 61400, read_at: ago(20) } : null, visits: vj.length, last_visit: vj[0]?.performed_at ?? null, open_findings: v.id === V2 ? 1 : 0 };
      }),
    jobs,
    estimates: customerEstimatesFixture(c.id, owner),
    appointments: calendarItemsFixture(owner).filter((a) => a.customer_id === c.id && a.status !== "hold").map((a) => ({ id: a.id, display_number: a.display_number, status: a.status, starts_at: a.starts_at, ends_at: a.ends_at, vehicle: a.vehicle, services: a.services, job_id: a.job_id })),
    stats: { visits: jobs.length, last_visit: jobs[0]?.performed_at ?? null, lifetime_spend: owner ? jobs.reduce((s, j) => s + (j.paid_amount ?? 0), 0) : null },
  };
}

export function vehicleDetailFixture(id: string): VehicleDetailData | null {
  const v = vehiclesFixture.find((x) => x.id === id);
  if (!v) return null;
  const c = customersFixture.find((x) => x.id === v.customer_id)!;
  const jobs = (JOBS[c.id] ?? []).filter((j) => j.vehicle_id === v.id);
  const visits = estimateListFixture(true, "", "all").rows.filter((r) => r.vehicle_id === v.id);
  const odometer = v.id === V1 ? [{ id: "o1", reading: 48210, read_at: ago(0, 2.5), job_id: jobs[0]?.id ?? null }, { id: "o2", reading: 46950, read_at: ago(62), job_id: null }, { id: "o3", reading: 44120, read_at: ago(118), job_id: null }] : v.id === V3 ? [{ id: "o4", reading: 61400, read_at: ago(20), job_id: null }] : [];
  return { vehicle: v, customer: { id: c.id, display_name: c.display_name }, odometer, visits };
}

export function pickedCustomersFixture(): PickedCustomer[] {
  return customersFixture.map((c) => ({
    id: c.id,
    name: c.display_name ?? c.phone ?? "Customer",
    phone: c.phone,
    vehicles: vehiclesFixture.filter((v) => v.customer_id === c.id && !v.archived_at).map((v) => ({ id: v.id, year: v.year, make: v.make, model: v.model, color: v.color, vin: v.vin, plate: v.plate, size_class: v.size_class, trim: v.trim ?? null, engine_size: v.engine_size ?? null, engine_code: v.engine_code ?? null })),
  }));
}

export function retailTodayFixture(money = false): RetailTodayData {
  const r101 = JOBS[C1][0];
  const r102 = JOBS[C2][0];
  const car = (j: FixtureJob, customer: string, invoiced = true) => ({ id: j.id, tag: j.tag, ro_number: j.ro_number ?? null, vehicle: j.vehicle, customer, performed_at: j.performed_at, paid_at: j.paid_at, invoiced_at: invoiced ? j.performed_at : null, services: j.services });
  const items = calendarItemsFixture(money);
  return {
    customers: customersFixture.length,
    today: [car(r102, "Marcus Reed"), car(r101, "Ana Lopez")],
    unpaid: [car(r102, "Marcus Reed")],
    inProgress: [{ ...car({ id: WIP_JOB_ID, tag: "R-103", ro_number: "RO-000044", performed_at: ago(0, 0.4), vehicle: "2021 Ford F-150", vehicle_id: V3, services: ["Diagnose the brake squeal", "Replace front pads"], paid_at: null, payment_method: null, paid_amount: null, deleted_at: null }, "Priya Nair", false) }],
    leads: items.filter((a) => a.status === "lead"),
    holds: items.filter((a) => a.status === "hold"),
    appointments: items.filter((a) => a.status !== "lead" && a.status !== "hold" && a.status !== "cancelled").filter((a) => a.starts_at.slice(0, 10) === at(0, 12).slice(0, 10)), // the shop's day, as at() builds it
    money: money ? { deposits_outstanding: { count: 1, amount: 66 }, deposits_week: 143, collected_week: 383, pending_links: 1 } : null,
  };
}

/** The customer behind each of the Jobs list's walk-in rows (R-101, R-102). */
export const RETAIL_JOB_CUSTOMER: Record<string, { id: string; name: string; vehicle_id: string }> = {
  "R-101": { id: C1, name: "Ana Lopez", vehicle_id: V1 },
  "R-102": { id: C2, name: "Marcus Reed", vehicle_id: V2 },
};

// ---------------------------------------------------------------------------
// 0038: the shop menu, size prices, modifiers, booking settings, resources
// ---------------------------------------------------------------------------
import type { PriceListRow, RetailCatalog, RetailCatalogService, VehicleSize } from "@/lib/db/types";
import { DEFAULT_TEMPLATES } from "@/lib/retail/templates";

type Seed = [name: string, benefit: string, minutes: number, kinds: ("bay" | "lift")[], skill: string | null, win: [string, string] | null, taxable: boolean, prices: [number, number, number, number]];
const RETAIL_SEED: Seed[] = [
  ["Full detail", "Inside and out, done properly", 240, ["bay"], null, null, false, [180, 200, 240, 290]],
  ["Paint correction (1-stage)", "Single-stage machine polish: swirls and light scratches", 360, ["bay"], "correction", ["08:00", "10:00"], false, [350, 400, 475, 550]],
  ["Paint correction (2-stage)", "Compound then polish: deeper defects, maximum gloss", 540, ["bay"], "correction", ["08:00", "09:00"], false, [550, 600, 700, 800]],
  ["Clay bar", "Decontaminate the paint so it feels like glass", 60, ["bay"], null, null, false, [60, 70, 85, 100]],
  ["Water spot removal", "Mineral etching lifted from paint and glass", 60, ["bay"], null, null, false, [80, 90, 110, 130]],
  ["Headlight restoration", "Yellowed lenses brought back to clear", 45, ["bay"], null, null, false, [60, 60, 60, 60]],
  ["Trim restore", "Faded plastic trim back to black", 45, ["bay"], null, null, false, [50, 60, 70, 85]],
  ["Tire shine", "Dressed tires, no sling", 15, ["bay"], null, null, false, [15, 15, 15, 15]],
  ["Odor bomb", "Odor treatment for smoke, pets and spills", 30, ["bay"], null, null, false, [35, 35, 35, 35]],
  ["Oil change", "Oil and filter with a fluid check", 45, ["bay", "lift"], "mechanic", null, true, [55, 60, 75, 90]],
  ["Brakes (per axle)", "Pads and rotors on one axle", 90, ["bay", "lift"], "mechanic", null, true, [180, 190, 220, 260]],
  ["Brake / noise inspection", "We find the squeak and tell you what it needs", 30, ["bay", "lift"], "mechanic", null, false, [40, 40, 40, 40]],
];

export const RETAIL_SERVICE_ID = (i: number) => `80000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;

export function retailServicesFixture(owner: boolean): RetailCatalogService[] {
  return RETAIL_SEED.map(([name, benefit, minutes, kinds, skill, win, taxable, p], i) => ({
    id: RETAIL_SERVICE_ID(i),
    name,
    description: benefit,
    benefit_text: benefit,
    category: "retail",
    duration_minutes: minutes,
    retail: true,
    dealer: false,
    taxable,
    placeholder: i !== 0, // the owner has confirmed the full detail price in the demo
    required_resource_kinds: kinds,
    required_skill: skill,
    start_window_from: win?.[0] ?? null,
    start_window_to: win?.[1] ?? null,
    active: true,
    sort_order: 310 + i * 10,
    open_amount: false,
    prices: owner ? { compact: p[0], sedan: p[1], suv_truck: p[2], xl: p[3] } : null,
    default_price: owner ? p[1] : null,
  }));
}

/** The shop's chips on New job (dealership_price_list for the retail row): the retail menu, no prices. */
export function retailPriceListFixture(): PriceListRow[] {
  return [
    ...retailServicesFixture(false).map((s, i) => ({ service_id: s.id, name: s.name, description: s.benefit_text, category: "retail" as const, price: null, price_min: null, price_max: null, is_override: false, sort_order: 310 + i * 10, open_amount: false })),
    { service_id: "s8", name: "Other", description: "Anything not on the menu", category: "addon", price: null, price_min: null, price_max: null, is_override: false, sort_order: 900, open_amount: true },
  ];
}

export function retailCatalogFixture(owner: boolean): RetailCatalog {
  const dealer: RetailCatalogService[] = [
    ["s1", "PDI", "new", 10],
    ["s3", "Used", "used", 30],
    ["s7", "Paint Correction (1-step)", "addon", 70],
  ].map(([id, name, category, sort]) => ({ id: id as string, name: name as string, description: null, benefit_text: null, category: category as RetailCatalogService["category"], duration_minutes: 60, retail: false, dealer: true, taxable: false, placeholder: false, required_resource_kinds: ["bay"], required_skill: null, start_window_from: null, start_window_to: null, active: true, sort_order: sort as number, open_amount: false, prices: owner ? {} : null, default_price: owner ? 50 : null }));
  const other: RetailCatalogService = { id: "s8", name: "Other", description: "Anything not on the menu", benefit_text: null, category: "addon", duration_minutes: 60, retail: true, dealer: true, taxable: false, placeholder: false, required_resource_kinds: ["bay"], required_skill: null, start_window_from: null, start_window_to: null, active: true, sort_order: 900, open_amount: true, prices: owner ? {} : null, default_price: owner ? 0 : null };
  const now = new Date().toISOString();
  const res = (id: string, kind: "bay" | "lift" | "tech", name: string, sort: number, profile_id: string | null = null, skills: string[] = []) => ({ id, company_id: "c1", kind, name, profile_id, skills, active: true, sort_order: sort, created_at: now, updated_at: now });
  return {
    services: [...dealer, ...retailServicesFixture(owner), other],
    modifiers: [
      { id: "m1", company_id: "c1", code: "soil_heavy", label: "Heavy soil", description: "Mud, sand, heavy grime: extra time on the interior", kind: "percent", amount: 25, active: true, sort_order: 10, ask_customer: false, question: null, created_at: now, updated_at: now },
      { id: "m2", company_id: "c1", code: "pet_hair", label: "Pet hair", description: "Embedded pet hair in carpet and seats", kind: "flat", amount: 40, active: true, sort_order: 20, ask_customer: true, question: "Any pet hair in the car?", created_at: now, updated_at: now },
      { id: "m3", company_id: "c1", code: "biohazard", label: "Biohazard", description: "Vomit, mold, spills needing extraction", kind: "flat", amount: 75, active: true, sort_order: 30, ask_customer: false, question: null, created_at: now, updated_at: now },
    ],
    settings: { id: "rs1", company_id: "c1", deposit_kind: "percent", deposit_value: 20, deposit_refundable: false, hold_minutes: 30, cancel_hours: 24, slot_step_minutes: 30, lead_time_hours: 2, max_days_ahead: 60, reminder_hours: [24, 2], online_booking_enabled: true, estimate_valid_days: 14, tax_all_lines: false, signature_required_estimate: true, signature_required_receipt: true, policy_text: "Deposits are non-refundable. Reschedule or cancel up to 24 hours before your appointment.", email_templates: DEFAULT_TEMPLATES, review_url: "https://g.page/r/demo/review", quiet_from: "20:00:00", quiet_to: "08:00:00", abandoned_minutes: 15, review_delay_minutes: 30, review_skip_days: 90, estimate_nudge_days: 3, shop_supplies_pct: 5, shop_supplies_cap: 10, shop_supplies_taxable: false, parts_taxable_default: true, labor_taxable_default: false, updated_at: now },
    labor_rates: [
      { id: "lr1", company_id: "c1", name: "Shop rate", rate: 120, is_default: true, active: true, sort_order: 10, created_at: now, updated_at: now },
      { id: "lr2", company_id: "c1", name: "Diagnostic", rate: 150, is_default: false, active: true, sort_order: 20, created_at: now, updated_at: now },
    ],
    resources: [
      ...[1, 2, 3, 4, 5, 6].map((n) => res(`bay${n}`, "bay", `Bay ${n}`, n)),
      res("lift1", "lift", "Lift 1", 11),
      res("lift2", "lift", "Lift 2", 12),
      res("tech-u2", "tech", "Victor", 21, "u2", ["detail", "correction"]),
      res("tech-u3", "tech", "Dee One", 22, "u3", ["detail", "mechanic"]),
      res("tech-u5", "tech", "Sam", 23, "u5", ["detail"]),
    ],
    hours: [0, 1, 2, 3, 4, 5, 6].map((d) => ({ id: `h${d}`, company_id: "c1", dow: d, opens: "08:00:00", closes: "17:00:00", closed: d === 0 })),
    blackouts: [{ id: "b1", company_id: "c1", day: `${new Date().getFullYear()}-11-26`, reason: "Thanksgiving", created_at: now }],
    time_off: [],
    tax_rate: 0,
  };
}

export const SIZE_LABEL_FIXTURE: Record<VehicleSize, string> = { compact: "Compact", sedan: "Sedan", suv_truck: "SUV / truck", xl: "XL" };

// ---------------------------------------------------------------------------
// 0039: estimates. Three of them: sent with three options (Ana), approved and
// signed (Luis), a draft (Dana). Prices are the sedan/compact/XL seed prices.
// ---------------------------------------------------------------------------
import type { EstimateListResult, EstimateListRow, EstimateLineType, EstimateStatus, EstimateView, JobEstimate } from "@/lib/db/types";

const E1 = "90000000-0000-4000-8000-000000000001";
const E2 = "90000000-0000-4000-8000-000000000002";
const E3 = "90000000-0000-4000-8000-000000000003";
export const ESTIMATE_IDS = { ana: E1, luis: E2, dana: E3 };
/** The public link of Ana's estimate in the demo (any other token is a 404). */
export const ESTIMATE_TOKEN = "demo-estimate-token-ana-camry-0001";
/** The supplement written on RO-000042 (Marcus, the Tesla) from the tech's findings. */
const E4 = "90000000-0000-4000-8000-000000000004";
/** Priya's F-150: a diagnosis, then the repair itemized, with the tech's findings on the side tab. */
const E5 = "90000000-0000-4000-8000-000000000005";
/** The primary estimate of each retail visit in the demo (R-101 Ana, R-102 Marcus, R-103 Priya): the one screen that carries it from quote to closed (0057). */
const E6 = "90000000-0000-4000-8000-000000000006";
const E7 = "90000000-0000-4000-8000-000000000007";
const E8 = "90000000-0000-4000-8000-000000000008";
const E9 = "90000000-0000-4000-8000-000000000009";
export const ESTIMATE_IDS_EXTRA = { priya: E5, anaClosed: E6, marcusUnpaid: E7, priyaWork: E8, johnClosed: E9 };
/** The primary estimate of each demo retail visit, by the id of its hidden repair-order row. */
export const ESTIMATE_FOR_JOB: Record<string, string> = { "40000000-0000-4000-8000-000000000998": E6, "40000000-0000-4000-8000-000000000999": E7, "40000000-0000-4000-8000-000000000997": E8, "40000000-0000-4000-8000-000000000996": E9, "40000000-0000-4000-8000-000000000993": E2 };
export const ESTIMATE_TOKEN_RO = "demo-estimate-token-marcus-tesla-0004";
/** A draft: the link can go out with findings only ("your quote is being prepared"). */
export const ESTIMATE_TOKEN_DRAFT = "demo-estimate-token-dana-odyssey-0003";

type L = { id: string; svc: number | "other" | null; name?: string; qty?: number; price: number; modifiers?: { code: string; label: string; kind: "percent" | "flat"; amount: number }[]; taxable?: boolean; type?: EstimateLineType; hours?: number; part_number?: string; vendor?: string; cost?: number; finding_id?: string; section?: "diagnosis" | "repair"; customer_approved?: boolean | null };
const seedName = (i: number) => RETAIL_SEED[i][0];
const seedBenefit = (i: number) => RETAIL_SEED[i][1];
const seedMinutes = (i: number) => RETAIL_SEED[i][2];
const line = (money: boolean, l: L) => {
  const type: EstimateLineType = l.type ?? "service";
  const qty = type === "labor" ? (l.hours ?? 1) : (l.qty ?? 1);
  const total = l.price * qty + (l.modifiers ?? []).reduce((s, m) => s + m.amount, 0);
  return {
    id: l.id,
    service_id: l.svc === null ? null : l.svc === "other" ? "s8" : RETAIL_SERVICE_ID(l.svc),
    line_type: type,
    section: l.section ?? ("repair" as const),
    name: l.name ?? (l.svc === "other" || l.svc === null ? "Other" : seedName(l.svc)),
    benefit_text: l.svc === "other" || l.svc === null ? null : seedBenefit(l.svc),
    qty,
    taxable: l.taxable ?? (type === "part"),
    duration_minutes: type === "labor" ? Math.round((l.hours ?? 1) * 60) : type !== "service" ? 0 : l.svc === "other" ? 60 : seedMinutes(l.svc as number),
    unit_price: money ? l.price : null,
    line_total: money ? total : null,
    modifiers: (l.modifiers ?? []).map((m) => (money ? m : { code: m.code, label: m.label })),
    hours: type === "labor" ? (l.hours ?? 1) : null,
    rate: type === "labor" && money ? l.price : null,
    part_number: l.part_number ?? null,
    vendor: l.vendor ?? null,
    finding_id: l.finding_id ?? null,
    cost: money ? (l.cost ?? null) : null,
    customer_approved: l.customer_approved ?? null,
  };
};
const sum = (ls: ReturnType<typeof line>[]) => ls.reduce((s, l) => s + (l.line_total ?? 0), 0);

const COMPANY = { name: "Cali Tints", phone: "(916) 555-0110", email: "mike@calitints.example", address_line1: "2900 Fulton Ave", address_line2: null, city: "Sacramento", state: "CA", postal_code: "95821", logo_path: null, timezone: "America/Los_Angeles" };
const POLICY = { policy_text: "Deposits are non-refundable. Reschedule or cancel up to 24 hours before your appointment.", deposit_kind: "percent" as const, deposit_value: 20, deposit_refundable: false, signature_required: true, cancel_hours: 24, shop_supplies_pct: 5, shop_supplies_cap: 10, shop_supplies_taxable: false, tax_rate: 0 };
const suppliesFor = (lines: ReturnType<typeof line>[]) => Math.min(Math.round(lines.filter((l) => l.line_type === "labor").reduce((s, l) => s + (l.line_total ?? 0), 0) * 5) / 100, 10);

/** Named jobs (0054) for a fixture option: Diagnosis first, then one job per finding (priority from its severity), then the rest as "Repairs". */
const jobIdFor = (o: { id: string }, l: L) => `${o.id}-${l.section === "diagnosis" ? "diag" : l.finding_id ? `f-${l.finding_id}` : "repairs"}`;
function jobsFor(o: { id: string; lines: L[] }, findings: JobFinding[], status: EstimateStatus): NonNullable<EstimateView["options"][number]["jobs"]> {
  const seen = new Set<string>();
  const out: NonNullable<EstimateView["options"][number]["jobs"]> = [];
  const state = status === "accepted" ? "approved" : status === "declined" ? "declined" : "recommended";
  for (const l of o.lines) {
    const id = jobIdFor(o, l);
    if (seen.has(id)) continue;
    seen.add(id);
    const f = l.finding_id ? findings.find((x) => x.id === l.finding_id) : null;
    const diag = l.section === "diagnosis";
    out.push({ id, title: diag ? "Diagnosis" : (f?.title ?? "Repairs"), kind: diag ? "diagnosis" : "repair", priority: f ? (f.severity === "urgent" ? "safety" : f.severity === "soon" ? "soon" : "optional") : "soon", status: state, sort_order: out.length + 1 });
  }
  return out.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "diagnosis" ? -1 : 1) || ["safety", "soon", "optional"].indexOf(a.priority) - ["safety", "soon", "optional"].indexOf(b.priority));
}

function build(money: boolean, pub: boolean, base: { id: string; n: number; status: EstimateStatus; customer: Customer; vehicle: Vehicle; options: { id: string; tier: EstimateView["options"][number]["tier"]; name: string; description: string | null; recommended: boolean; lines: L[] }[]; addons: (L & { default_on: boolean; customer_approved: boolean | null })[]; selected?: string; created: string; expires: string; sent?: string | null; viewed?: { first: string; last: string; count: number }; accepted?: string | null; auth?: EstimateView["authorizations"][number] | null; customer_notes?: string | null; internal_notes?: string | null; po?: string | null; odometer?: number | null; job?: EstimateView["job"]; kind?: "quote" | "supplement"; applied?: string | null; findings?: JobFinding[]; token?: string; concern?: string | null; ro?: string | null }): EstimateView {
  const options = base.options.map((o) => {
    const lines = o.lines.map((l) => line(true, l));
    const subtotal = sum(lines);
    const supplies = suppliesFor(lines);
    return { id: o.id, tier: o.tier, name: o.name, description: o.description, recommended: o.recommended, sort_order: 0, duration_minutes: lines.reduce((s, l) => s + l.duration_minutes, 0), subtotal: money ? subtotal : null, labor_subtotal: money ? lines.filter((l) => l.line_type === "labor").reduce((s, l) => s + (l.line_total ?? 0), 0) : null, shop_supplies: money ? supplies : null, tax: money ? 0 : null, total: money ? subtotal + supplies : null, jobs: jobsFor(o, base.findings ?? [], base.status), lines: o.lines.map((l) => ({ ...line(money, l), estimate_job_id: jobIdFor(o, l) })) };
  });
  const addons = base.addons.map((a) => ({ ...line(money, a), default_on: a.default_on, customer_approved: a.customer_approved }));
  const headlineId = base.selected ?? base.options.find((o) => o.recommended)?.id ?? base.options[0].id;
  const headline = base.options.find((o) => o.id === headlineId)!;
  const accepted = base.status === "accepted";
  const subtotal = sum(headline.lines.map((l) => line(true, l))) + base.addons.filter((a) => (accepted ? a.customer_approved : a.default_on)).reduce((s, a) => s + (line(true, a).line_total ?? 0), 0);
  const supplies = suppliesFor(headline.lines.map((l) => line(true, l)));
  return {
    id: base.id,
    display_number: `EST-${String(base.n).padStart(6, "0")}`,
    status: base.status,
    size_class: base.vehicle.size_class,
    expires_at: base.expires,
    po_number: base.po ?? null,
    internal_notes: pub ? null : (base.internal_notes ?? null),
    customer_notes: base.customer_notes ?? null,
    customer_concern: base.concern ?? null,
    ro_number: base.ro ?? base.job?.ro_number ?? null,
    advisor: "MK",
    selected_option_id: base.selected ?? null,
    sent_at: base.sent ?? null,
    first_viewed_at: base.viewed?.first ?? null,
    last_viewed_at: base.viewed?.last ?? null,
    view_count: base.viewed?.count ?? 0,
    accepted_at: base.accepted ?? null,
    declined_at: null,
    decline_reason: null,
    job_id: base.job?.id ?? null,
    job: base.job ?? null,
    kind: base.kind ?? "quote",
    applied_at: base.applied ?? null,
    findings: (base.findings ?? []).filter((f) => !pub || f.customer_visible !== false),
    created_at: base.created,
    updated_at: base.created,
    token: pub ? (base.token ?? ESTIMATE_TOKEN) : null,
    subtotal: money ? subtotal : null,
    shop_supplies: money ? supplies : null,
    tax_rate: money ? 0 : null,
    tax: money ? 0 : null,
    total: money ? subtotal + supplies : null,
    deposit_required: money ? Math.round((subtotal + supplies) * 20) / 100 : null,
    customer: { id: base.customer.id, display_name: pub ? base.customer.first_name : base.customer.display_name, first_name: base.customer.first_name, phone: pub ? null : base.customer.phone, email: pub ? null : base.customer.email },
    odometer: base.odometer ?? null,
    vehicle: { id: base.vehicle.id, name: vehicleName(base.vehicle), year: base.vehicle.year, make: base.vehicle.make, model: base.vehicle.model, trim: base.vehicle.trim, engine_size: base.vehicle.engine_size ?? null, engine_code: base.vehicle.engine_code ?? null, vin: pub ? null : base.vehicle.vin, color: base.vehicle.color, plate: pub ? null : base.vehicle.plate, size_class: base.vehicle.size_class },
    options,
    addons,
    authorizations: base.auth ? [{ ...base.auth, total: money ? subtotal : null }] : [],
    company: COMPANY,
    policy: POLICY,
    public_money: pub,
  };
}

const cust = (id: string) => customersFixture.find((c) => c.id === id)!;
const veh = (id: string) => vehiclesFixture.find((v) => v.id === id)!;

function estimateBase(id: string) {
  switch (id) {
    case E1:
      return {
        id: E1, n: 1, status: "viewed" as EstimateStatus, customer: cust(C1), vehicle: veh(V1), odometer: 48210,
        findings: [
          finding({ id: "93000000-0000-4000-8000-000000000001", job_id: null, estimate_id: E1, severity: "soon", title: "Swirl marks on the hood and trunk", body: "Light to medium. A one-stage correction takes most of them out.", recommended_service_id: RETAIL_SERVICE_ID(1), recommended_service: "Paint correction (1-stage)", job_ro_number: null, job_performed_at: null, created_at: ago(1, 3), updated_at: ago(1, 3),
            media: [{ id: "93100000-0000-4000-8000-000000000001", kind: "finding", storage_path: "demo/swirls.jpg", mime: "image/jpeg", duration_s: null, size_bytes: 390000, created_at: ago(1, 3), url: "/demo/before.svg" }] }),
          finding({ id: "93000000-0000-4000-8000-000000000002", job_id: null, estimate_id: E1, kind: "note", severity: "ok", title: "Old scratch on the rear bumper", body: "Photographed at intake so it is on record.", job_ro_number: null, job_performed_at: null, created_at: ago(1, 3), updated_at: ago(1, 3),
            media: [{ id: "93100000-0000-4000-8000-000000000002", kind: "finding", storage_path: "demo/bumper.jpg", mime: "image/jpeg", duration_s: null, size_bytes: 360000, created_at: ago(1, 3), url: "/demo/after.svg" }] }),
          finding({ id: "93000000-0000-4000-8000-000000000003", job_id: null, estimate_id: E1, kind: "note", severity: "ok", title: "Repeat customer, fine to match last time's price", customer_visible: false, job_ro_number: null, job_performed_at: null, created_at: ago(1, 2), updated_at: ago(1, 2) }),
        ],
        options: [
          { id: "o1-good", tier: "good" as const, name: "Good", description: "The full detail, inside and out", recommended: false, lines: [{ id: "l1", svc: 0, price: 200 }] },
          { id: "o1-better", tier: "better" as const, name: "Better", description: "Adds the clay bar so the paint feels like glass", recommended: true, lines: [{ id: "l2", svc: 0, price: 200 }, { id: "l3", svc: 3, price: 70 }] },
          { id: "o1-best", tier: "best" as const, name: "Best", description: "Everything, plus a single-stage polish for the swirls", recommended: false, lines: [{ id: "l4", svc: 0, price: 200 }, { id: "l5", svc: 3, price: 70 }, { id: "l6", svc: 1, price: 400 }] },
        ],
        addons: [{ id: "a1", svc: 5, price: 60, default_on: true, customer_approved: null }, { id: "a2", svc: 8, price: 35, default_on: false, customer_approved: null }],
        created: ago(1, 3), expires: new Date(Date.now() + 13 * 86400000).toISOString(), sent: ago(1, 2), viewed: { first: ago(0, 20), last: ago(0, 4), count: 3 },
        customer_notes: "Light swirls on the hood and trunk; the Best option takes most of them out.", internal_notes: "Rear bumper scratch noted on intake photos.", po: null,
        concern: "Swirl marks everywhere since the last car wash, mostly in the sun.", ro: "RO-000045",
      };
    case E2:
      return {
        id: E2, n: 2, status: "accepted" as EstimateStatus, customer: cust(C5), vehicle: veh(V6), odometer: 76200,
        job: { id: RI_LUIS, ro_number: "RO-000043", invoice_number: "RI-000043", invoiced_at: ago(3, 18), tag_number: "E-000002", performed_at: ago(3, 19), paid_at: null, odometer: null },
        options: [{ id: "o2-single", tier: "single" as const, name: "Paint correction", description: null, recommended: true, lines: [{ id: "l7", svc: 1, price: 350 }, { id: "l8", svc: 6, price: 50 }] }],
        addons: [{ id: "a3", svc: 7, price: 15, default_on: true, customer_approved: true }],
        selected: "o2-single", created: ago(4), expires: new Date(Date.now() + 10 * 86400000).toISOString(), sent: ago(4), viewed: { first: ago(3, 20), last: ago(3, 19), count: 1 }, accepted: ago(3, 19),
        auth: { id: "au1", authorized_at: ago(3, 19), name: "Luis Ortega", method: "online" as const, by_staff: null, selected_option_id: "o2-single", approved_line_ids: ["a3"], signature_path: "c1/estimates/e2/sig.png", pay_choice: "at_shop" as const, total: null },
        customer_notes: null, internal_notes: null, po: null,
      };
    case E3:
      return {
        id: E3, n: 3, status: "draft" as EstimateStatus, customer: cust(C4), vehicle: veh(V5),
        options: [{ id: "o3-single", tier: "single" as const, name: "Quote", description: null, recommended: true, lines: [{ id: "l9", svc: 0, price: 290, modifiers: [{ code: "pet_hair", label: "Pet hair", kind: "flat" as const, amount: 40 }] }, { id: "l10", svc: "other" as const, name: "Seat extraction, third row", price: 45 }] }],
        addons: [],
        created: ago(0, 1), expires: new Date(Date.now() + 14 * 86400000).toISOString(), customer_notes: "Pet hair in the back; the extraction gets the third row.", internal_notes: null, po: null,
      };
    case E5:
      return {
        id: E5, n: 5, status: "draft" as EstimateStatus, customer: cust(C3), vehicle: veh(V3), odometer: 61400,
        options: [{ id: "o5-single", tier: "single" as const, name: "Quote", description: null, recommended: true, lines: [
          { id: "l14", svc: null, type: "labor" as const, name: "Diagnose the cold-start rattle", hours: 1, price: 120, section: "diagnosis" as const },
          { id: "l15", svc: null, type: "labor" as const, name: "Replace the timing chain tensioner", hours: 3, price: 120 },
          { id: "l16", svc: null, type: "part" as const, name: "Tensioner kit", qty: 1, price: 185, part_number: "TK-2711", vendor: "FordParts", cost: 110, taxable: true },
        ] }],
        addons: [],
        findings: [
          finding({ id: "94000000-0000-4000-8000-000000000001", job_id: null, estimate_id: E5, severity: "urgent", recommendation: "diagnose", title: "Rattle for two seconds on a cold start", body: "Timing chain tensioner. Recorded the sound; do not wait on this one.", job_ro_number: null, job_performed_at: null, created_at: ago(0, 2), updated_at: ago(0, 2),
            media: [{ id: "94100000-0000-4000-8000-000000000001", kind: "video", storage_path: "demo/rattle.mp4", mime: "video/mp4", duration_s: 9.2, size_bytes: 9000000, created_at: ago(0, 2), url: null }] }),
        ],
        created: ago(0, 3), expires: new Date(Date.now() + 14 * 86400000).toISOString(), customer_notes: "The rattle is the tensioner; the diagnosis confirms it before we take anything apart.", internal_notes: null, po: null,
        concern: "A metallic rattle for a couple of seconds on a cold start, only in the mornings.",
      };
    case E6:
      return {
        id: E6, n: 6, status: "accepted" as EstimateStatus, customer: cust(C1), vehicle: veh(V1), odometer: 48210,
        job: { id: JOBS[C1][0].id, ro_number: "RO-000041", invoice_number: "RI-000041", invoiced_at: JOBS[C1][0].performed_at, tag_number: "R-101", performed_at: JOBS[C1][0].performed_at, paid_at: JOBS[C1][0].paid_at, picked_up_at: JOBS[C1][0].paid_at, odometer: 48210 },
        options: [{ id: "o6-single", tier: "single" as const, name: "Quote", description: null, recommended: true, lines: [{ id: "l21", svc: 0, price: 240 }] }],
        addons: [], selected: "o6-single", created: ago(0, 3), expires: new Date(Date.now() + 14 * 86400000).toISOString(), sent: ago(0, 3), accepted: ago(0, 2.6), applied: ago(0, 2.6),
        auth: { id: "au6", authorized_at: ago(0, 2.6), name: "Ana Lopez", method: "in_person" as const, by_staff: "u1", selected_option_id: "o6-single", approved_line_ids: [], signature_path: "c1/estimates/e6/sig.png", pay_choice: "at_shop" as const, total: null },
        customer_notes: null, internal_notes: null, po: null, concern: "Interior smells like smoke.", ro: "RO-000041",
      };
    case E7:
      return {
        id: E7, n: 7, status: "accepted" as EstimateStatus, customer: cust(C2), vehicle: veh(V2), odometer: 31200,
        job: { id: JOBS[C2][0].id, ro_number: "RO-000042", invoice_number: "RI-000042", invoiced_at: JOBS[C2][0].performed_at, tag_number: "R-102", performed_at: JOBS[C2][0].performed_at, paid_at: null, odometer: 31200 },
        options: [{ id: "o7-single", tier: "single" as const, name: "Quote", description: null, recommended: true, lines: [{ id: "l22", svc: 0, price: 200 }] }],
        addons: [], selected: "o7-single", created: ago(0, 1), expires: new Date(Date.now() + 14 * 86400000).toISOString(), sent: ago(0, 1), accepted: ago(0, 0.9), applied: ago(0, 0.9),
        auth: { id: "au7", authorized_at: ago(0, 0.9), name: "Marcus Reed", method: "online" as const, by_staff: null, selected_option_id: "o7-single", approved_line_ids: [], signature_path: "c1/estimates/e7/sig.png", pay_choice: "deposit" as const, total: null },
        customer_notes: null, internal_notes: null, po: null, concern: "Wants it back by 5; do the carpets first.", ro: "RO-000042", findings: jobFindingsFixture(JOBS[C2][0].id),
      };
    case E8:
      return {
        id: E8, n: 8, status: "accepted" as EstimateStatus, customer: cust(C3), vehicle: veh(V3), odometer: 61400,
        job: { id: WIP_JOB_ID, ro_number: "RO-000044", invoice_number: null, invoiced_at: null, tag_number: "R-103", performed_at: ago(0, 0.4), paid_at: null, odometer: 61400 },
        options: [{ id: "o8-single", tier: "single" as const, name: "Quote", description: null, recommended: true, lines: [
          { id: "l23", svc: null, type: "labor" as const, name: "Diagnose the brake squeal", hours: 1, price: 120, section: "diagnosis" as const },
          { id: "l24", svc: null, type: "labor" as const, name: "Replace front pads", hours: 3, price: 120 },
        ] }],
        addons: [], selected: "o8-single", created: ago(0, 0.5), expires: new Date(Date.now() + 14 * 86400000).toISOString(), sent: ago(0, 0.45), accepted: ago(0, 0.4), applied: ago(0, 0.4),
        auth: { id: "au8", authorized_at: ago(0, 0.4), name: "Priya Nair", method: "in_person" as const, by_staff: "u1", selected_option_id: "o8-single", approved_line_ids: [], signature_path: "c1/estimates/e8/sig.png", pay_choice: "at_shop" as const, total: null },
        customer_notes: null, internal_notes: null, po: null, concern: "Squeals when I brake, worse in the morning.", ro: "RO-000044",
      };
    case E9: {
      const john: Customer = { ...cust(C1), id: "doc-john", first_name: "John", last_name: "Doe", display_name: "John Doe", phone: "(916) 555-0199", email: "john@email.com" };
      const accord: Vehicle = { ...veh(V1), id: "doc-accord", customer_id: "doc-john", year: 2018, make: "Honda", model: "Accord", trim: "EX", color: "Gray", vin: "1HGCV1F3XJA000000", plate: "8ABC123" };
      return {
        id: E9, n: 9, status: "accepted" as EstimateStatus, customer: john, vehicle: accord, odometer: 84210,
        job: { id: DOC_JOB_ID, ro_number: "RO-000046", invoice_number: "RI-000044", invoiced_at: ago(1, 2), tag_number: "R-100", performed_at: ago(1, 2), paid_at: ago(1, 1), picked_up_at: ago(1, 1), odometer: 84210 },
        options: [{ id: "o9-single", tier: "single" as const, name: "Quote", description: null, recommended: true, lines: [
          { id: "l31", svc: null, type: "labor" as const, name: "Brake pads/rotors", hours: 1.5, price: 150 },
          { id: "l32", svc: null, type: "part" as const, name: "Brake pad set", qty: 1, price: 89.99 },
          { id: "l33", svc: null, type: "part" as const, name: "Front rotor", qty: 2, price: 79.99 },
        ] }],
        addons: [], selected: "o9-single", created: ago(1, 4), expires: new Date(Date.now() + 10 * 86400000).toISOString(), sent: ago(1, 4), accepted: ago(1, 3), applied: ago(1, 3),
        auth: { id: "au9", authorized_at: ago(1, 3), name: "John Doe", method: "online" as const, by_staff: null, selected_option_id: "o9-single", approved_line_ids: [], signature_path: "c1/estimates/e9/sig.png", pay_choice: "at_shop" as const, total: null },
        customer_notes: null, internal_notes: null, po: null, concern: "Grinding noise when braking", ro: "RO-000046",
      };
    }
    case E4: {
      const found = jobFindingsFixture("40000000-0000-4000-8000-000000000999").filter((f) => f.id === FINDING_IDS.pads || f.id === FINDING_IDS.spots).map((f) => ({ ...f, status: "quoted" as const, estimate_line_id: f.id === FINDING_IDS.pads ? "l11" : "l13" }));
      return {
        id: E4, n: 4, status: "sent" as EstimateStatus, customer: cust(C2), vehicle: veh(V2), kind: "supplement" as const, token: ESTIMATE_TOKEN_RO,
        job: { id: "40000000-0000-4000-8000-000000000999", ro_number: "RO-000042", tag_number: "R-102", performed_at: ago(0, 0.7), paid_at: null, odometer: 31200, primary_estimate_id: E7 },
        findings: found,
        options: [{ id: "o4-single", tier: "single" as const, name: "While it is here", description: "What the tech found during the detail", recommended: true, lines: [
          { id: "l11", svc: null, type: "labor" as const, name: "Replace rear brake pads", hours: 1.5, price: 120, finding_id: FINDING_IDS.pads },
          { id: "l12", svc: null, type: "part" as const, name: "Rear brake pads", qty: 1, price: 68, part_number: "BP-4412", vendor: "NAPA", cost: 34, taxable: true, finding_id: FINDING_IDS.pads },
          { id: "l13", svc: 4, price: 90, finding_id: FINDING_IDS.spots },
          { id: "l14", svc: null, type: "fee" as const, name: "Brake fluid disposal", price: 8 },
        ] }],
        addons: [],
        created: ago(0, 0.3), expires: new Date(Date.now() + 14 * 86400000).toISOString(), sent: ago(0, 0.25),
        customer_notes: "The pads are at 2 mm, so we would not wait on those. The water spots are cosmetic.", internal_notes: null, po: null,
      };
    }
    default:
      return null;
  }
}

export function estimateViewFixture(id: string, money: boolean): EstimateView | null {
  const b = estimateBase(id);
  return b ? build(money, false, b) : null;
}

export function estimatePublicFixture(token: string): EstimateView | null {
  if (token === ESTIMATE_TOKEN) return build(true, true, estimateBase(E1)!);
  if (token === ESTIMATE_TOKEN_RO) return build(true, true, estimateBase(E4)!);
  if (token === ESTIMATE_TOKEN_DRAFT) return build(true, true, estimateBase(E3)!);
  return null;
}

/** job_estimates(): the estimates written on a demo repair order. */
export function jobEstimatesFixture(jobId: string, money: boolean): JobEstimate[] {
  if (jobId !== "40000000-0000-4000-8000-000000000999") return [];
  const e = estimateViewFixture(E4, money)!;
  return [{ id: e.id, display_number: e.display_number, status: e.status, kind: "supplement", sent_at: e.sent_at, accepted_at: e.accepted_at, applied_at: null, total: e.total, lines: e.options[0].lines.length }];
}

/** The stage of a demo estimate, derived the way the database does (0057). */
export function fixtureStage(e: EstimateView): EstimateStage {
  if (e.status === "draft") return "draft";
  if (e.status === "sent" || e.status === "viewed") return "sent";
  if (e.status === "declined" || e.status === "expired") return e.status;
  const j = e.job;
  if (!j) return "in_progress";
  if (j.picked_up_at) return "closed";
  if (j.paid_at) return "paid";
  if (j.invoiced_at) return "unpaid";
  return "in_progress";
}
const LIST_IDS = [E5, E3, E8, E7, E1, E2, E6, E9];

export function estimateListFixture(money: boolean, q = "", stage: string = "open"): EstimateListResult {
  const t = q.trim().toLowerCase();
  const all = LIST_IDS.map((id) => estimateViewFixture(id, money)!);
  const counts: Partial<Record<EstimateStage, number>> = {};
  for (const e of all) counts[fixtureStage(e)] = (counts[fixtureStage(e)] ?? 0) + 1;
  const rows: EstimateListRow[] = all
    .filter((e) => (stage === "all" ? true : stage === "open" ? !["closed", "declined", "expired"].includes(fixtureStage(e)) : fixtureStage(e) === stage))
    .filter((e) => !t || e.display_number.toLowerCase().includes(t) || (e.job?.invoice_number ?? "").toLowerCase().includes(t) || (e.customer.display_name ?? "").toLowerCase().includes(t) || (e.vehicle?.name ?? "").toLowerCase().includes(t))
    .map((e) => ({ id: e.id, display_number: e.display_number, status: e.status, stage: fixtureStage(e), vehicle_id: e.vehicle?.id ?? null, created_at: e.created_at, expires_at: e.expires_at, sent_at: e.sent_at, last_viewed_at: e.last_viewed_at, accepted_at: e.accepted_at, job_id: e.job_id, customer_id: e.customer.id, customer: e.customer.display_name, vehicle: e.vehicle?.name ?? null, size_class: e.size_class, options: e.options.length, total: e.total, concern: e.customer_concern ?? null, invoice_number: e.job?.invoice_number ?? null, invoiced_at: e.job?.invoiced_at ?? null, paid_at: e.job?.paid_at ?? null, picked_up_at: e.job?.picked_up_at ?? null, waiting_supplement: e.job?.id === JOBS[C2][0].id, advisor: "MK", tech: e.job ? "VK" : null, ro_number: e.job?.ro_number ?? e.ro_number ?? null, holder: e.job ? "VK" : null, mine: [E5, E7, E8, E1].includes(e.id), balance: money && fixtureStage(e) === "unpaid" ? (e.job?.id === JOBS[C2][0].id ? 160 : 415) : null }));
  return { count: rows.length, counts, rows };
}

/** The customer page's estimates list. */
export function customerEstimatesFixture(customerId: string, money: boolean): NonNullable<CustomerTimeline["estimates"]> {
  return [E5, E4, E3, E8, E7, E1, E2, E6, E9]
    .map((id) => estimateViewFixture(id, money)!)
    .filter((e) => e.customer.id === customerId && e.kind !== "supplement")
    .map((e) => ({ id: e.id, display_number: e.display_number, status: e.status, created_at: e.created_at, expires_at: e.expires_at, vehicle: e.vehicle?.name ?? null, total: e.total, job_id: e.job_id, stage: fixtureStage(e), invoice_number: e.job?.invoice_number ?? null }));
}


// ---------------------------------------------------------------------------
// 0040: appointments. Today's three cars, an online lead to confirm, a live
// hold, and next week's bookings. Times are built in the shop's timezone.
// ---------------------------------------------------------------------------
import type { AppointmentView, CalendarItem, CalendarRange, PaymentView, PublicCatalog, ReceiptView, RetailCharge } from "@/lib/db/types";

const A1 = "a0000000-0000-4000-8000-000000000001";
const A2 = "a0000000-0000-4000-8000-000000000002";
const A3 = "a0000000-0000-4000-8000-000000000003";
const A4 = "a0000000-0000-4000-8000-000000000004";
const A5 = "a0000000-0000-4000-8000-000000000005";
export const APPOINTMENT_IDS = { ana: A1, marcus: A2, lead: A3, hold: A4, priya: A5 };
export const APPOINTMENT_TOKEN = "demo-booking-token-ana-camry-00001";
const TZ = "America/Los_Angeles";

/** An instant for today (or +days) at a Pacific wall-clock hour. Good enough for a preview; the database does the real maths. */
function at(days: number, hour: number, minute = 0): string {
  // "Today" is the shop's calendar day, not the UTC one: after 5 pm Pacific the UTC date is already tomorrow.
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "numeric", day: "numeric", timeZoneName: "shortOffset" }).formatToParts(new Date());
  const part = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "";
  const offset = Number(part("timeZoneName").replace(/GMT|UTC/, "") || "-7");
  const d = new Date(Date.UTC(Number(part("year")), Number(part("month")) - 1, Number(part("day")) + days, hour - offset, minute));
  return d.toISOString();
}
const plus = (iso: string, minutes: number) => new Date(new Date(iso).getTime() + minutes * 60000).toISOString();

type ApptSeed = { id: string; n: number; status: CalendarItem["status"]; customer: Customer | null; vehicle: Vehicle | null; services: { svc: number; price: number; modifiers?: { code: string; label: string }[] }[]; starts: string; source: CalendarItem["source"]; pay?: "deposit" | "at_shop" | null; hold_expires?: string; resources: string[]; notes?: string | null; customer_notes?: string | null; job_id?: string | null; estimate?: { id: string; display_number: string } | null; intake?: Record<string, unknown>; deposit?: { paid_at: string; method: PaymentView["method"]; ref?: string } | "pending" | null };
function seeds(): ApptSeed[] {
  return [
    { id: A1, n: 1, status: "in_progress", customer: cust(C1), vehicle: veh(V1), services: [{ svc: 0, price: 200 }], starts: at(0, 8), source: "staff", resources: ["bay1", "tech-u2"], notes: "Keys in the drop box", job_id: "40000000-0000-4000-8000-000000000998", deposit: { paid_at: ago(2), method: "clover_online", ref: "HC7Q2M" } },
    { id: A2, n: 2, status: "booked", customer: cust(C2), vehicle: veh(V2), services: [{ svc: 3, price: 70 }, { svc: 7, price: 15 }], starts: at(0, 13), source: "public", pay: "at_shop", resources: ["bay2", "tech-u3"], customer_notes: "Please call when it is ready" },
    { id: A3, n: 3, status: "lead", customer: cust(C4), vehicle: veh(V5), services: [{ svc: 0, price: 290, modifiers: [{ code: "pet_hair", label: "Pet hair" }] }], starts: at(2, 9), source: "public", pay: "deposit", resources: ["bay3", "tech-u2"], customer_notes: "Pet hair in the back", intake: { pet_hair: true }, deposit: "pending" },
    { id: A4, n: 4, status: "hold", customer: null, vehicle: null, services: [{ svc: 9, price: 60 }], starts: at(1, 10), source: "public", hold_expires: new Date(Date.now() + 17 * 60000).toISOString(), resources: ["bay4", "lift1", "tech-u3"] },
    { id: A5, n: 5, status: "booked", customer: cust(C3), vehicle: veh(V3), services: [{ svc: 1, price: 475 }], starts: at(3, 8), source: "estimate", resources: ["bay1", "tech-u2"], estimate: { id: E2, display_number: "EST-000002" }, deposit: { paid_at: ago(1, 5), method: "cash" } },
  ];
}
const SIZE_OF = (v: Vehicle | null): VehicleSize => v?.size_class ?? "suv_truck";

export function calendarItemsFixture(money: boolean): CalendarItem[] {
  return seeds().map((s) => {
    const minutes = s.services.reduce((t, x) => t + seedMinutes(x.svc), 0);
    const total = s.services.reduce((t, x) => t + x.price + (x.modifiers?.length ? 40 : 0), 0);
    return {
      id: s.id, display_number: `APT-${String(s.n).padStart(6, "0")}`, status: s.status, starts_at: s.starts, ends_at: plus(s.starts, minutes), duration_minutes: minutes, hold_expires_at: s.hold_expires ?? null,
      source: s.source, size_class: SIZE_OF(s.vehicle), pay_choice: s.pay ?? null, job_id: s.job_id ?? null, estimate_id: s.estimate?.id ?? null,
      customer: s.customer?.display_name ?? null, customer_id: s.customer?.id ?? null, vehicle: s.vehicle ? vehicleName(s.vehicle) : null,
      services: s.services.map((x) => seedName(x.svc)), resource_ids: s.resources, total: money ? total : null, deposit_required: money ? Math.round(total * 20) / 100 : null,
    };
  });
}

export function calendarRangeFixture(money: boolean): CalendarRange {
  const cat = retailCatalogFixture(money);
  return { resources: cat.resources.map((r) => ({ id: r.id, kind: r.kind, name: r.name, profile_id: r.profile_id })), hours: cat.hours.map((h) => ({ dow: h.dow, opens: h.opens, closes: h.closes, closed: h.closed })), blackouts: cat.blackouts.map((b) => ({ day: b.day, reason: b.reason })), items: calendarItemsFixture(money) };
}

export function appointmentViewFixture(id: string, money: boolean, pub = false): AppointmentView | null {
  const s = seeds().find((x) => x.id === id);
  if (!s) return null;
  const item = calendarItemsFixture(true).find((x) => x.id === id)!;
  const cat = retailCatalogFixture(true);
  const dep = item.deposit_required ?? 0;
  const payments: PaymentView[] = s.deposit === "pending"
    ? [{ id: `${s.id}-p1`, kind: "deposit", status: "pending", method: "clover_online", provider: "clover", paid_at: null, provider_ref: null, note: null, amount: money ? dep : null, created_at: ago(0, 1) }]
    : s.deposit
      ? [{ id: `${s.id}-p1`, kind: "deposit", status: "paid", method: s.deposit.method, provider: s.deposit.method === "clover_online" ? "clover" : "none", paid_at: s.deposit.paid_at, provider_ref: s.deposit.ref ?? null, note: null, amount: money ? dep : null, created_at: s.deposit.paid_at }]
      : [];
  return {
    id: s.id, display_number: item.display_number, status: s.status, starts_at: item.starts_at, ends_at: item.ends_at, duration_minutes: item.duration_minutes, hold_expires_at: item.hold_expires_at,
    source: s.source, size_class: item.size_class, pay_choice: s.pay ?? null, intake: s.intake ?? {}, notes: pub ? null : (s.notes ?? null), customer_notes: s.customer_notes ?? null,
    estimate_id: s.estimate?.id ?? null, job_id: s.job_id ?? null, confirmed_at: s.status === "lead" || s.status === "hold" ? null : item.starts_at, checked_in_at: s.status === "in_progress" ? at(0, 7, 55) : null, done_at: null, cancelled_at: null, cancel_reason: null,
    created_at: ago(1), updated_at: ago(0, 1), token: pub ? APPOINTMENT_TOKEN : null,
    subtotal: money || pub ? item.total : null, tax: money || pub ? 0 : null, total: money || pub ? item.total : null, deposit_required: money || pub ? item.deposit_required : null,
    deposit_paid_at: s.deposit && s.deposit !== "pending" ? s.deposit.paid_at : null,
    deposit_paid: (money || pub) && s.deposit && s.deposit !== "pending" ? dep : money || pub ? 0 : null,
    payments: pub ? [] : payments,
    customer: s.customer ? { id: s.customer.id, display_name: pub ? s.customer.first_name : s.customer.display_name, first_name: s.customer.first_name, phone: pub ? null : s.customer.phone, email: pub ? null : s.customer.email } : null,
    vehicle: s.vehicle ? { id: s.vehicle.id, name: vehicleName(s.vehicle), color: s.vehicle.color, plate: pub ? null : s.vehicle.plate, size_class: s.vehicle.size_class } : null,
    services: s.services.map((x, i) => ({ id: `${s.id}-s${i}`, service_id: RETAIL_SERVICE_ID(x.svc), name: seedName(x.svc), qty: 1, duration_minutes: seedMinutes(x.svc), unit_price: money || pub ? x.price : null, line_total: money || pub ? x.price + (x.modifiers?.length ? 40 : 0) : null, modifiers: x.modifiers ?? [] })),
    resources: pub ? [] : s.resources.map((r) => { const res = cat.resources.find((x) => x.id === r)!; return { id: res.id, kind: res.kind, name: res.name }; }),
    estimate: s.estimate ? { ...s.estimate, status: "accepted" } : null,
    company: { ...COMPANY },
    policy: { cancel_hours: 24, hold_minutes: 30, deposit_kind: "percent", deposit_value: 20, deposit_refundable: false, policy_text: POLICY.policy_text },
    can_change: s.status === "hold" || new Date(item.starts_at).getTime() > Date.now() + 24 * 3600000,
  };
}

/** The customer's view of the booking link in the demo: the hold (`/book/<token>`) or Dana's lead (`/a/<token>`). */
export function appointmentPublicFixture(token: string, kind: "hold" | "manage"): AppointmentView | null {
  if (token !== APPOINTMENT_TOKEN) return null;
  return appointmentViewFixture(kind === "hold" ? A4 : A3, true, true);
}

export function publicCatalogFixture(): PublicCatalog {
  const cat = retailCatalogFixture(true);
  return {
    company: { name: COMPANY.name, phone: COMPANY.phone, email: COMPANY.email, address_line1: COMPANY.address_line1, city: COMPANY.city, state: COMPANY.state, postal_code: COMPANY.postal_code, timezone: TZ },
    services: retailServicesFixture(true).map((s) => ({ id: s.id, name: s.name, benefit_text: s.benefit_text, duration_minutes: s.duration_minutes, taxable: s.taxable, sort_order: s.sort_order, start_window_from: s.start_window_from, start_window_to: s.start_window_to, prices: s.prices ?? {}, default_price: s.default_price ?? 0 })),
    questions: cat.modifiers.filter((m) => m.ask_customer).map((m) => ({ code: m.code, label: m.label, question: m.question ?? m.label, kind: m.kind, amount: m.amount })),
    settings: { slot_step_minutes: 30, lead_time_hours: 2, max_days_ahead: 60, hold_minutes: 30, cancel_hours: 24, deposit_kind: "percent", deposit_value: 20, deposit_refundable: false, online_booking_enabled: true, policy_text: POLICY.policy_text },
    hours: cat.hours.map((h) => ({ dow: h.dow, opens: h.opens, closes: h.closes, closed: h.closed })),
    tax_rate: 0,
  };
}


// ---------------------------------------------------------------------------
// 0041: the counter and the receipt. R-101 (Ana, paid today) had a deposit
// paid online on its appointment; R-102 (Marcus) is still to collect.
// ---------------------------------------------------------------------------
export const RECEIPT_TOKEN = "demo-receipt-token-ana-camry-000001";

/** The counter payment of the invoiced RO R-102 at each point: ?pay=partial|paid|signed|closed in the preview. */
export type PayStage = "none" | "partial" | "paid" | "signed" | "closed";
export function retailChargeFixture(jobId: string, money: boolean, stage: PayStage = "none"): RetailCharge | null {
  const r101 = JOBS[C1][0];
  const r102 = JOBS[C2][0];
  if (jobId === r101.id) {
    return { job_id: jobId, tag: "R-101", vehicle: "2019 Toyota Camry", subtotal: 240, tax: 0, total: 240, deposit_paid: 48, paid: 192, balance: 0, amount: 0, amount_cents: 0, paid_at: r101.paid_at, picked_up_at: r101.paid_at, receipt_signed_at: r101.paid_at, receipt_signed_name: "Ana Lopez", has_signature: true, signature_required: true,
      payments: [{ id: "pay-101-d", kind: "deposit", status: "paid", method: "clover_online", paid_at: ago(2), provider_ref: "HC7Q2M", note: null, amount: money ? 48 : null }, { id: "pay-101-b", kind: "balance", status: "paid", method: "clover_flex", paid_at: r101.paid_at, provider_ref: "K7Q2M3", note: null, amount: money ? 192 : null }] };
  }
  if (jobId === r102.id && stage !== "none") {
    const amt = (n: number) => (money ? n : null);
    const part = { id: "pay-102-b1", kind: "balance" as const, status: "paid" as const, method: "cash" as const, paid_at: ago(0, 0.2), provider_ref: null, note: null, amount: amt(100) };
    const rest = { id: "pay-102-b2", kind: "balance" as const, status: "paid" as const, method: "zelle" as const, paid_at: ago(0, 0.1), provider_ref: "Marcus R", note: null, amount: amt(60) };
    const dep = { id: "pay-102-d", kind: "deposit" as const, status: "paid" as const, method: "cash" as const, paid_at: ago(1), provider_ref: null, note: null, amount: amt(40) };
    const done = stage !== "partial";
    return { job_id: jobId, tag: "R-102", vehicle: "2022 Tesla Model 3", subtotal: 200, tax: 0, total: 200, deposit_paid: 40, paid: done ? 160 : 100, balance: done ? 0 : 60, amount: done ? 0 : 60, amount_cents: done ? 0 : 6000, paid_at: done ? ago(0, 0.1) : null,
      picked_up_at: stage === "closed" ? ago(0, 0.02) : null, receipt_signed_at: stage === "signed" || stage === "closed" ? ago(0, 0.05) : null, receipt_signed_name: stage === "signed" || stage === "closed" ? "Marcus Reed" : null, has_signature: stage === "signed" || stage === "closed", signature_required: true,
      payments: done ? [dep, part, rest] : [dep, part] };
  }
  if (jobId === r102.id) {
    return { job_id: jobId, tag: "R-102", vehicle: "2022 Tesla Model 3", subtotal: 200, tax: 0, total: 200, deposit_paid: 40, paid: 0, balance: 160, amount: 160, amount_cents: 16000, paid_at: null, receipt_signed_at: null, receipt_signed_name: null, has_signature: false, signature_required: true,
      payments: [{ id: "pay-102-d", kind: "deposit", status: "paid", method: "cash", paid_at: ago(1), provider_ref: null, note: null, amount: money ? 40 : null }] };
  }
  return null;
}

export const INVOICE_TOKEN = "demo-invoice-token-marcus-tesla-0002";

export function receiptFixture(token: string, money: boolean): ReceiptView | null {
  if (token === WIP_TOKEN) return wipReceiptFixture(money);
  if (token === DOC_TOKEN) return invoiceDocFixture(false);
  if (token === INVOICE_TOKEN) {
    // The customer's copy of the unpaid invoice (RI-000042): what is due and what the tech found (internal notes left out).
    const inv = retailInvoiceDetailFixture(JOBS[C2][0].id)!;
    const visible = jobFindingsFixture(JOBS[C2][0].id).filter((f) => f.customer_visible !== false);
    return { ...inv, customer: { ...inv.customer!, display_name: inv.customer!.first_name }, plate: null, token, findings: visible, payments: inv.payments.map((p) => ({ ...p, provider_ref: null })) };
  }
  if (token !== RECEIPT_TOKEN) return null;
  const r101 = JOBS[C1][0];
  const c = cust(C1);
  return {
    id: r101.id, tag: "R-101", invoice_number: "RI-000041", ro_number: "RO-000041", odometer: 48210, plate: money ? "8KLM432" : null, performed_at: r101.performed_at, paid_at: r101.paid_at, payment_method: "clover", vehicle: "2019 Toyota Camry", color: "Silver",
    customer: { id: c.id, display_name: money ? c.display_name : c.first_name, first_name: c.first_name, email: money ? c.email : null, phone: money ? c.phone : null },
    lines: [{ name: "Full detail", price: 200 }, { name: "Pet hair", price: 40 }],
    subtotal: 240, tax: 0, total: 240, deposit_paid: 48, paid: 192, balance: 0, tax_rate: 0,
    payments: [{ kind: "deposit", method: "clover_online", amount: 48, paid_at: ago(2), provider_ref: money ? "HC7Q2M" : null }, { kind: "balance", method: "clover_flex", amount: 192, paid_at: r101.paid_at, provider_ref: money ? "K7Q2M3" : null }],
    signed_name: "Ana Lopez", signed_at: r101.paid_at, has_signature: true, token: money ? null : token,
    company: { ...COMPANY, address_line2: null, logo_path: null },
  };
}


// ---------------------------------------------------------------------------
// 0052: one repair order through its stages: header facts, the authorization record, a job in progress (R-103, not invoiced yet).
// ---------------------------------------------------------------------------
import type { EstimateStage, InvoiceJob, RoAuthorization } from "@/lib/db/types";

export const WIP_JOB_ID = "40000000-0000-4000-8000-000000000997";
export const WIP_TOKEN = "demo-ro-token-priya-f150-0003";

/** The concern in the customer's words and the mileage that came in. */
export function roHeaderFixture(jobId: string): { concern: string | null; mileage_in: number | null } {
  if (jobId === WIP_JOB_ID) return { concern: "Squeals when I brake, worse in the morning.", mileage_in: 61400 };
  if (jobId === JOBS[C2][0].id) return { concern: "Wants it back by 5; do the carpets first.", mileage_in: 31200 };
  if (jobId === JOBS[C1][0].id) return { concern: "Interior smells like smoke.", mileage_in: 48210 };
  return { concern: null, mileage_in: null };
}

/** Who authorized what, how and when. Amounts only for those who price jobs. */
export function roAuthorizationsFixture(jobId: string, money: boolean): RoAuthorization[] {
  const amt = (n: number) => (money ? n : null);
  if (jobId === WIP_JOB_ID)
    return [
      { id: "auth-wip-1", kind: "initial", authorized_at: ago(0, 0.4), name: "Priya Nair", method: "in_person", by_staff: true, has_signature: true, estimate_id: null, amount: amt(120) },
      { id: "auth-wip-2", kind: "change_order", authorized_at: ago(0, 0.2), name: "Priya Nair", method: "phone", by_staff: true, has_signature: false, estimate_id: null, amount: amt(480) },
    ];
  if (jobId === JOBS[C2][0].id) return [{ id: "auth-102-1", kind: "estimate", authorized_at: ago(0, 0.9), name: "Marcus Reed", method: "online", by_staff: false, has_signature: true, estimate_id: null, amount: amt(200) }];
  if (jobId === JOBS[C1][0].id) return [{ id: "auth-101-1", kind: "initial", authorized_at: ago(0, 2.6), name: "Ana Lopez", method: "in_person", by_staff: true, has_signature: true, estimate_id: null, amount: amt(240) }];
  return [{ id: `auth-${jobId.slice(-4)}`, kind: "estimate", authorized_at: ago(1, 2), name: "Customer", method: "online", by_staff: false, has_signature: true, estimate_id: null, amount: amt(415) }];
}

/**
 * The completion state of the in-progress RO (R-103): ?work=none (default), done (the tech finished, waiting for the check) or qc (signed off, ready to convert).
 * Two named jobs: the Diagnosis and the front pads.
 */
export const WIP_JOB_IDS = { diag: "50000000-0000-4000-8000-000000000a01", pads: "50000000-0000-4000-8000-000000000a02" };
export function roWorkFixture(jobId: string, state: "none" | "done" | "qc"): { jobs: { id: string; title: string; priority: "safety" | "soon" | "optional"; cause: string | null; correction: string | null }[]; mileageIn: number | null; odometerOut: number | null; completedAt: string | null; qcAt: string | null; qcNote: string | null; parts: "offered" | "returned" | "declined" | null } | null {
  if (jobId !== WIP_JOB_ID) return null;
  const written = state !== "none";
  return {
    jobs: [
      { id: WIP_JOB_IDS.diag, title: "Diagnosis", priority: "soon", cause: written ? "Front pads worn to the wear indicator" : null, correction: written ? "Inspected all four corners; rotors within spec" : null },
      { id: WIP_JOB_IDS.pads, title: "Front brake pads", priority: "safety", cause: written ? "Pad material gone, metal-on-metal squeal" : null, correction: written ? "Replaced front pads, cleaned and lubed slides, road-tested" : null },
    ],
    mileageIn: 61400,
    odometerOut: written ? 61412 : null,
    completedAt: written ? ago(0, 0.1) : null,
    qcAt: state === "qc" ? ago(0, 0.05) : null,
    qcNote: state === "qc" ? "Test drive clean, no noise" : null,
    parts: written ? "returned" : null,
  };
}
export function roReviewFixture(state: "none" | "done" | "qc"): import("@/lib/db/types").InvoiceReview {
  const ready = state === "qc";
  return { lines: 2, ro_total: 480, approved_total: 480, linked_total: 480, matches: true, unauthorized: 0, jobs_not_done: state === "none" ? 2 : 0, completed: state !== "none", qc: state === "qc", odometer_out: state === "none" ? null : 61412, ready };
}

/** The customer's page on a repair order in progress: what they said and what is approved so far; no amount due. */
export function wipReceiptFixture(money: boolean): ReceiptView {
  const c = cust(C3);
  return {
    id: WIP_JOB_ID, tag: "R-103", invoice_number: null, invoiced_at: null, ro_number: "RO-000044", estimate_number: "EST-000008", concern: roHeaderFixture(WIP_JOB_ID).concern, odometer: 61400, plate: money ? "7FLT009" : null,
    performed_at: ago(0, 0.4), paid_at: null, payment_method: null, vehicle: "2021 Ford F-150", color: "Obsidian Black",
    customer: { id: c.id, display_name: money ? c.display_name : c.first_name, first_name: c.first_name, email: money ? c.email : null, phone: money ? c.phone : null },
    lines: [{ name: "Diagnosis · Diagnose the brake squeal — 1.00 h @ $120.00", price: 120 }, { name: "Replace front pads — 3.00 h @ $120.00", price: 360 }],
    subtotal: 480, tax: 0, total: 480, deposit_paid: 0, paid: 0, balance: 480, tax_rate: 0, payments: [],
    signed_name: null, signed_at: null, has_signature: false, token: money ? null : WIP_TOKEN,
    company: { ...COMPANY, address_line2: null, logo_path: null },
  };
}

// ---------------------------------------------------------------------------
// 0055: the finished invoice, laid out the way the shop prints it (a paid RO with two jobs, a declined one, cause and correction).
// Reached by its own link and id: it is not in the lists, so their counts stay as they were.
// ---------------------------------------------------------------------------
export const DOC_JOB_ID = "40000000-0000-4000-8000-000000000996";
export const DOC_TOKEN = "demo-invoice-token-john-accord-0004";

export function invoiceDocFixture(staff: boolean): ReceiptView {
  const doc = new Date(Date.now() - 26 * 3600 * 1000).toISOString();
  const ln = (name: string, type: string, total: number, extra: Partial<{ qty: number; hours: number; rate: number }> = {}) => ({ name, type, qty: extra.qty ?? null, hours: extra.hours ?? null, rate: extra.rate ?? null, part_number: null, total });
  return {
    id: DOC_JOB_ID, tag: "R-100", invoice_number: "RI-000044", invoiced_at: doc, ro_number: "RO-000046", estimate_number: "EST-000009", concern: "Grinding noise when braking", performed_at: doc, paid_at: doc, payment_method: "clover",
    vehicle: "2018 Honda Accord EX", color: "Gray", odometer: 84210, odometer_out: 84212, vin: staff ? "1HGCV1F3XJA000000" : null, plate: staff ? "8ABC123" : null,
    customer: { id: "doc-john", display_name: staff ? "John Doe" : "John", first_name: "John", email: staff ? "john@email.com" : null, phone: staff ? "(916) 555-0199" : null },
    jobs: [
      { id: "doc-diag", title: "Diagnosis", kind: "diagnosis", priority: "safety", status: "done", cause: "Pads worn to 2mm, rotors scored", correction: "Confirmed with a road test and a wheel-off inspection", total: 0, lines: [] },
      { id: "doc-brakes", title: "Front Brake Service", kind: "repair", priority: "safety", status: "done", cause: "Pads worn to 2mm, rotors scored", correction: "Replaced pads & rotors", total: 486.97,
        lines: [ln("Brake pads/rotors", "labor", 225, { hours: 1.5, rate: 150 }), ln("Brake pad set", "part", 89.99, { qty: 1 }), ln("Front rotor", "part", 159.98, { qty: 2 }), ln("Shop supplies", "fee", 12)] },
      { id: "doc-oil", title: "Oil Change", kind: "repair", priority: "optional", status: "done", cause: "Due by mileage", correction: "Changed oil and filter", total: 94.94,
        lines: [ln("Oil & filter", "labor", 45, { hours: 0.3, rate: 150 }), ln("0W-20 Synthetic", "part", 39.95, { qty: 5 }), ln("Oil filter", "part", 9.99, { qty: 1 })] },
    ].filter((j) => j.lines.length > 0) as InvoiceJob[],
    extras: [],
    declined: [{ title: "Rear brakes (4mm) · next 3-6 months", priority: "soon", total: 410 }, { title: "Cabin air filter", priority: "optional", total: 65 }],
    recommended: [],
    categories: { labor: 270, parts: 299.91, fees: 12, sublets: 0, services: 0 },
    taxable_types: ["part"],
    authorizations: [
      { kind: "initial", method: "phone", authorized_at: ago(1.2), name: "John Doe", amount: 150 },
      { kind: "estimate", method: "online", authorized_at: ago(1.1), name: "John Doe", amount: 608.15 },
    ],
    parts_disposition: "returned", completed_at: doc, advisor: "JS", tech: "ML", bar_license: "ARD000000", warranty_text: "12 mo / 12,000 mi parts & labor",
    lines: [], subtotal: 581.91, tax: 26.24, total: 608.15, deposit_paid: 0, paid: 608.15, balance: 0, tax_rate: 0.0875,
    payments: [{ kind: "balance", method: "clover_flex", amount: 400, paid_at: doc, provider_ref: null }, { kind: "balance", method: "zelle", amount: 208.15, paid_at: doc, provider_ref: null, note: "John D" }],
    signed_name: "John Doe", signed_at: doc, has_signature: true, token: staff ? null : DOC_TOKEN,
    company: { ...COMPANY, address_line1: "123 Main St", address_line2: null, city: "Elk Grove", state: "CA", postal_code: "95624", phone: "(916) 555-0100", logo_path: null },
  };
}

// ---------------------------------------------------------------------------
// 0042: the shipped rules, a log, the texts queued for the phone.
// ---------------------------------------------------------------------------
import type { AutomationLogRow, AutomationRule, TextQueueRow } from "@/lib/db/types";

export function automationRulesFixture(): AutomationRule[] {
  const now = new Date().toISOString();
  const mk = (key: string, name: string, event_kind: string, delay_minutes: number, action: AutomationRule["action"], sort_order: number, enabled = true): AutomationRule => ({ id: `rule-${key}`, company_id: "c1", key, name, enabled, event_kind, delay_minutes, condition: {}, action, system: true, sort_order, created_at: now, updated_at: now });
  return [
    mk("hold_expiring", "Hold running out", "hold.expiring", 0, { kind: "email", template: "hold_expiring" }, 10),
    mk("hold_abandoned", "Abandoned booking", "hold.expired", 15, { kind: "both", template: "abandoned" }, 20),
    mk("booking_booked", "Booking confirmed", "booking.booked", 0, { kind: "email", template: "booking_confirmed" }, 30),
    mk("booking_reminder", "Reminder before the visit", "booking.reminder", 0, { kind: "both", template: "reminder" }, 40),
    mk("booking_cancelled", "Cancelled", "booking.cancelled", 0, { kind: "email", template: "cancelled" }, 50),
    mk("job_review", "Ask for a review", "job.paid", 30, { kind: "both", template: "review_request" }, 60),
    mk("estimate_nudge", "Estimate not answered", "estimate.unanswered", 0, { kind: "email", template: "estimate_nudge" }, 70, false),
    mk("estimate_accepted", "Tell me when one is approved", "estimate.accepted", 0, { kind: "notify_owner", owner_subject: "Estimate approved" }, 80),
    mk("lead_created", "Tell me about a new online booking", "booking.lead", 0, { kind: "notify_owner", owner_subject: "New online booking to confirm" }, 90),
    mk("lead_received", "Booking request received", "booking.lead", 0, { kind: "email", template: "booking_received" }, 95),
    mk("payment_receipt", "Receipt after a paid job", "job.paid", 0, { kind: "email", template: "receipt" }, 100),
    mk("ro_ready", "Tell them the car is ready", "ro.ready", 0, { kind: "both", template: "status_ready" }, 110),
    mk("declined_followup", "Remind them about work they declined", "ro.closed", 20160, { kind: "both", template: "declined_work" }, 120),
  ];
}

export function automationLogFixture(): AutomationLogRow[] {
  const row = (i: number, rule: string, rule_key: string, event_kind: string, status: AutomationLogRow["status"], result: string | null, customer: string | null, minutesAgo: number): AutomationLogRow => ({ id: `log-${i}`, rule, rule_key, event_kind, status, result, due_at: ago(0, minutesAgo / 60), finished_at: status === "queued" ? null : ago(0, minutesAgo / 60), created_at: ago(0, minutesAgo / 60 + 0.1), subject_type: "appointment", subject_id: A2, customer, customer_id: C2 });
  return [
    row(1, "Reminder before the visit", "booking_reminder", "booking.reminder", "sent", "email re_9f2 · text queued", "Marcus Reed", 25),
    row(2, "Booking confirmed", "booking_booked", "booking.booked", "sent", "email re_8a1", "Priya Nair", 180),
    row(3, "Ask for a review", "job_review", "job.paid", "skipped", "asked within 90 days", "Ana Lopez", 240),
    row(4, "Tell me about a new online booking", "lead_created", "booking.lead", "sent", "owner email re_7c0", "Dana Whitfield", 300),
    row(5, "Hold running out", "hold_expiring", "hold.expiring", "queued", null, null, -8),
  ];
}

/** The Incoming / Outgoing boxes on the dashboard (0058). */
export function myTransfersFixture(): import("@/lib/db/types").MyTransfers {
  return {
    incoming: [{ id: "tr-in-1", estimate_id: E3, number: "EST-000003", customer: "Dana Whitfield", vehicle: "2018 Honda Odyssey", from: "SO", to: "MK", status_label: "Needs parts ordered", message: "Her sliding door is binding too. Order the roller kit before you quote it.", created_at: ago(0, 1.5) }],
    outgoing: [{ id: "tr-out-1", estimate_id: E8, number: "EST-000008", customer: "Priya Nair", vehicle: "2021 Ford F-150", from: "MK", to: "DO", status_label: "In progress", message: "Pads are on the shelf.", created_at: ago(0, 0.5) }],
  };
}

export function textQueueFixture(): TextQueueRow[] {
  return [
    { id: "tq-1", customer_id: C2, customer: "Marcus Reed", phone: "(916) 555-0142", body: "Hi Marcus, see you Mon, Oct 19 · 1:00 PM with the 2022 Tesla Model 3. Change or cancel here: https://cali-tints-demo.vercel.app/a/demo-booking-token-ana-camry-00001", reason: "Reminder before the visit", created_at: ago(0, 0.4) },
    { id: "tq-2", customer_id: C5, customer: "Luis Ortega", phone: "(916) 555-0123", body: "Hi Luis, thanks for bringing the 2018 Honda Civic in. If you have a minute, a review helps us more than you know: https://g.page/r/demo/review", reason: "Ask for a review", created_at: ago(0, 2) },
  ];
}

/** The notes tab of the demo repair orders (0043): findings with photos and a clip on RO-000042, and what was found last time on the same car. */
export const FINDING_IDS = {
  pads: "92000000-0000-4000-8000-000000000001",
  spots: "92000000-0000-4000-8000-000000000002",
  note: "92000000-0000-4000-8000-000000000003",
  chip: "92000000-0000-4000-8000-000000000004",
  haze: "92000000-0000-4000-8000-000000000005",
  filter: "92000000-0000-4000-8000-000000000006",
} as const;
const JOB_R101 = "40000000-0000-4000-8000-000000000998";
const JOB_R102 = "40000000-0000-4000-8000-000000000999";
const finding = (f: Partial<JobFinding> & Pick<JobFinding, "id" | "job_id" | "title">): JobFinding => ({
  vehicle_id: f.job_id === JOB_R102 ? V2 : V1,
  kind: "finding",
  severity: "soon",
  body: null,
  recommended_service_id: null,
  recommended_service: null,
  recommendation: null,
  status: "open",
  estimate_line_id: null,
  created_by: "u2",
  created_at: ago(0, 0.5),
  updated_at: ago(0, 0.5),
  job_ro_number: f.job_id === JOB_R102 ? "RO-000042" : "RO-000041",
  job_performed_at: ago(0, 0.7),
  media: [],
  ...f,
});
export function jobFindingsFixture(jobId: string): JobFinding[] {
  if (jobId === JOB_R102)
    return [
      finding({ id: FINDING_IDS.note, job_id: jobId, kind: "note", severity: "ok", title: "Customer waits in the lobby", body: "Wants a call before anything beyond the detail.", created_at: ago(0, 0.6), updated_at: ago(0, 0.6) }),
      finding({
        id: FINDING_IDS.pads, job_id: jobId, severity: "urgent", recommendation: "replace", title: "Rear brake pads at 2 mm", body: "Both sides. Rotors look fine. Metal within a month.",
        recommended_service_id: RETAIL_SERVICE_ID(10), recommended_service: "Brakes (per axle)",
        media: [
          { id: "91000000-0000-4000-8000-000000000001", kind: "finding", storage_path: "demo/pads.jpg", mime: "image/jpeg", duration_s: null, size_bytes: 380000, created_at: ago(0, 0.5), url: "/demo/before.svg" },
          { id: "91000000-0000-4000-8000-000000000002", kind: "video", storage_path: "demo/pads.mp4", mime: "video/mp4", duration_s: 12.4, size_bytes: 18400000, created_at: ago(0, 0.5), url: null },
        ],
      }),
      finding({ id: FINDING_IDS.filter, job_id: jobId, severity: "ok", recommendation: "monitor", title: "Cabin air filter is dirty", body: "Worth doing at the next oil change.", created_at: ago(0, 0.35), updated_at: ago(0, 0.35) }),
      finding({ id: FINDING_IDS.spots, job_id: jobId, severity: "soon", title: "Water spots on the hood and roof", body: "Hard-water etching, light.", recommended_service_id: RETAIL_SERVICE_ID(4), recommended_service: "Water spot removal", created_at: ago(0, 0.4), updated_at: ago(0, 0.4),
        media: [{ id: "91000000-0000-4000-8000-000000000003", kind: "finding", storage_path: "demo/spots.jpg", mime: "image/jpeg", duration_s: null, size_bytes: 410000, created_at: ago(0, 0.4), url: "/demo/after.svg" }] }),
    ];
  if (jobId === JOB_R101) return [finding({ id: FINDING_IDS.haze, job_id: jobId, severity: "soon", title: "Headlights hazed", recommended_service_id: RETAIL_SERVICE_ID(5), recommended_service: "Headlight restoration", status: "done", created_at: ago(0, 2), updated_at: ago(0, 1) })];
  return [];
}
/** Findings on the same car from an earlier visit that were never done. */
export function fromLastTimeFixture(jobId: string): JobFinding[] {
  if (jobId !== JOB_R102) return [];
  return [finding({ id: FINDING_IDS.chip, job_id: "40000000-0000-4000-8000-000000000905", severity: "soon", title: "Rock chip on the hood, primer showing", recommended_service_id: null, recommended_service: null, status: "declined", job_ro_number: "RO-000017", job_performed_at: ago(45), created_at: ago(45), updated_at: ago(45) })];
}


// ---------------------------------------------------------------------------
// 0047: retail's own invoices (RI-…): two of today's repair orders and two older ones.
// ---------------------------------------------------------------------------
import type { RetailDashboard, RetailInvoiceDetail, RetailInvoiceList, RetailInvoiceRow } from "@/lib/db/types";


function retailInvoiceRows(): RetailInvoiceRow[] {
  const r101 = JOBS[C1][0];
  const r102 = JOBS[C2][0];
  return [
    { id: r102.id, number: "RI-000042", ro_number: "RO-000042", tag: "R-102", performed_at: ago(0, 1), customer_id: C2, customer: "Marcus Reed", vehicle: "2022 Tesla Model 3", status: "partial", total: 200, deposit_paid: 40, paid: 0, balance: 160, paid_at: null },
    { id: r101.id, number: "RI-000041", ro_number: "RO-000041", tag: "R-101", performed_at: ago(0, 3), customer_id: C1, customer: "Ana Lopez", vehicle: "2019 Toyota Camry", status: "paid", total: 240, deposit_paid: 48, paid: 192, balance: 0, paid_at: r101.paid_at },
    { id: RI_LUIS, number: "RI-000043", ro_number: "RO-000043", tag: "E-000002", performed_at: ago(3, 19), customer_id: C5, customer: "Luis Ortega", vehicle: "2018 Honda Civic", status: "unpaid", total: 415, deposit_paid: 0, paid: 0, balance: 415, paid_at: null },
    { id: RI_OLD_UNPAID, number: "RI-000040", ro_number: "RO-000040", tag: "R-099", performed_at: ago(3), customer_id: C3, customer: "Priya Nair", vehicle: "2020 Honda Odyssey", status: "unpaid", total: 130, deposit_paid: 0, paid: 0, balance: 130, paid_at: null },
    { id: RI_OLD_VOID, number: "RI-000039", ro_number: "RO-000039", tag: "R-098", performed_at: ago(6), customer_id: C4, customer: "Dana Whitaker", vehicle: "2018 Ford F-150", status: "void", total: 90, deposit_paid: 0, paid: 0, balance: 90, paid_at: null },
  ];
}

export function retailInvoiceListFixture(q = "", status = "open"): RetailInvoiceList {
  const all = retailInvoiceRows();
  const needle = q.trim().toLowerCase();
  const rows = all.filter((r) => {
    if (status === "open" && !(r.status === "unpaid" || r.status === "partial")) return false;
    if (status !== "open" && status !== "all" && r.status !== status) return false;
    return !needle || [r.number, r.ro_number, r.tag, r.customer, r.vehicle].some((v) => (v ?? "").toLowerCase().includes(needle));
  });
  return { count: rows.length, unpaid_total: all.filter((r) => r.status === "unpaid" || r.status === "partial").reduce((n, r) => n + r.balance, 0), rows };
}

export function retailInvoiceDetailFixture(id: string): RetailInvoiceDetail | null {
  if (id === DOC_JOB_ID) return { ...invoiceDocFixture(true), status: "paid", invoice_number: "RI-000044", ro_number: "RO-000046", job_id: DOC_JOB_ID, deleted: false, findings: [] };
  const row = retailInvoiceRows().find((r) => r.id === id);
  if (!row) return null;
  const r101 = JOBS[C1][0];
  const paid = row.status === "paid";
  const base = receiptFixture(RECEIPT_TOKEN, true)!;
  const lines = paid ? base.lines : row.id === JOBS[C2][0].id ? [{ name: "Full detail", price: 200 }] : [{ name: row.status === "void" ? "Trim restore" : "Water spot removal", price: row.total }];
  return {
    ...base,
    id: row.id, job_id: row.id, tag: row.tag, odometer: paid ? 48210 : row.id === JOBS[C2][0].id ? 31200 : 54300, plate: paid ? "8KLM432" : row.id === JOBS[C2][0].id ? "9EVX221" : null, invoice_number: row.number, ro_number: row.ro_number, performed_at: row.performed_at,
    paid_at: row.paid_at, payment_method: paid ? "clover" : null, vehicle: row.vehicle, color: paid ? "Silver" : "Red",
    customer: { id: row.customer_id ?? "", display_name: row.customer, first_name: (row.customer ?? "").split(" ")[0], email: null, phone: null },
    lines, subtotal: row.total, tax: 0, total: row.total, deposit_paid: row.deposit_paid, paid: row.paid, balance: row.balance, status: row.status, deleted: row.status === "void",
    payments: paid ? base.payments : row.deposit_paid > 0 ? [{ kind: "deposit", method: "cash", amount: row.deposit_paid, paid_at: ago(1), provider_ref: null }] : [],
    signed_name: paid ? "Ana Lopez" : null, signed_at: paid ? r101.paid_at : null, has_signature: paid, token: null,
    findings: jobFindingsFixture(row.id),
  };
}

export function retailDashboardFixture(money: boolean): RetailDashboard {
  return {
    today: { cars: 2 },
    month: { cars: 14 },
    open_jobs: 3,
    appointments_today: 3,
    money: money ? { collected_week: 1385, collected_month: 2960, unpaid_invoices: 3, unpaid_total: 705, deposits_outstanding: 66 } : null,
  };
}


// ---------------------------------------------------------------------------
// 0057: the visit behind an approved estimate: the work, the authorizations, the payments, the invoice.
// ?work=none|done|qc (R-103) and ?pay=partial|paid|signed|closed (R-102) walk the stages in the preview.
// ---------------------------------------------------------------------------
import type { VisitPanel } from "@/lib/retail/visit";

export function visitFixture(estimateId: string, money: boolean, isAdmin: boolean, opts: { work?: string | string[]; pay?: string | string[]; unauth?: string | string[] } = {}): VisitPanel | null {
  const base = estimateViewFixture(estimateId, money);
  if (!base?.job || base.kind === "supplement") return null;
  const jobId = base.job.id;
  const workState = opts.work === "qc" || opts.work === "done" ? opts.work : "none";
  const payStage: PayStage = opts.pay === "partial" || opts.pay === "paid" || opts.pay === "signed" || opts.pay === "closed" ? opts.pay : "none";
  const invoiced = !!base.job.invoiced_at;
  const docInv = jobId === DOC_JOB_ID ? invoiceDocFixture(money) : null;
  const charge: RetailCharge | null = docInv
    ? { job_id: jobId, tag: "R-100", vehicle: docInv.vehicle, subtotal: docInv.subtotal, tax: docInv.tax, total: docInv.total, deposit_paid: 0, paid: docInv.total, balance: 0, amount: 0, amount_cents: 0, paid_at: docInv.paid_at, picked_up_at: docInv.paid_at, receipt_signed_at: docInv.signed_at, receipt_signed_name: docInv.signed_name, has_signature: true, signature_required: true,
        payments: docInv.payments.map((p, i) => ({ id: `pay-doc-${i}`, kind: p.kind, status: "paid" as const, method: p.method, paid_at: p.paid_at, provider_ref: null, note: p.note ?? null, amount: money ? p.amount : null })) }
    : invoiced ? retailChargeFixture(jobId, money, payStage) : null;
  const wip = roWorkFixture(jobId, workState);
  const work = wip ?? { jobs: [], mileageIn: base.odometer ?? null, odometerOut: (base.odometer ?? 0) + 10, completedAt: base.job.performed_at, qcAt: base.job.performed_at, qcNote: null, parts: null };
  const detail = invoiced && !docInv ? retailInvoiceDetailFixture(jobId) : null;
  const invoiceDoc: ReceiptView | null = docInv ?? (detail
    ? {
        ...detail,
        jobs: [],
        extras: detail.lines.map((l) => ({ name: l.name, type: "service", total: l.price })),
        categories: { labor: 0, parts: 0, fees: 0, sublets: 0, services: detail.subtotal },
        taxable_types: [],
        declined: [],
        recommended: [],
        authorizations: [{ kind: "estimate", method: "online", authorized_at: base.accepted_at ?? ago(0, 1), name: base.customer.display_name ?? "Customer", amount: money ? detail.total : null }],
        advisor: "MK",
        tech: "VK",
        bar_license: "ARD000000",
        warranty_text: "12 mo / 12,000 mi parts & labor",
        estimate_number: base.display_number,
        invoiced_at: base.job.invoiced_at ?? null,
        picked_up_at: charge?.picked_up_at ?? null,
        paid_at: charge?.paid_at ?? detail.paid_at,
        payments: charge ? charge.payments.filter((p) => p.amount !== null).map((p) => ({ kind: p.kind, method: p.method, amount: p.amount as number, paid_at: p.paid_at, provider_ref: null, note: p.note ?? null })) : detail.payments,
        balance: charge?.balance ?? detail.balance,
        paid: charge ? charge.paid : detail.paid,
        signed_name: charge?.receipt_signed_name ?? null,
        signed_at: charge?.receipt_signed_at ?? null,
        has_signature: !!charge?.has_signature,
      }
    : null);
  return {
    jobId,
    deleted: false,
    invoiced,
    lineCount: base.options[0]?.lines.length ?? 1,
    work,
    payment: { paid_at: charge?.paid_at ?? null, paid_amount: charge?.paid_at ? (charge.total ?? null) : null, payment_method: charge?.paid_at ? "cash" : null, payment_ref: null },
    charge,
    authorizations: roAuthorizationsFixture(jobId, money),
    unauthorized: opts.unauth === "1" && !invoiced ? 1 : 0,
    review: !invoiced && money ? (() => { const rv = roReviewFixture(workState); const un = opts.unauth === "1" ? 1 : 0; return { ...rv, unauthorized: un, ready: rv.ready && un === 0 }; })() : null,
    canComplete: isAdmin && !invoiced,
    canQc: isAdmin && !invoiced,
    canPrice: money,
    receiptUrl: money ? "/r/demo-ro-token-priya-f150-0003" : null,
    invoiceDoc,
  };
}
