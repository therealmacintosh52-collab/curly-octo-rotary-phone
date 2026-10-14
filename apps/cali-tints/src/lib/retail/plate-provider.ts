/**
 * Plate → VIN (0053 round). There is no free source for it: every real
 * service is a paid API, and it must only ever return vehicle data (never the
 * owner: the federal Driver's Privacy Protection Act). So the app looks in its
 * own records first (free), and a paid provider can be switched on with two
 * environment variables. It ships OFF: no adapter is bundled until the shop
 * picks a vendor, because an adapter has to be written against that vendor's
 * own documentation.
 *
 *   PLATE_PROVIDER=none        (default)
 *   PLATE_PROVIDER=<vendor>    + PLATE_PROVIDER_KEY=<key>
 */
export interface PlateProvider {
  name: string;
  /** The VIN behind a plate in a state, or null when the vendor does not know it. Vehicle data only. */
  lookup(plate: string, state: string): Promise<{ vin: string } | null>;
}

/** Vendor adapters, keyed by the PLATE_PROVIDER value. Add one here once a vendor is chosen. */
export const PLATE_ADAPTERS: Record<string, (key: string) => PlateProvider> = {};

export type PlateProviderState = { kind: "off" } | { kind: "unavailable"; reason: string } | { kind: "on"; provider: PlateProvider };

/** What is switched on right now. A name with no adapter, or no key, is reported rather than silently ignored. */
export function plateProvider(env: Record<string, string | undefined> = process.env): PlateProviderState {
  const name = (env.PLATE_PROVIDER ?? "none").trim().toLowerCase();
  if (!name || name === "none") return { kind: "off" };
  const make = PLATE_ADAPTERS[name];
  if (!make) return { kind: "unavailable", reason: `The plate provider “${name}” has no adapter in this version` };
  const key = env.PLATE_PROVIDER_KEY?.trim();
  if (!key) return { kind: "unavailable", reason: "PLATE_PROVIDER_KEY is not set" };
  return { kind: "on", provider: make(key) };
}

/** A plate the way it is compared: upper case, letters and digits only. */
export const normalizePlate = (raw: string): string => raw.toUpperCase().replace(/[^A-Z0-9]/g, "");

/** Plausible: 2 to 8 characters (CA standard plates are 7, personalized up to 7, other states vary). */
export const isPlateShape = (plate: string): boolean => plate.length >= 2 && plate.length <= 8;
