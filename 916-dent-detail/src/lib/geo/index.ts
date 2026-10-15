import { bookingConfig } from '@/config/booking';
import { travelFees } from '@/config/pricing';
import { isZipFormat, lookupZip } from './zips';

export { ZIP_TABLE, lookupZip, isZipFormat } from './zips';

export type AreaStatus = 'in_area' | 'out_of_area' | 'needs_review' | 'invalid';
export type AreaResult = {
  status: AreaStatus;
  zip: string;
  city?: string;
  miles?: number;
  travelFee: number | null;
  minutes?: number;
  message: string;
};

export function haversineMiles(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function feeForMiles(miles: number, fees = travelFees): number | null {
  if (miles <= fees.freeRadiusMiles) return 0;
  for (const t of fees.tiers) if (miles <= t.upToMiles) return t.fee;
  return null;
}

/** Straight-line miles between two ZIPs, or null if either is unknown. */
export function zipDistanceMiles(a: string, b: string): number | null {
  const za = lookupZip(a);
  const zb = lookupZip(b);
  if (!za || !zb) return null;
  return haversineMiles(za, zb);
}

/** Drive minutes between two ZIPs (distance x road factor / average speed); fallback when unknown. */
export function travelMinutes(a: string | null | undefined, b: string | null | undefined, cfg = bookingConfig.travel): number {
  if (!a || !b) return cfg.fallbackMin;
  if (a === b) return 5;
  const mi = zipDistanceMiles(a, b);
  if (mi === null) return cfg.fallbackMin;
  return Math.max(5, Math.round(((mi * cfg.roadFactor) / cfg.avgMph) * 60));
}

export function assessZip(rawZip: string, baseZip: string = bookingConfig.baseZip): AreaResult {
  const zip = String(rawZip ?? '').trim();
  if (!isZipFormat(zip)) return { status: 'invalid', zip, travelFee: null, message: 'Enter a 5-digit ZIP code.' };
  const info = lookupZip(zip);
  const base = lookupZip(baseZip);
  if (!info || !base) {
    // Never guess: an unknown ZIP goes to a human.
    return { status: 'needs_review', zip, travelFee: null, message: "We don't have that ZIP on our service map yet. Share your details and we'll confirm if we can reach you." };
  }
  const miles = Math.round(haversineMiles(base, info) * 10) / 10;
  const fee = feeForMiles(miles);
  const minutes = travelMinutes(baseZip, zip);
  if (fee === null) {
    return { status: 'out_of_area', zip, city: info.city, miles, travelFee: null, minutes, message: `${info.city} is outside our online booking area. Text us and we'll see what we can do.` };
  }
  return {
    status: 'in_area', zip, city: info.city, miles, travelFee: fee, minutes,
    message: fee === 0 ? `We come to ${info.city}. No travel fee.` : `We come to ${info.city}. A travel fee applies.`,
  };
}
