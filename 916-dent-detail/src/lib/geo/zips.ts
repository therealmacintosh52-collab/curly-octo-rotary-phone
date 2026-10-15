// ZIP centroids (approximate, +/- 1-2 miles) for the 14 target cities and the surrounding Sacramento region.
// Used only for radius-based travel fees and rough drive-time buffers. A ZIP that is not in this table is NEVER
// guessed: it is reported as "needs_review" (see assessZip).
export type ZipInfo = { lat: number; lng: number; city: string };

const z = (lat: number, lng: number, city: string): ZipInfo => ({ lat, lng, city });

export const ZIP_TABLE: Record<string, ZipInfo> = {
  // Sacramento
  '95811': z(38.5835, -121.4800, 'Sacramento'), '95814': z(38.5816, -121.4944, 'Sacramento'), '95815': z(38.6050, -121.4430, 'Sacramento'),
  '95816': z(38.5700, -121.4690, 'Sacramento'), '95817': z(38.5470, -121.4580, 'Sacramento'), '95818': z(38.5500, -121.4960, 'Sacramento'),
  '95819': z(38.5700, -121.4450, 'Sacramento'), '95820': z(38.5330, -121.4380, 'Sacramento'), '95821': z(38.6240, -121.3820, 'Sacramento'),
  '95822': z(38.5190, -121.4960, 'Sacramento'), '95823': z(38.4700, -121.4410, 'Sacramento'), '95824': z(38.5170, -121.4430, 'Sacramento'),
  '95825': z(38.5880, -121.4040, 'Sacramento'), '95826': z(38.5530, -121.3830, 'Sacramento'), '95827': z(38.5580, -121.3260, 'Sacramento'),
  '95828': z(38.4810, -121.3980, 'Sacramento'), '95829': z(38.4800, -121.3250, 'Sacramento'), '95831': z(38.4900, -121.5340, 'Sacramento'),
  '95832': z(38.4420, -121.4960, 'Sacramento'), '95838': z(38.6430, -121.4440, 'Sacramento'), '95841': z(38.6650, -121.3500, 'Citrus Heights'),
  '95864': z(38.5860, -121.3780, 'Sacramento'),
  // Natomas
  '95833': z(38.6260, -121.5200, 'Natomas'), '95834': z(38.6360, -121.5000, 'Natomas'), '95835': z(38.6760, -121.5100, 'Natomas'),
  // Elk Grove (95624 = base)
  '95624': z(38.4170, -121.3560, 'Elk Grove'), '95757': z(38.3790, -121.4310, 'Elk Grove'), '95758': z(38.4160, -121.4400, 'Elk Grove'),
  '95693': z(38.4130, -121.2430, 'Wilton'),
  // Roseville / Granite Bay / Rocklin / Lincoln / Loomis
  '95661': z(38.7440, -121.2560, 'Roseville'), '95678': z(38.7520, -121.3000, 'Roseville'), '95747': z(38.7870, -121.3420, 'Roseville'),
  '95746': z(38.7560, -121.2080, 'Granite Bay'),
  '95677': z(38.7940, -121.2380, 'Rocklin'), '95765': z(38.8140, -121.2700, 'Rocklin'),
  '95648': z(38.8910, -121.2930, 'Lincoln'), '95650': z(38.8200, -121.1900, 'Loomis'),
  // Folsom / El Dorado Hills
  '95630': z(38.6700, -121.1520, 'Folsom'), '95762': z(38.6850, -121.0710, 'El Dorado Hills'),
  // Rancho Cordova / Gold River
  '95670': z(38.5900, -121.2800, 'Rancho Cordova'), '95742': z(38.5740, -121.2090, 'Rancho Cordova'), '95683': z(38.4350, -121.1450, 'Sloughhouse'),
  // Citrus Heights / Carmichael / Fair Oaks / Orangevale / Antelope / North Highlands / Rio Linda
  '95610': z(38.6930, -121.2750, 'Citrus Heights'), '95621': z(38.6900, -121.3170, 'Citrus Heights'),
  '95608': z(38.6260, -121.3300, 'Carmichael'), '95628': z(38.6490, -121.2720, 'Fair Oaks'), '95662': z(38.6770, -121.2250, 'Orangevale'),
  '95842': z(38.6840, -121.3500, 'Sacramento'), '95843': z(38.7160, -121.3600, 'Antelope'),
  '95660': z(38.6910, -121.3720, 'North Highlands'), '95673': z(38.6900, -121.4500, 'Rio Linda'), '95626': z(38.7240, -121.4600, 'Elverta'),
  // West Sacramento / Davis / Woodland
  '95605': z(38.6250, -121.5400, 'West Sacramento'), '95691': z(38.5800, -121.5420, 'West Sacramento'),
  '95616': z(38.5450, -121.7400, 'Davis'), '95618': z(38.5500, -121.7000, 'Davis'), '95695': z(38.6790, -121.7600, 'Woodland'),
  // South
  '95632': z(38.2530, -121.3000, 'Galt'),
};

export const isZipFormat = (zip: string): boolean => /^\d{5}$/.test(zip);
export const lookupZip = (zip: string): ZipInfo | null => ZIP_TABLE[zip] ?? null;
