import "server-only";
import { NHTSA_CACHE_TTL_MS } from "@/lib/config";
import { cached } from "./cache";
import { ProviderError, type Complaint, type DecodedVehicle, type Recall, type VehicleDataProvider, type VehicleKey } from "./types";
import { normalizeVehicleKey, parseComplaint, parseDecodedVin, parseRecall } from "./nhtsa-parse";

const VPIC = "https://vpic.nhtsa.dot.gov/api/vehicles";
const API = "https://api.nhtsa.gov";

async function getJson<T>(url: string, provider = "nhtsa"): Promise<T> {
  const res = await fetch(url, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new ProviderError(`NHTSA request failed (${res.status})`, provider, res.status);
  return (await res.json()) as T;
}

/** NHTSA vPIC + recalls + complaints. Free, public, no key. Cached 24h in provider_cache. */
export const nhtsaProvider: VehicleDataProvider = {
  name: "NHTSA",
  source: "NHTSA",

  async decodeVin(vin: string): Promise<DecodedVehicle> {
    const v = vin.toUpperCase();
    return cached(`nhtsa:vin:${v}`, "nhtsa", NHTSA_CACHE_TTL_MS, async () => {
      const json = await getJson<{ Results: Record<string, string>[] }>(`${VPIC}/DecodeVinValues/${encodeURIComponent(v)}?format=json`);
      const row = json.Results?.[0];
      if (!row) throw new ProviderError("Empty decode response", "nhtsa");
      return parseDecodedVin(v, row);
    });
  },

  async getRecalls(key: VehicleKey): Promise<Recall[]> {
    const k = normalizeVehicleKey(key);
    return cached(`nhtsa:recalls:${k.year}:${k.make}:${k.model}`, "nhtsa", NHTSA_CACHE_TTL_MS, async () => {
      const url = `${API}/recalls/recallsByVehicle?make=${encodeURIComponent(k.make)}&model=${encodeURIComponent(k.model)}&modelYear=${k.year}`;
      const json = await getJson<{ results?: Record<string, unknown>[] }>(url);
      return (json.results ?? []).map(parseRecall);
    });
  },

  async getComplaints(key: VehicleKey): Promise<Complaint[]> {
    const k = normalizeVehicleKey(key);
    return cached(`nhtsa:complaints:${k.year}:${k.make}:${k.model}`, "nhtsa", NHTSA_CACHE_TTL_MS, async () => {
      const url = `${API}/complaints/complaintsByVehicle?make=${encodeURIComponent(k.make)}&model=${encodeURIComponent(k.model)}&modelYear=${k.year}`;
      const json = await getJson<{ results?: Record<string, unknown>[] }>(url);
      return (json.results ?? []).map(parseComplaint);
    });
  },

  async getMakes(year: number): Promise<string[]> {
    return cached(`nhtsa:makes:${year}`, "nhtsa", NHTSA_CACHE_TTL_MS * 7, async () => {
      // Passenger cars + trucks + MPVs cover what a shop sees.
      const types = ["passenger car", "truck", "multipurpose passenger vehicle", "motorcycle"];
      const sets = await Promise.all(
        types.map((t) =>
          getJson<{ Results: { MakeName: string }[] }>(`${VPIC}/GetMakesForVehicleType/${encodeURIComponent(t)}?format=json`).catch(() => ({ Results: [] })),
        ),
      );
      const names = new Set<string>();
      for (const s of sets) for (const r of s.Results ?? []) names.add(r.MakeName.trim());
      return [...names].sort((a, b) => a.localeCompare(b));
    });
  },

  async getModels(year: number, make: string): Promise<string[]> {
    const m = make.trim().toLowerCase();
    return cached(`nhtsa:models:${year}:${m}`, "nhtsa", NHTSA_CACHE_TTL_MS * 7, async () => {
      const json = await getJson<{ Results: { Model_Name: string }[] }>(
        `${VPIC}/GetModelsForMakeYear/make/${encodeURIComponent(m)}/modelyear/${year}?format=json`,
      );
      const names = new Set((json.Results ?? []).map((r) => r.Model_Name.trim()).filter(Boolean));
      return [...names].sort((a, b) => a.localeCompare(b));
    });
  },
};
