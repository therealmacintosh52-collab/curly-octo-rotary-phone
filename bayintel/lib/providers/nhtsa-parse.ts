import type { Complaint, DecodedVehicle, Recall, VehicleKey } from "./types";

/** Pure parsers for NHTSA payloads (unit-tested against recorded fixtures). */

const SPEC_KEYS = [
  "Make", "Model", "ModelYear", "Trim", "Series", "BodyClass", "DriveType", "EngineModel", "EngineConfiguration",
  "EngineCylinders", "DisplacementL", "DisplacementCC", "EngineHP", "FuelTypePrimary", "FuelTypeSecondary", "FuelInjectionType",
  "Turbo", "TransmissionStyle", "TransmissionSpeeds", "PlantCountry", "PlantCity", "PlantCompanyName", "Manufacturer",
  "VehicleType", "GVWR", "Doors", "Seats", "ABS", "ESC", "TPMS", "AirBagLocFront", "AirBagLocSide", "AirBagLocCurtain",
  "ElectrificationLevel", "BatteryType", "BatteryKWh", "EVDriveUnit", "ChargerLevel", "BrakeSystemType", "SteeringLocation",
  "WheelBaseShort", "WheelBaseLong", "BedLengthIN", "CabType", "Axles", "AxleConfiguration",
];

export function parseDecodedVin(vin: string, row: Record<string, string>): DecodedVehicle {
  const specs: Record<string, string> = {};
  for (const k of SPEC_KEYS) {
    const v = row[k]?.trim();
    if (v && v !== "Not Applicable") specs[k] = v;
  }
  const dispL = row.DisplacementL ? Number.parseFloat(row.DisplacementL) : NaN;
  const cyl = row.EngineCylinders ? Number.parseInt(row.EngineCylinders, 10) : NaN;
  const config = row.EngineConfiguration?.trim();
  const turbo = row.Turbo?.trim().toLowerCase() === "yes";
  let engine: string | null = null;
  if (!Number.isNaN(dispL)) {
    const layout = config && /^v-?shaped$/i.test(config) ? "V" : config && /in-?line/i.test(config) ? "I" : config && /flat|boxer/i.test(config) ? "H" : "";
    engine = `${dispL.toFixed(1)}L${layout && !Number.isNaN(cyl) ? ` ${layout}${cyl}` : !Number.isNaN(cyl) ? ` ${cyl}-cyl` : ""}${turbo ? " Turbo" : ""}`;
  } else if (row.EngineModel?.trim()) {
    engine = row.EngineModel.trim();
  }
  const year = row.ModelYear ? Number.parseInt(row.ModelYear, 10) : NaN;
  return {
    source: "NHTSA",
    vin,
    year: Number.isNaN(year) ? null : year,
    make: row.Make?.trim() ?? "",
    model: row.Model?.trim() ?? "",
    trim: row.Trim?.trim() || row.Series?.trim() || null,
    engine,
    displacementL: Number.isNaN(dispL) ? null : dispL,
    cylinders: Number.isNaN(cyl) ? null : cyl,
    fuelType: row.FuelTypePrimary?.trim() || null,
    driveType: row.DriveType?.trim() || null,
    bodyClass: row.BodyClass?.trim() || null,
    transmission: [row.TransmissionSpeeds?.trim(), row.TransmissionStyle?.trim()].filter(Boolean).join("-speed ") || null,
    plant: [row.PlantCity?.trim(), row.PlantCountry?.trim()].filter(Boolean).join(", ") || null,
    specs,
    errorCode: row.ErrorCode?.trim() || null,
    errorText: row.ErrorText?.trim() || null,
  };
}

/** NHTSA error codes: "0" clean; "1" check digit; "6"/"7"/"8" partial/incomplete decode. */
export function decodeIsUsable(d: DecodedVehicle) {
  if (!d.make || !d.model || !d.year) return false;
  const code = d.errorCode?.split(",")[0]?.trim();
  return !code || ["0", "1", "6", "7", "8", "14"].includes(code);
}

export function normalizeVehicleKey(key: VehicleKey) {
  return { year: key.year, make: key.make.trim().toLowerCase(), model: key.model.trim().toLowerCase() };
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : v == null ? "" : String(v);
}

/**
 * NHTSA date strings are slash-formatted and the field order differs by endpoint:
 * recalls use dd/mm/yyyy ("02/09/2016" = 2 Sep 2016) and complaints use mm/dd/yyyy.
 * `prefer` sets the order; if that reading is impossible (month > 12) the other order is used.
 */
export function dateOrNull(v: unknown, prefer: "dmy" | "mdy" = "mdy"): string | null {
  const s = str(v);
  if (!s) return null;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = m[3];
    let month: number;
    let day: number;
    if (prefer === "dmy") {
      [day, month] = b > 12 ? [b, a] : [a, b];
    } else {
      [month, day] = a > 12 ? [b, a] : [a, b];
    }
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function parseRecall(r: Record<string, unknown>): Recall {
  return {
    source: "NHTSA",
    campaignNumber: str(r.NHTSACampaignNumber),
    component: str(r.Component),
    summary: str(r.Summary),
    consequence: str(r.Consequence),
    remedy: str(r.Remedy),
    reportDate: dateOrNull(r.ReportReceivedDate, "dmy"),
    manufacturer: str(r.Manufacturer) || null,
    parkOutside: str(r.parkOutSide).toLowerCase() === "true",
    parkIt: str(r.parkIt).toLowerCase() === "true",
  };
}

export function parseComplaint(c: Record<string, unknown>): Complaint {
  const comps = str(c.components)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const mileage = Number(c.odometer ?? c.mileage);
  return {
    source: "NHTSA",
    odiNumber: str(c.odiNumber),
    components: comps.length ? comps : ["UNKNOWN"],
    summary: str(c.summary),
    dateOfIncident: dateOrNull(c.dateOfIncident, "mdy"),
    dateComplaintFiled: dateOrNull(c.dateComplaintFiled, "mdy"),
    crash: Boolean(c.crash),
    fire: Boolean(c.fire),
    injuries: Number(c.numberOfInjuries ?? 0) || 0,
    deaths: Number(c.numberOfDeaths ?? 0) || 0,
    mileage: Number.isFinite(mileage) && mileage > 0 ? mileage : null,
  };
}
