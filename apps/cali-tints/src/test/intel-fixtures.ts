import type { DtcCode, FixDetail, FixSummary, RankedFix, RecentLookup } from "@/lib/db/types";
import type { Complaint, DecodedVehicle, NhtsaBundle, Recall } from "@/lib/intel/types";
import type { CodesScreenData } from "@/components/intel/codes-screen";
import type { GarageData } from "@/components/intel/garage";
import type { VehicleIntelData } from "@/components/intel/vehicle-intel";
import type { GarageRow } from "@/lib/intel/data";
import { parseDtcList } from "@/lib/intel/dtc";
import { RETAIL_VEHICLE_IDS, customersFixture, vehiclesFixture } from "./retail-fixtures";

const ago = (days: number) => new Date(Date.now() - days * 86400000).toISOString();

/*
  Intel fixtures for the guest demo and the previews. The code definitions
  are the seeded rows (migration 0045). The recalls and complaints are
  recorded in the shape NHTSA returns, on the demo Camry and Model 3, so the
  screens render without the network (NHTSA is unreachable from the build
  sandbox and the guest demo has no database).
*/

const DEFS: DtcCode[] = [
  { code: "P0171", description: "System Too Lean (Bank 1)", system: "fuel_air", category: "powertrain", is_generic: true, common_causes: ["Vacuum leak", "PCV hose/valve", "Dirty MAF", "Weak fuel pump", "Clogged injector", "Exhaust leak before O2"], safety_flag: null },
  { code: "P0300", description: "Random/Multiple Cylinder Misfire Detected", system: "ignition_misfire", category: "powertrain", is_generic: true, common_causes: ["Spark plugs", "Coils", "Vacuum leak", "Fuel delivery", "Low compression", "Lifters/valvetrain", "EGR stuck open"], safety_flag: null },
  { code: "P0420", description: "Catalyst System Efficiency Below Threshold (Bank 1)", system: "emissions", category: "powertrain", is_generic: true, common_causes: ["Catalytic converter", "Downstream O2 sensor", "Exhaust leak", "Misfire/rich history", "Oil consumption"], safety_flag: null },
  { code: "P0A80", description: "Replace Hybrid Battery Pack", system: "hybrid_ev", category: "powertrain", is_generic: true, common_causes: ["HV battery module(s)", "Cell imbalance"], safety_flag: "ev_high_voltage" },
  { code: "B0001", description: "Driver Frontal Stage 1 Deployment Control", system: "body", category: "body", is_generic: true, common_causes: ["Airbag module", "Clockspring", "Connector"], safety_flag: "srs" },
  { code: "C0035", description: "Left Front Wheel Speed Sensor Circuit", system: "chassis", category: "chassis", is_generic: true, common_causes: ["Wheel speed sensor", "Tone ring", "Wiring", "Hub bearing"], safety_flag: "brakes" },
  { code: "U0100", description: 'Lost Communication With ECM/PCM "A"', system: "network", category: "network", is_generic: true, common_causes: ["PCM power/ground", "CAN wiring", "Low battery", "PCM"], safety_flag: null },
];

export function dtcDefinitionsFixture(codes: string[]): Record<string, DtcCode> {
  return Object.fromEntries(DEFS.filter((d) => codes.includes(d.code)).map((d) => [d.code, d]));
}

const camryDecoded: DecodedVehicle = {
  source: "NHTSA", vin: "4T1BF1FK5CU123456", year: 2019, make: "Toyota", model: "Camry", trim: "SE", engine: "2.5L I4", displacementL: 2.5, cylinders: 4, fuelType: "Gasoline", driveType: "FWD/Front-Wheel Drive", bodyClass: "Sedan/Saloon", transmission: "8-speed Automatic", plant: "GEORGETOWN, UNITED STATES (USA)",
  specs: { Make: "TOYOTA", Model: "Camry", ModelYear: "2019", Trim: "SE", BodyClass: "Sedan/Saloon", DriveType: "FWD/Front-Wheel Drive", EngineCylinders: "4", DisplacementL: "2.5", EngineHP: "203", FuelTypePrimary: "Gasoline", FuelInjectionType: "Direct and Port", TransmissionStyle: "Automatic", TransmissionSpeeds: "8", PlantCity: "GEORGETOWN", PlantCountry: "UNITED STATES (USA)", Manufacturer: "TOYOTA MOTOR MANUFACTURING, KENTUCKY, INC.", VehicleType: "PASSENGER CAR", Doors: "4", ABS: "Standard", ESC: "Standard", TPMS: "Direct", AirBagLocFront: "1st Row (Driver and Passenger)", AirBagLocCurtain: "1st and 2nd Rows", BrakeSystemType: "Hydraulic" },
  errorCode: "0", errorText: "0 - VIN decoded clean. Check Digit (9th position) is correct",
};

const model3Decoded: DecodedVehicle = {
  source: "NHTSA", vin: "5YJ3E1EA7NF123456", year: 2022, make: "Tesla", model: "Model 3", trim: null, engine: null, displacementL: null, cylinders: null, fuelType: "Electric", driveType: "RWD/Rear-Wheel Drive", bodyClass: "Sedan/Saloon", transmission: "1-speed Automatic", plant: "FREMONT, UNITED STATES (USA)",
  specs: { Make: "TESLA", Model: "Model 3", ModelYear: "2022", BodyClass: "Sedan/Saloon", DriveType: "RWD/Rear-Wheel Drive", FuelTypePrimary: "Electric", ElectrificationLevel: "BEV (Battery Electric Vehicle)", BatteryType: "Lithium-Ion/Li-Ion", EVDriveUnit: "Single Motor", TransmissionStyle: "Automatic", TransmissionSpeeds: "1", PlantCity: "FREMONT", PlantCountry: "UNITED STATES (USA)", Manufacturer: "TESLA, INC.", VehicleType: "PASSENGER CAR", Doors: "4", ABS: "Standard", ESC: "Standard" },
  errorCode: "0", errorText: "0 - VIN decoded clean. Check Digit (9th position) is correct",
};

const camryRecalls: Recall[] = [
  { source: "NHTSA", campaignNumber: "19V775000", component: "FUEL SYSTEM, GASOLINE:DELIVERY:FUEL PUMP", summary: "Toyota is recalling certain 2019 Camry vehicles. The low-pressure fuel pump may fail, causing the engine to run rough or stall.", consequence: "An engine stall while driving at higher speeds increases the risk of a crash.", remedy: "Dealers will replace the fuel pump free of charge.", reportDate: "2019-11-01", manufacturer: "Toyota Motor Engineering & Manufacturing", parkOutside: false, parkIt: false },
  { source: "NHTSA", campaignNumber: "20V012000", component: "ELECTRICAL SYSTEM", summary: "The engine control module software may cause the vehicle to stall under certain driving conditions.", consequence: "A stall increases the risk of a crash.", remedy: "Dealers will update the ECM software free of charge.", reportDate: "2020-01-10", manufacturer: "Toyota Motor Engineering & Manufacturing", parkOutside: false, parkIt: false },
];

const c = (odi: string, components: string[], date: string, summary: string, over: Partial<Complaint> = {}): Complaint => ({ source: "NHTSA", odiNumber: odi, components, summary, dateOfIncident: date, dateComplaintFiled: date, crash: false, fire: false, injuries: 0, deaths: 0, mileage: null, ...over });

const camryComplaints: Complaint[] = [
  c("11290111", ["ENGINE"], "2019-10-02", "ENGINE STALLED WHILE DRIVING ON THE HIGHWAY AT 65 MPH. CHECK ENGINE LIGHT CAME ON. DEALER SAID FUEL PUMP.", { mileage: 8200 }),
  c("11301452", ["FUEL SYSTEM, GASOLINE", "ENGINE"], "2019-12-14", "CAR HESITATES AND RUNS ROUGH WHEN ACCELERATING FROM A STOP. STALLED TWICE IN A PARKING LOT.", { mileage: 11400 }),
  c("11322890", ["ENGINE"], "2020-02-20", "ROUGH IDLE AND MISFIRE AT COLD START. CODE P0300 STORED. DEALER REPLACED COILS, PROBLEM RETURNED.", { mileage: 19000 }),
  c("11334001", ["ELECTRICAL SYSTEM"], "2020-04-05", "INFOTAINMENT SCREEN GOES BLACK AND REBOOTS WHILE DRIVING. BACKUP CAMERA UNAVAILABLE.", { mileage: 21500 }),
  c("11350777", ["SERVICE BRAKES"], "2020-07-19", "BRAKE PEDAL WENT SOFT AND TRAVELLED FURTHER THAN NORMAL. ABS LIGHT ON. SHOP FOUND A WHEEL SPEED SENSOR FAULT.", { mileage: 26000 }),
  c("11367120", ["ENGINE"], "2020-09-30", "CHECK ENGINE LIGHT WITH P0171 LEAN CODE. SMELL OF FUEL. DEALER FOUND A CRACKED PCV HOSE.", { mileage: 30100 }),
  c("11402233", ["POWER TRAIN"], "2021-03-12", "TRANSMISSION SHUDDERS AND JERKS BETWEEN 2ND AND 3RD GEAR AT LOW SPEED.", { mileage: 38000 }),
  c("11433560", ["ENGINE"], "2021-08-01", "STALLED AT A RED LIGHT WITH NO WARNING. RESTARTED AFTER A MINUTE. RECALL WORK WAS ALREADY DONE.", { mileage: 44200 }),
  c("11460912", ["ELECTRICAL SYSTEM"], "2021-11-23", "DASH WARNING LIGHTS FLICKER AND THE CAR LOSES POWER STEERING ASSIST FOR A SECOND.", { mileage: 49000 }),
  c("11501188", ["EXHAUST SYSTEM"], "2022-05-17", "P0420 CATALYST CODE AT 60K MILES. NO OTHER SYMPTOMS. DEALER QUOTED A CONVERTER.", { mileage: 60300 }),
  c("11544320", ["ENGINE"], "2023-01-08", "OIL CONSUMPTION, A QUART EVERY 1500 MILES, AND A LIFTER TICK ON COLD START.", { mileage: 71000 }),
  c("11590004", ["SERVICE BRAKES"], "2023-09-26", "REAR BRAKES GRINDING AT 80K. PADS WORE UNEVENLY, CALIPER SLIDE PINS SEIZED.", { mileage: 80500 }),
];

const model3Complaints: Complaint[] = [
  c("11580221", ["ELECTRICAL SYSTEM"], "2023-06-04", "TOUCHSCREEN FROZE WHILE DRIVING; NO SPEEDOMETER OR TURN SIGNAL SOUNDS UNTIL IT REBOOTED.", { mileage: 14000 }),
  c("11612340", ["ELECTRICAL SYSTEM"], "2023-11-19", "PHANTOM BRAKING ON THE FREEWAY WITH AUTOPILOT ON. NO VEHICLE AHEAD.", { mileage: 22000 }),
  c("11655870", ["SUSPENSION"], "2024-04-02", "CLUNK FROM THE FRONT SUSPENSION OVER BUMPS. CONTROL ARM BUSHING.", { mileage: 31000 }),
];

const bundles: Record<string, NhtsaBundle> = {
  [RETAIL_VEHICLE_IDS.camry]: { recalls: camryRecalls, complaints: camryComplaints, errors: {} },
  [RETAIL_VEHICLE_IDS.model3]: { recalls: [], complaints: model3Complaints, errors: {} },
};
const decoded: Record<string, DecodedVehicle> = { [RETAIL_VEHICLE_IDS.camry]: camryDecoded, [RETAIL_VEHICLE_IDS.model3]: model3Decoded };

const name = (v: { year: number | null; make: string | null; model: string | null }) => [v.year, v.make, v.model].filter(Boolean).join(" ") || "Vehicle";
const customerOf = (id: string) => {
  const cu = customersFixture.find((x) => x.id === id);
  return cu ? { id: cu.id, display_name: cu.display_name } : null;
};

export function garageRowsFixture(q = ""): GarageRow[] {
  const term = q.trim().toLowerCase();
  return vehiclesFixture
    .filter((v) => !v.archived_at)
    .filter((v) => !term || [v.vin, v.make, v.model, v.plate].some((x) => x?.toLowerCase().includes(term)))
    .map((v) => ({ id: v.id, vin: v.vin, year: v.year, make: v.make, model: v.model, trim: v.trim, engine: decoded[v.id]?.engine ?? null, color: v.color, plate: v.plate, customer: customerOf(v.customer_id) }));
}

export function recentLookupsFixture(): RecentLookup[] {
  return [
    { kind: "code", query: "P0300 P0171", at: new Date(Date.now() - 3600_000).toISOString() },
    { kind: "vin", query: "4T1BF1FK5CU123456", at: new Date(Date.now() - 2 * 3600_000).toISOString() },
    { kind: "code", query: "C0035", at: new Date(Date.now() - 26 * 3600_000).toISOString() },
  ];
}

export function codesScreenFixture(sp: { codes?: string | string[]; vehicle?: string | string[] }): CodesScreenData {
  const codes = parseDtcList(typeof sp.codes === "string" ? sp.codes : "");
  const vehicleId = typeof sp.vehicle === "string" ? sp.vehicle : "";
  const v = vehiclesFixture.find((x) => x.id === vehicleId) ?? null;
  return {
    codes,
    definitions: dtcDefinitionsFixture(codes),
    vehicles: garageRowsFixture().map((r) => ({ id: r.id, label: `${name(r)}${r.plate ? ` · ${r.plate}` : ""}${r.customer?.display_name ? ` · ${r.customer.display_name}` : ""}` })),
    vehicle: v ? { id: v.id, name: name(v) } : null,
    nhtsa: v && codes.length ? (bundles[v.id] ?? { recalls: [], complaints: [], errors: {} }) : null,
    fixes: !codes.length ? [] : v ? rankedFixesFixture(v, codes) : fixesFixture().filter((f) => f.codes.some((c) => codes.includes(c))),
    recent: recentLookupsFixture(),
  };
}

export function garageFixture(sp: { q?: string | string[]; vin?: string | string[] }): GarageData {
  const q = typeof sp.q === "string" ? sp.q : "";
  const vin = typeof sp.vin === "string" ? sp.vin.toUpperCase() : "";
  let lookup: GarageData["lookup"] = null;
  if (vin) {
    const hit = Object.entries(decoded).find(([, d]) => d.vin === vin);
    lookup = hit ? { vin, decoded: hit[1], nhtsa: bundles[hit[0]] } : { vin, decoded: null, nhtsa: null, error: "Guest preview: only the sample cars' VINs decode here (try 4T1BF1FK5CU123456)." };
  }
  return { q, vehicles: garageRowsFixture(q), lookup };
}

export function vehicleIntelFixture(id: string, tab?: string): VehicleIntelData | null {
  const v = vehiclesFixture.find((x) => x.id === id);
  if (!v) return null;
  const d = decoded[id] ?? null;
  const jobs = id === RETAIL_VEHICLE_IDS.camry
    ? [{ id: "40000000-0000-4000-8000-000000000998", performed_at: new Date(Date.now() - 150 * 60000).toISOString(), tag: "R-101", ro_number: "RO-000041", services: ["Full detail"], paid_at: new Date().toISOString() }]
    : id === RETAIL_VEHICLE_IDS.model3
      ? [{ id: "40000000-0000-4000-8000-000000000999", performed_at: new Date(Date.now() - 40 * 60000).toISOString(), tag: "R-102", ro_number: "RO-000042", services: ["Full detail"], paid_at: null }]
      : [];
  return {
    vehicle: { id: v.id, name: name(v), vin: v.vin, trim: v.trim, engine: d?.engine ?? null, color: v.color, plate: v.plate, customer: customerOf(v.customer_id), specs_source: d ? "NHTSA" : null },
    decoded: d,
    nhtsa: bundles[id] ?? { recalls: [], complaints: [], errors: {} },
    fixes: rankedFixesFixture(v),
    jobs,
    tab,
  };
}


// ---------------------------------------------------------------------------
// The shop's fix library: five fixes written by "the shop" for the demo cars.
// ---------------------------------------------------------------------------
export const FIX_IDS = { misfire: "a1000000-0000-4000-8000-000000000001", wheelSpeed: "a1000000-0000-4000-8000-000000000002", catalyst: "a1000000-0000-4000-8000-000000000003", touchscreen: "a1000000-0000-4000-8000-000000000004", pcv: "a1000000-0000-4000-8000-000000000005" } as const;

type FixSeed = Omit<FixDetail, "can_edit" | "can_delete" | "media">;
const SEEDS: FixSeed[] = [
  {
    id: FIX_IDS.misfire, title: "Cold-start misfire, worn plugs and oil-soaked coil boots", year: 2019, make: "Toyota", model: "Camry", engine: "2.5L I4", mileage: 61000, codes: ["P0171", "P0300"],
    symptoms: "Shakes at idle when cold and the check engine light flashes on hard acceleration. Goes away after a few minutes.", freeze_frame_notes: "P0300 set at 640 rpm, coolant 52 F, short-term trim +9 %.", vehicle_id: RETAIL_VEHICLE_IDS.camry, job_id: null,
    tests: [{ test: "Misfire counters on a cold start", result: "Cylinders 2 and 3 only" }, { test: "Pulled the coils", result: "Oil in the plug wells of 2 and 3" }],
    root_cause: "Plugs worn past gap, and a leaking valve cover gasket was filling two wells with oil and soaking the coil boots.", fix_description: "Replaced the plugs, the two coil boots and the valve cover gasket. Cleared the codes and road tested cold and hot.",
    labor_hours: 1.8, confirm_count: 2, deny_count: 0, net_score: 2, version: 2, created_at: ago(40), is_mine: false, my_vote: null,
    parts: [{ id: "p1", name: "Spark plug", part_number: "SP-4", brand: null, quantity: 4, unit_price: 11.5 }, { id: "p2", name: "Coil boot", part_number: null, brand: null, quantity: 2, unit_price: 9 }, { id: "p3", name: "Valve cover gasket", part_number: "VCG-25", brand: null, quantity: 1, unit_price: 38 }],
    notes: [{ verdict: "fixed", note: "Same thing on a 2020 at 48k.", created_at: ago(20) }], revisions: [{ version: 1, change_note: "Found why the boots were wet", created_at: ago(35) }],
  },
  {
    id: FIX_IDS.wheelSpeed, title: "ABS light and soft pedal, left front wheel speed sensor", year: 2019, make: "Toyota", model: "Camry", engine: "2.5L I4", mileage: 26000, codes: ["C0035"],
    symptoms: "ABS and traction lights on, pedal feels long on the first stop of the morning. Intermittent.", freeze_frame_notes: null, vehicle_id: null, job_id: null,
    tests: [{ test: "Live data, wheel speeds on a drive", result: "Left front drops out above 25 mph" }, { test: "Sensor tip and tone ring", result: "Tip clean, tone ring packed with rust scale" }],
    root_cause: "Rust scale on the hub tone ring starving the sensor of signal; the sensor itself tested good.", fix_description: "Cleaned and re-seated the sensor, replaced the hub bearing assembly (the tone ring is part of it), road tested with ABS active.",
    labor_hours: 1.6, confirm_count: 1, deny_count: 0, net_score: 1, version: 1, created_at: ago(90), is_mine: true, my_vote: null,
    parts: [{ id: "p4", name: "Front hub bearing assembly", part_number: "HB-513", brand: null, quantity: 1, unit_price: 118 }], notes: [], revisions: [],
  },
  {
    id: FIX_IDS.catalyst, title: "P0420 at 60k, the downstream O2 sensor, not the converter", year: 2018, make: "Toyota", model: "Camry", engine: "2.5L I4", mileage: 60300, codes: ["P0420"],
    symptoms: "Check engine light with P0420 and nothing else wrong; runs perfectly.", freeze_frame_notes: "Closed loop, trims within 3 %, no misfire history.", vehicle_id: null, job_id: null,
    tests: [{ test: "Upstream vs downstream O2 waveforms", result: "Downstream lazy, slow to cross, flat after a snap throttle" }, { test: "Exhaust leak check before the sensor", result: "None" }],
    root_cause: "Slow downstream oxygen sensor reading like a tired catalyst.", fix_description: "Replaced the downstream sensor, cleared the code and ran the monitor to completion. No return in 600 miles.",
    labor_hours: 0.7, confirm_count: 3, deny_count: 0, net_score: 3, version: 1, created_at: ago(120), is_mine: false, my_vote: "fixed",
    parts: [{ id: "p5", name: "Downstream O2 sensor", part_number: "O2-D4", brand: null, quantity: 1, unit_price: 74 }], notes: [], revisions: [],
  },
  {
    id: FIX_IDS.touchscreen, title: "Touchscreen reboot loop while driving", year: 2022, make: "Tesla", model: "Model 3", engine: null, mileage: 22000, codes: [],
    symptoms: "The center screen goes black and restarts, sometimes twice in a drive. Speed and turn signal sounds drop out until it comes back.", freeze_frame_notes: null, vehicle_id: RETAIL_VEHICLE_IDS.model3, job_id: null,
    tests: [{ test: "Two-button reset", result: "Fixed it for a day, came back" }], root_cause: "Failing storage on the media control unit.", fix_description: "Sent to the manufacturer's service center for an MCU replacement under the extended warranty. Not a shop repair.",
    labor_hours: null, confirm_count: 0, deny_count: 0, net_score: 0, version: 1, created_at: ago(14), is_mine: true, my_vote: null, parts: [], notes: [], revisions: [],
  },
  {
    id: FIX_IDS.pcv, title: "Lean both banks, cracked PCV elbow", year: 2021, make: "Ford", model: "F-150", engine: "5.0L V8", mileage: 64000, codes: ["P0171", "P0174"],
    symptoms: "Lean codes on both banks, a slight hunting idle and a hiss under the hood at idle.", freeze_frame_notes: "Long-term trims +22 % / +19 % at idle, normal above 2500 rpm.", vehicle_id: RETAIL_VEHICLE_IDS.f150, job_id: null,
    tests: [{ test: "Smoke test on the intake", result: "Smoke from the PCV elbow at the valve cover" }, { test: "Fuel pressure", result: "Normal and steady" }],
    root_cause: "Cracked PCV hose elbow letting unmetered air in at idle.", fix_description: "Replaced the PCV hose assembly. Trims back within 3 % after a 20 mile drive cycle.",
    labor_hours: 0.5, confirm_count: 1, deny_count: 0, net_score: 1, version: 1, created_at: ago(60), is_mine: false, my_vote: null,
    parts: [{ id: "p6", name: "PCV hose assembly", part_number: "PCV-21", brand: null, quantity: 1, unit_price: 38 }], notes: [], revisions: [],
  },
];

const summary = (f: FixSeed): FixSummary => ({ id: f.id, title: f.title, year: f.year, make: f.make, model: f.model, engine: f.engine, mileage: f.mileage, root_cause: f.root_cause, labor_hours: f.labor_hours, confirm_count: f.confirm_count, deny_count: f.deny_count, net_score: f.net_score, version: f.version, created_at: f.created_at, is_mine: f.is_mine, codes: f.codes });

export const fixesFixture = (): FixSummary[] => SEEDS.map(summary);

export function fixDetailFixture(id: string, canPrices: boolean): FixDetail | null {
  const f = SEEDS.find((x) => x.id === id);
  if (!f) return null;
  return { ...f, can_edit: f.is_mine || canPrices, can_delete: canPrices, media: [], parts: f.parts.map((p) => ({ ...p, unit_price: canPrices ? p.unit_price : null })) };
}

export function fixesListFixture(sp: { q?: string | string[]; codes?: string | string[]; mine?: string | string[] }): FixSummary[] {
  const q = typeof sp.q === "string" ? sp.q.toLowerCase() : "";
  const codes = typeof sp.codes === "string" ? sp.codes.toUpperCase().split(/[\s,]+/).filter(Boolean) : [];
  return SEEDS.filter((f) => (!q || [f.title, f.symptoms, f.root_cause, f.fix_description].some((t) => t.toLowerCase().includes(q))) && (!codes.length || codes.some((c) => f.codes.includes(c))) && (sp.mine !== "1" || f.is_mine)).map(summary);
}

/** The shop's fixes for a demo car: same make and model within three model years. */
export function rankedFixesFixture(car: { year: number | null; make: string | null; model: string | null }, codes?: string[]): RankedFix[] {
  if (!car.year || !car.make || !car.model) return [];
  return SEEDS.filter((f) => f.make.toLowerCase() === car.make!.toLowerCase() && f.model.toLowerCase() === car.model!.toLowerCase() && Math.abs(f.year - car.year!) <= 3 && (!codes?.length || f.codes.some((c) => codes.includes(c))))
    .map((f) => ({ ...summary(f), rank_score: f.net_score * 10 + f.confirm_count + (f.year === car.year ? 5 : 0), match_level: (f.year === car.year ? "exact" : "near_year") as RankedFix["match_level"], matched_codes: f.codes.filter((c) => codes?.includes(c)) }))
    .sort((a, b) => b.rank_score - a.rank_score);
}
