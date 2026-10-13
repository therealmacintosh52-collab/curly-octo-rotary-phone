/**
 * Intel: repair intelligence for the shop's cars, inside this app. The data
 * sources are NHTSA (free, public, no key: vPIC decode, recalls, complaints),
 * the seeded generic trouble-code table and the shop's own fix library. Every
 * record carries where it came from so the screens can say so.
 */

export type SourceLabel = "NHTSA" | "SHOP" | "GENERIC";

export interface Sourced {
  source: SourceLabel;
}

export interface DecodedVehicle extends Sourced {
  vin: string;
  year: number | null;
  make: string;
  model: string;
  trim: string | null;
  /** e.g. "5.0L V8", "1.5L I4 Turbo" */
  engine: string | null;
  displacementL: number | null;
  cylinders: number | null;
  fuelType: string | null;
  driveType: string | null;
  bodyClass: string | null;
  transmission: string | null;
  plant: string | null;
  /** Raw vPIC attributes worth showing (non-empty only). */
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

/** What a vehicle screen gets from NHTSA; each half fails on its own. */
export interface NhtsaBundle {
  recalls: Recall[];
  complaints: Complaint[];
  errors: { recalls?: string; complaints?: string };
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
