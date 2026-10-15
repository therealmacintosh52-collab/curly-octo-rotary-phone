// Owner-editable booking settings. Stored in the `settings` table (id "booking"); anything not overridden falls back to
// config/booking.ts, and "reset" deletes the override. Effective values reach the engine through:
//  * primeSettings(): called by the booking service / availability API / loader; pushes duration overrides into
//    lib/pricing (computeDuration) and caches the engine overrides (30 s per server instance).
//  * engineOverrides(): Partial<AvailabilityConfig> for computeAvailability/checkSlot (buffers, caps, lead time, slot step).
import { z } from 'zod';
import { SERVICE_IDS, SIZE_CLASS_IDS, bookingConfig, dentMinutes, durations, multiServiceSavingsMin, type ServiceId, type SizeClass } from '@/config/booking';
import type { AvailabilityConfig } from '@/lib/availability/engine';
import { repo } from '@/lib/db';
import { setDurationOverrides } from '@/lib/pricing';
import { logEvent } from './events';

const int = (min: number, max: number) => z.number().int().min(min).max(max);

export const settingsSchema = z.object({
  bufferMin: int(0, 120).optional(),
  maxJobsPerTechPerDay: int(1, 12).optional(),
  minLeadHours: int(0, 168).optional(),
  slotStepMin: z.union([z.literal(15), z.literal(30), z.literal(60)]).optional(),
  multiServiceSavingsMin: int(0, 120).optional(),
  dentMinutes: z.object({ setup: int(0, 240).optional(), perPanel: int(5, 240).optional() }).optional(),
  durations: z.partialRecord(z.enum(SERVICE_IDS), z.partialRecord(z.enum(SIZE_CLASS_IDS), int(15, 720))).optional(),
}).strict();
export type SettingsOverride = z.infer<typeof settingsSchema>;

export type EffectiveSettings = {
  bufferMin: number; maxJobsPerTechPerDay: number; minLeadHours: number; slotStepMin: number; multiServiceSavingsMin: number;
  dentMinutes: { setup: number; perPanel: number };
  durations: Record<ServiceId, Record<SizeClass, number>>;
};

/** Pure merge: config defaults + overrides (unknown/invalid override keys are ignored by the schema upstream). */
export function mergeSettings(o: SettingsOverride | null): EffectiveSettings {
  const durs = {} as Record<ServiceId, Record<SizeClass, number>>;
  for (const s of SERVICE_IDS) durs[s] = { ...durations[s], ...(o?.durations?.[s] ?? {}) } as Record<SizeClass, number>;
  return {
    bufferMin: o?.bufferMin ?? bookingConfig.bufferMin,
    maxJobsPerTechPerDay: o?.maxJobsPerTechPerDay ?? bookingConfig.maxJobsPerTechPerDay,
    minLeadHours: o?.minLeadHours ?? bookingConfig.minLeadHours,
    slotStepMin: o?.slotStepMin ?? bookingConfig.slotStepMin,
    multiServiceSavingsMin: o?.multiServiceSavingsMin ?? multiServiceSavingsMin,
    dentMinutes: { setup: o?.dentMinutes?.setup ?? dentMinutes.setup, perPanel: o?.dentMinutes?.perPanel ?? dentMinutes.perPanel },
    durations: durs,
  };
}

const KEY = 'booking';
const G = globalThis as unknown as { __settingsCache?: { at: number; o: SettingsOverride | null } };
const TTL = 30_000;

export async function loadOverrides(): Promise<SettingsOverride | null> {
  const row = await repo().settings.get(KEY);
  if (!row) return null;
  const p = settingsSchema.safeParse(row.value);
  return p.success ? p.data : null; // a corrupt row must never break booking: fall back to config
}

export async function primeSettings(force = false): Promise<EffectiveSettings> {
  const c = G.__settingsCache;
  let o: SettingsOverride | null;
  if (!force && c && Date.now() - c.at < TTL) o = c.o;
  else { o = await loadOverrides(); G.__settingsCache = { at: Date.now(), o }; }
  const eff = mergeSettings(o);
  setDurationOverrides({ durations: eff.durations, dentMinutes: eff.dentMinutes, multiServiceSavingsMin: eff.multiServiceSavingsMin });
  return eff;
}

export async function engineOverrides(): Promise<Partial<AvailabilityConfig>> {
  const e = await primeSettings();
  return { bufferMin: e.bufferMin, maxJobsPerTechPerDay: e.maxJobsPerTechPerDay, minLeadHours: e.minLeadHours, slotStepMin: e.slotStepMin };
}

export async function saveSettings(patch: SettingsOverride, actor: string): Promise<EffectiveSettings> {
  const next = settingsSchema.parse(patch);
  const db = repo();
  const ex = await db.settings.get(KEY);
  if (ex) await db.settings.update(KEY, { value: next });
  else await db.settings.insert({ id: KEY, value: next });
  await logEvent('settings.updated', 'settings', KEY, actor, { keys: Object.keys(next) });
  return primeSettings(true);
}

export async function resetSettings(actor: string): Promise<EffectiveSettings> {
  await repo().settings.remove(KEY);
  await logEvent('settings.reset', 'settings', KEY, actor, {});
  return primeSettings(true);
}

/** Only keep keys that differ from config so "reset to config" stays meaningful and the override stays small. */
export function diffFromConfig(e: EffectiveSettings): SettingsOverride {
  const o: SettingsOverride = {};
  if (e.bufferMin !== bookingConfig.bufferMin) o.bufferMin = e.bufferMin;
  if (e.maxJobsPerTechPerDay !== bookingConfig.maxJobsPerTechPerDay) o.maxJobsPerTechPerDay = e.maxJobsPerTechPerDay;
  if (e.minLeadHours !== bookingConfig.minLeadHours) o.minLeadHours = e.minLeadHours;
  if (e.slotStepMin !== bookingConfig.slotStepMin && (e.slotStepMin === 15 || e.slotStepMin === 30 || e.slotStepMin === 60)) o.slotStepMin = e.slotStepMin;
  if (e.multiServiceSavingsMin !== multiServiceSavingsMin) o.multiServiceSavingsMin = e.multiServiceSavingsMin;
  if (e.dentMinutes.setup !== dentMinutes.setup || e.dentMinutes.perPanel !== dentMinutes.perPanel) o.dentMinutes = { ...e.dentMinutes };
  const d: NonNullable<SettingsOverride['durations']> = {};
  for (const s of SERVICE_IDS) for (const z of SIZE_CLASS_IDS) if (e.durations[s][z] !== durations[s][z]) (d[s] ??= {})[z] = e.durations[s][z];
  if (Object.keys(d).length) o.durations = d;
  return o;
}
