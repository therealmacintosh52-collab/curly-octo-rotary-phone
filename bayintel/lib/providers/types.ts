/**
 * Provider adapter interfaces. Every external data source sits behind one of
 * these so licensed sources (MOTOR, CarMD, ...) can be plugged in later without
 * touching the UI. Every returned record carries a `source` label.
 */

export type SourceLabel = "NHTSA" | "COMMUNITY" | "OWNER" | "LICENSED" | "SAMPLE";

export interface Sourced {
  source: SourceLabel;
}

export interface DecodedVehicle extends Sourced {
  vin: string;
  year: number | null;
  make: string;
  model: string;
  trim: string | null;
  engine: string | null; // e.g. "5.0L V8"
  displacementL: number | null;
  cylinders: number | null;
  fuelType: string | null;
  driveType: string | null;
  bodyClass: string | null;
  transmission: string | null;
  plant: string | null;
  /** Raw decoded attributes (already filtered to non-empty values). */
  specs: Record<string, string>;
  errorCode: string | null;
  errorText: string | null;
}

export interface Recall extends Sourced {
  campaignNumber: string;
  component: string;
  summary: string;
  consequence: string;
  remedy: string;
  reportDate: string | null;
  manufacturer: string | null;
  parkOutside: boolean;
  parkIt: boolean;
}

export interface Complaint extends Sourced {
  odiNumber: string;
  components: string[];
  summary: string;
  dateOfIncident: string | null;
  dateComplaintFiled: string | null;
  crash: boolean;
  fire: boolean;
  injuries: number;
  deaths: number;
  mileage: number | null;
}

export interface VehicleKey {
  year: number;
  make: string;
  model: string;
  engine?: string | null;
}

export interface VehicleDataProvider {
  readonly name: string;
  readonly source: SourceLabel;
  decodeVin(vin: string): Promise<DecodedVehicle>;
  getRecalls(key: VehicleKey): Promise<Recall[]>;
  getComplaints(key: VehicleKey): Promise<Complaint[]>;
  getMakes(year: number): Promise<string[]>;
  getModels(year: number, make: string): Promise<string[]>;
}

export interface LaborTime extends Sourced {
  operation: string;
  hours: number;
  skillLevel?: string;
  notes?: string;
}

export interface LaborProvider {
  readonly name: string;
  readonly source: SourceLabel;
  /** Returns null when the provider has no time for the operation. */
  getLaborTime(key: VehicleKey, operation: string): Promise<LaborTime | null>;
  searchOperations(key: VehicleKey, query: string): Promise<LaborTime[]>;
}

export interface RepairArticle extends Sourced {
  id: string;
  title: string;
  kind: "tsb" | "procedure" | "bulletin";
  summary: string;
  systems: string[];
  dtcs: string[];
  url?: string;
}

export interface RepairInfoProvider {
  readonly name: string;
  readonly source: SourceLabel;
  search(key: VehicleKey, opts: { query?: string; dtcs?: string[] }): Promise<RepairArticle[]>;
}

export interface MaintenanceItem extends Sourced {
  intervalMiles: number;
  intervalMonths: number | null;
  service: string;
  notes?: string;
}

export interface MaintenanceProvider {
  readonly name: string;
  readonly source: SourceLabel;
  getSchedule(key: VehicleKey): Promise<MaintenanceItem[]>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
