// Tech route helpers (pure): drive minutes between consecutive stops.
import { travelMinutes } from '@/lib/geo';

/** legs[i] = minutes from the previous stop's ZIP (or `homeZip` for the first stop); null when the origin is unknown. */
export function routeLegs(zips: (string | null | undefined)[], homeZip: string | null | undefined): (number | null)[] {
  let prev: string | null | undefined = homeZip;
  return zips.map((z) => { const leg = prev ? travelMinutes(prev, z) : null; prev = z ?? prev; return leg; });
}
