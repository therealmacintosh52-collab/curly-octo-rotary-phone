// Pure pricing + duration logic. All numbers come from src/config/pricing.ts and src/config/booking.ts.
import {
  ADDON_IDS, SERVICE_IDS, SIZE_CLASS_IDS, addonDefs, bookingConfig, dentMinutes, durations, isDentService,
  multiServiceSavingsMin, serviceById, type AddonId, type ServiceId, type SizeClass,
} from '@/config/booking';
import { ESTIMATE_LABEL, addonPrices, depositAmount, dentPricing, detailSpread, fixedPrices } from '@/config/pricing';

export type PriceLine = { id: string; label: string; low: number; high: number };
export type PriceInput = {
  services: string[];
  sizeClass: string;
  addons?: string[];
  /** Photo-quote range for the dent services on this visit (already clamped by lib/quote). */
  dentQuote?: { low: number; high: number } | null;
  /** Travel fee from assessZip; null = unknown / not bookable. */
  travelFee?: number | null;
};
export type PriceResult =
  | { ok: false; error: string }
  | {
      ok: true;
      /** needs_photos: a dent service is selected and no quote exists, so there is no price yet. */
      status: 'priced' | 'needs_photos';
      lines: PriceLine[];
      low: number | null;
      high: number | null;
      travelFee: number;
      totalLow: number | null;
      totalHigh: number | null;
      deposit: number;
      label: string;
    };

export const isServiceId = (s: string): s is ServiceId => (SERVICE_IDS as readonly string[]).includes(s);
export const isSizeClass = (s: string): s is SizeClass => (SIZE_CLASS_IDS as readonly string[]).includes(s);
export const isAddonId = (s: string): s is AddonId => (ADDON_IDS as readonly string[]).includes(s);

export const roundTo = (n: number, step: number): number => Math.round(n / step) * step;

export function validateSelection(services: string[], sizeClass: string, addons: string[] = []):
  { ok: true; services: ServiceId[]; sizeClass: SizeClass; addons: AddonId[] } | { ok: false; error: string } {
  const uniq = [...new Set(services)];
  if (uniq.length === 0) return { ok: false, error: 'Choose at least one service.' };
  if (!uniq.every(isServiceId)) return { ok: false, error: 'Unknown service.' };
  if (!isSizeClass(sizeClass)) return { ok: false, error: 'Unknown vehicle size.' };
  const ad = [...new Set(addons)];
  if (!ad.every(isAddonId)) return { ok: false, error: 'Unknown add-on.' };
  for (const a of ad) {
    const def = addonDefs.find((d) => d.id === a)!;
    if (!uniq.some((s) => def.appliesTo.includes(s as ServiceId))) return { ok: false, error: `Add-on "${def.label}" does not apply to the selected services.` };
  }
  return { ok: true, services: uniq as ServiceId[], sizeClass, addons: ad as AddonId[] };
}

export const requiresPhotos = (services: string[]): boolean => services.some((s) => serviceById(s)?.requiresPhotos);
export const hasDent = (services: string[]): boolean => services.some(isDentService);

/** Per-panel dent range for one panel of this size class, hail-adjusted. */
export function dentPerPanel(sizeClass: SizeClass, hail: boolean): { low: number; high: number } {
  const base = dentPricing.perPanel[sizeClass];
  const m = hail ? dentPricing.hailMultiplier : 1;
  return { low: roundTo(base.low * m, dentPricing.roundTo), high: roundTo(base.high * m, dentPricing.roundTo) };
}

export function computePrice(input: PriceInput): PriceResult {
  const v = validateSelection(input.services, input.sizeClass, input.addons);
  if (!v.ok) return v;
  const lines: PriceLine[] = [];
  let needsPhotos = false;
  let dentLow = 0, dentHigh = 0;

  const dents = v.services.filter(isDentService);
  if (dents.length) {
    if (input.dentQuote) {
      dentLow = input.dentQuote.low; dentHigh = input.dentQuote.high;
      const label = dents.map((d) => serviceById(d)!.plain).join(' + ');
      lines.push({ id: dents.join('+'), label, low: dentLow, high: dentHigh });
    } else needsPhotos = true;
  }
  for (const s of v.services) {
    if (isDentService(s)) continue;
    const base = fixedPrices[s]?.[v.sizeClass];
    if (base === undefined) return { ok: false, error: `No price configured for ${s}.` };
    lines.push({ id: s, label: serviceById(s)!.plain, low: base, high: Math.round(base * (1 + detailSpread)) });
  }
  for (const a of v.addons) {
    const p = addonPrices[a];
    lines.push({ id: a, label: addonDefs.find((d) => d.id === a)!.label, low: p, high: p });
  }
  const travelFee = input.travelFee ?? 0;
  const priced = !needsPhotos;
  const low = priced ? lines.reduce((s, l) => s + l.low, 0) : null;
  const high = priced ? lines.reduce((s, l) => s + l.high, 0) : null;
  return {
    ok: true,
    status: priced ? 'priced' : 'needs_photos',
    lines,
    low,
    high,
    travelFee,
    totalLow: low === null ? null : low + travelFee,
    totalHigh: high === null ? null : high + travelFee,
    deposit: depositAmount,
    label: ESTIMATE_LABEL,
  };
}

/**
 * P3: owner overrides from /admin (settings table), pushed in by lib/admin/settings.primeSettings(). Absent keys fall back to
 * config/booking.ts, so with no overrides behaviour is unchanged.
 */
export type DurationOverrides = {
  durations?: Partial<Record<ServiceId, Partial<Record<SizeClass, number>>>>;
  dentMinutes?: Partial<typeof dentMinutes>;
  multiServiceSavingsMin?: number;
};
let overrides: DurationOverrides = {};
export const setDurationOverrides = (o: DurationOverrides): void => { overrides = o; };

/** Appointment length in minutes (rounded up to the configured step). `panels` = photo-quote panel count for dent work. */
export function computeDuration(input: { services: string[]; sizeClass: string; addons?: string[]; panels?: number | null }): number {
  const v = validateSelection(input.services, input.sizeClass, input.addons ?? []);
  if (!v.ok) throw new Error(v.error);
  let total = 0;
  for (const s of v.services) {
    if (isDentService(s) && input.panels && input.panels > 0) {
      const panels = Math.min(input.panels, dentPricing.maxPanels);
      total += (overrides.dentMinutes?.setup ?? dentMinutes.setup) + (overrides.dentMinutes?.perPanel ?? dentMinutes.perPanel) * panels * (s === 'hail' ? 1.5 : 1);
    } else total += overrides.durations?.[s]?.[v.sizeClass] ?? durations[s][v.sizeClass];
  }
  total -= (overrides.multiServiceSavingsMin ?? multiServiceSavingsMin) * (v.services.length - 1);
  for (const a of v.addons) total += addonDefs.find((d) => d.id === a)!.minutes;
  const step = bookingConfig.roundDurationToMin;
  return Math.ceil(Math.max(total, step) / step) * step;
}

export function formatRange(low: number, high: number): string {
  return low === high ? `$${low.toLocaleString('en-US')}` : `$${low.toLocaleString('en-US')} – $${high.toLocaleString('en-US')}`;
}
