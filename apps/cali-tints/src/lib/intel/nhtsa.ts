import "server-only";

import { cached } from "./cache";
import { normalizeVehicleKey, parseComplaint, parseDecodedVin, parseRecall } from "./nhtsa-parse";
import { ProviderError, type Complaint, type DecodedVehicle, type NhtsaBundle, type Recall, type VehicleKey } from "./types";

/**
 * NHTSA, free and public, no key: vPIC decode (full attributes), recalls and
 * complaints by year / make / model. Cached 24 h (recalls and complaints
 * change slowly). Endpoints:
 *   https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/{vin}?format=json
 *   https://api.nhtsa.gov/recalls/recallsByVehicle?make=&model=&modelYear=
 *   https://api.nhtsa.gov/complaints/complaintsByVehicle?make=&model=&modelYear=
 */
const VPIC = "https://vpic.nhtsa.dot.gov/api/vehicles";
const API = "https://api.nhtsa.gov";
export const NHTSA_TTL_MS = 24 * 60 * 60 * 1000;

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new ProviderError(`NHTSA request failed (${res.status})`, "nhtsa", res.status);
  return (await res.json()) as T;
}

/** The full vPIC decode (the existing /api/vin route keeps the short form and its own cache). */
export async function decodeVinFull(vin: string): Promise<DecodedVehicle> {
  const v = vin.toUpperCase();
  return cached(`nhtsa:vin:${v}`, "nhtsa", NHTSA_TTL_MS * 7, async () => {
    const json = await getJson<{ Results: Record<string, string>[] }>(`${VPIC}/DecodeVinValues/${encodeURIComponent(v)}?format=json`);
    const row = json.Results?.[0];
    if (!row) throw new ProviderError("Empty decode response", "nhtsa");
    return parseDecodedVin(v, row);
  });
}

export async function getRecalls(key: VehicleKey): Promise<Recall[]> {
  const k = normalizeVehicleKey(key);
  return cached(`nhtsa:recalls:${k.year}:${k.make}:${k.model}`, "nhtsa", NHTSA_TTL_MS, async () => {
    const json = await getJson<{ results?: Record<string, unknown>[] }>(`${API}/recalls/recallsByVehicle?make=${encodeURIComponent(k.make)}&model=${encodeURIComponent(k.model)}&modelYear=${k.year}`);
    return (json.results ?? []).map(parseRecall);
  });
}

export async function getComplaints(key: VehicleKey): Promise<Complaint[]> {
  const k = normalizeVehicleKey(key);
  return cached(`nhtsa:complaints:${k.year}:${k.make}:${k.model}`, "nhtsa", NHTSA_TTL_MS, async () => {
    const json = await getJson<{ results?: Record<string, unknown>[] }>(`${API}/complaints/complaintsByVehicle?make=${encodeURIComponent(k.make)}&model=${encodeURIComponent(k.model)}&modelYear=${k.year}`);
    return (json.results ?? []).map(parseComplaint);
  });
}

const reason = (e: unknown) => (e instanceof ProviderError ? e.message : e instanceof Error && e.name === "TimeoutError" ? "NHTSA did not answer in time" : "NHTSA is unreachable right now");

/** Recalls and complaints for a car; each half fails on its own so one outage never blanks the page. */
export async function getNhtsaBundle(key: VehicleKey | null): Promise<NhtsaBundle> {
  if (!key || !key.year || !key.make || !key.model) return { recalls: [], complaints: [], errors: { recalls: "Year, make and model are needed", complaints: "Year, make and model are needed" } };
  const [r, c] = await Promise.allSettled([getRecalls(key), getComplaints(key)]);
  return {
    recalls: r.status === "fulfilled" ? r.value : [],
    complaints: c.status === "fulfilled" ? c.value : [],
    errors: { ...(r.status === "rejected" ? { recalls: reason(r.reason) } : {}), ...(c.status === "rejected" ? { complaints: reason(c.reason) } : {}) },
  };
}
