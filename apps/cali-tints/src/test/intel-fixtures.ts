import type { DtcCode, RecentLookup } from "@/lib/db/types";
import type { Complaint, DecodedVehicle, NhtsaBundle, Recall } from "@/lib/intel/types";
import type { CodesScreenData } from "@/components/intel/codes-screen";
import type { GarageData } from "@/components/intel/garage";
import type { VehicleIntelData } from "@/components/intel/vehicle-intel";
import type { GarageRow } from "@/lib/intel/data";
import { parseDtcList } from "@/lib/intel/dtc";
import { RETAIL_VEHICLE_IDS, customersFixture, vehiclesFixture } from "./retail-fixtures";

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
    jobs,
    tab,
  };
}
