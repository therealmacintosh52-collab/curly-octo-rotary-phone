// Travel-fee sentence for city pages, derived from config. While prices are placeholders
// (PRICES_ARE_PLACEHOLDERS) no number is shown: the page says the booking flow shows the fee.
import { travelFees, PRICES_ARE_PLACEHOLDERS } from '@/config/pricing';
import { site } from '@/config/site';
import type { CityDoc } from '@/content/seo/types';

export function travelNote(city: CityDoc): string {
  const base = `We start from ZIP ${site.baseZip}. Travel fees depend on distance from there, and the booking flow shows the fee for your ZIP before you pay anything.`;
  if (PRICES_ARE_PLACEHOLDERS) return base;
  const free = travelFees.freeRadiusMiles;
  const max = travelFees.maxServiceMiles;
  const distance =
    city.distance === 'home-base' || city.distance === 'near'
      ? `Many addresses in ${city.name} fall inside or close to the ${free}-mile no-fee radius.`
      : `Addresses in ${city.name} may fall outside the ${free}-mile no-fee radius, within our ${max}-mile online booking range.`;
  return `${base} ${distance}`;
}
