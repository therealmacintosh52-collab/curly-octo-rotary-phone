import "server-only";

import type { CodesScreenData } from "@/components/intel/codes-screen";
import { parseDtcList } from "./dtc";
import { getDtcDefinitions, getIntelVehicle, getRecentLookups, listIntelVehicles, logLookup, vehicleKeyOf, vehicleName } from "./data";
import { getNhtsaBundle } from "./nhtsa";

/** Everything the Codes screen needs for `?codes=&vehicle=` (shared by /intel and /intel/dtc). */
export async function loadCodesScreen(sp: { codes?: string | string[]; vehicle?: string | string[] }): Promise<CodesScreenData> {
  const codes = parseDtcList(typeof sp.codes === "string" ? sp.codes : "");
  const vehicleId = typeof sp.vehicle === "string" && /^[0-9a-f-]{36}$/i.test(sp.vehicle) ? sp.vehicle : null;
  const [vehicles, vehicle, definitions, recent] = await Promise.all([listIntelVehicles(undefined, 100), vehicleId ? getIntelVehicle(vehicleId) : Promise.resolve(null), getDtcDefinitions(codes), codes.length ? Promise.resolve([]) : getRecentLookups(8)]);
  const nhtsa = vehicle && codes.length ? await getNhtsaBundle(vehicleKeyOf(vehicle)) : null;
  if (codes.length) await logLookup("code", codes.join(" "));
  return {
    codes,
    definitions: Object.fromEntries(definitions),
    vehicles: vehicles.map((v) => ({ id: v.id, label: `${vehicleName(v)}${v.plate ? ` · ${v.plate}` : ""}${v.customer?.display_name ? ` · ${v.customer.display_name}` : ""}` })),
    vehicle: vehicle ? { id: vehicle.id, name: vehicleName(vehicle) } : null,
    nhtsa,
    recent,
  };
}
