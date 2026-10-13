import type { Metadata } from "next";
import { Garage, type GarageData } from "@/components/intel/garage";
import { listIntelVehicles, logLookup } from "@/lib/intel/data";
import { decodeVinFull, getNhtsaBundle } from "@/lib/intel/nhtsa";
import { decodeIsUsable } from "@/lib/intel/nhtsa-parse";
import { isVinShape, normalizeVin } from "@/lib/vin";

export const metadata: Metadata = { title: "Garage" };

/** Intel → Garage: the shop's cars (`?q=`), and a VIN lookup that saves nothing (`?vin=`). */
export default async function GaragePage(props: PageProps<"/intel/garage">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const vinRaw = typeof sp.vin === "string" ? normalizeVin(sp.vin) : "";
  const [vehicles, lookup] = await Promise.all([listIntelVehicles(q, 100), vinRaw ? lookupVin(vinRaw) : Promise.resolve(null)]);
  return <Garage data={{ q, vehicles, lookup }} />;
}

async function lookupVin(vin: string): Promise<GarageData["lookup"]> {
  if (!isVinShape(vin)) return { vin, decoded: null, nhtsa: null, error: "A VIN has 17 characters and never I, O or Q." };
  try {
    const decoded = await decodeVinFull(vin);
    if (!decodeIsUsable(decoded)) return { vin, decoded: null, nhtsa: null, error: decoded.errorText ?? "NHTSA could not decode this VIN." };
    const [nhtsa] = await Promise.all([getNhtsaBundle(decoded.year ? { year: decoded.year, make: decoded.make, model: decoded.model, engine: decoded.engine } : null), logLookup("vin", vin)]);
    return { vin, decoded, nhtsa };
  } catch {
    return { vin, decoded: null, nhtsa: null, error: "NHTSA is unreachable right now; try again in a moment." };
  }
}
