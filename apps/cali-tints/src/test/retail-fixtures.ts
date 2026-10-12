import type { Customer, CustomerListRow, CustomerTimeline, Vehicle } from "@/lib/db/types";
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
  base({ id: C1, first_name: "Ana", last_name: "Lopez", phone: "(916) 555-0100", email: "ana.lopez@example.com", source: "referral", tags: ["vip"], sms_opt_in: true, sms_opt_in_at: ago(120), marketing_opt_in: true, marketing_opt_in_at: ago(120), consent_source: "in person", notes: "Prefers mornings. Rear bumper scratch noted before first visit.", created_at: ago(120) }),
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
  vbase({ id: V1, customer_id: C1, vin: "4T1BF1FK5CU123456", year: 2019, make: "Toyota", model: "Camry", trim: "SE", body_class: "Sedan/Saloon", size_class: "sedan", color: "Silver", plate: "8KLM432", created_at: ago(120) }),
  vbase({ id: V2, customer_id: C2, vin: "5YJ3E1EA7NF123456", year: 2022, make: "Tesla", model: "Model 3", body_class: "Sedan/Saloon", size_class: "sedan", color: "Red", plate: "9EVX221", created_at: ago(40) }),
  vbase({ id: V3, customer_id: C3, vin: "1FTEW1EP7MFA12345", year: 2021, make: "Ford", model: "F-150", trim: "Lariat", body_class: "Pickup", size_class: "suv_truck", color: "Obsidian Black", plate: "7FLT009", notes: "Fleet truck · bed liner", created_at: ago(300) }),
  vbase({ id: V4, customer_id: C3, year: 2020, make: "Ford", model: "Transit", body_class: "Cargo Van", size_class: "xl", color: "Polar White", plate: "7FLT010", created_at: ago(290) }),
  vbase({ id: V5, customer_id: C4, year: 2018, make: "Honda", model: "Odyssey", body_class: "Minivan", size_class: "xl", color: "Gray", created_at: ago(15) }),
  vbase({ id: V6, customer_id: C5, vin: "2HGFC2F59JH123456", year: 2018, make: "Honda", model: "Civic", body_class: "Coupe", size_class: "compact", color: "Blue", plate: "8CIV118", created_at: ago(200) }),
];

const vehicleName = (v: Vehicle) => [v.year, v.make, v.model].filter(Boolean).join(" ");

/** Visits per customer: the shop's two walk-ins today (R-101 paid, R-102 to collect) plus history. */
type FixtureJob = CustomerTimeline["jobs"][number];
const JOBS: Record<string, FixtureJob[]> = {
  [C1]: [
    { id: "40000000-0000-4000-8000-000000000998", performed_at: ago(0, 2.5), tag: "R-101", vehicle: "2019 Toyota Camry", vehicle_id: V1, services: ["Full detail"], paid_at: ago(0, 1), payment_method: "clover", paid_amount: 200, deleted_at: null },
    { id: "40000000-0000-4000-8000-000000000901", performed_at: ago(62), tag: "R-044", vehicle: "2019 Toyota Camry", vehicle_id: V1, services: ["Clay bar", "Tire shine"], paid_at: ago(62), payment_method: "cash", paid_amount: 95, deleted_at: null },
    { id: "40000000-0000-4000-8000-000000000902", performed_at: ago(118), tag: "R-012", vehicle: "2019 Toyota Camry", vehicle_id: V1, services: ["Full detail"], paid_at: ago(118), payment_method: "clover", paid_amount: 200, deleted_at: null },
  ],
  [C2]: [{ id: "40000000-0000-4000-8000-000000000999", performed_at: ago(0, 0.7), tag: "R-102", vehicle: "2022 Tesla Model 3", vehicle_id: V2, services: ["Full detail"], paid_at: null, payment_method: null, paid_amount: null, deleted_at: null }],
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
        return { ...v, odometer: v.id === V1 ? { reading: 48210, read_at: ago(0, 2.5) } : v.id === V3 ? { reading: 61400, read_at: ago(20) } : null, visits: vj.length, last_visit: vj[0]?.performed_at ?? null };
      }),
    jobs,
    stats: { visits: jobs.length, last_visit: jobs[0]?.performed_at ?? null, lifetime_spend: owner ? jobs.reduce((s, j) => s + (j.paid_amount ?? 0), 0) : null },
  };
}

export function vehicleDetailFixture(id: string): VehicleDetailData | null {
  const v = vehiclesFixture.find((x) => x.id === id);
  if (!v) return null;
  const c = customersFixture.find((x) => x.id === v.customer_id)!;
  const jobs = (JOBS[c.id] ?? []).filter((j) => j.vehicle_id === v.id);
  const odometer = v.id === V1 ? [{ id: "o1", reading: 48210, read_at: ago(0, 2.5), job_id: jobs[0]?.id ?? null }, { id: "o2", reading: 46950, read_at: ago(62), job_id: null }, { id: "o3", reading: 44120, read_at: ago(118), job_id: null }] : v.id === V3 ? [{ id: "o4", reading: 61400, read_at: ago(20), job_id: null }] : [];
  return { vehicle: v, customer: { id: c.id, display_name: c.display_name }, odometer, jobs: jobs.map((j) => ({ id: j.id, performed_at: j.performed_at, tag: j.tag, services: j.services, paid_at: j.paid_at, deleted_at: j.deleted_at })) };
}

export function pickedCustomersFixture(): PickedCustomer[] {
  return customersFixture.map((c) => ({
    id: c.id,
    name: c.display_name ?? c.phone ?? "Customer",
    phone: c.phone,
    vehicles: vehiclesFixture.filter((v) => v.customer_id === c.id && !v.archived_at).map((v) => ({ id: v.id, year: v.year, make: v.make, model: v.model, color: v.color, vin: v.vin, plate: v.plate })),
  }));
}

export function retailTodayFixture(): RetailTodayData {
  const r101 = JOBS[C1][0];
  const r102 = JOBS[C2][0];
  const car = (j: FixtureJob, customer: string) => ({ id: j.id, tag: j.tag, vehicle: j.vehicle, customer, performed_at: j.performed_at, paid_at: j.paid_at, services: j.services });
  return { customers: customersFixture.length, today: [car(r102, "Marcus Reed"), car(r101, "Ana Lopez")], unpaid: [car(r102, "Marcus Reed")] };
}

/** The customer behind each of the Jobs list's walk-in rows (R-101, R-102). */
export const RETAIL_JOB_CUSTOMER: Record<string, { id: string; name: string; vehicle_id: string }> = {
  "R-101": { id: C1, name: "Ana Lopez", vehicle_id: V1 },
  "R-102": { id: C2, name: "Marcus Reed", vehicle_id: V2 },
};
