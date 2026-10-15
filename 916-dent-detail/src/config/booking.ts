// Operational booking config. Everything the owner may want to tune lives here (or in pricing.ts).
// Values marked [OWNER] are placeholders until the owners confirm them. No dollar amounts here: see pricing.ts.
import { services as marketingServices } from '@/content/home';
import { site } from '@/config/site';

export const TIMEZONE = 'America/Los_Angeles';

export const SIZE_CLASS_IDS = ['compact', 'sedan', 'suv', 'truck', 'xl'] as const;
export type SizeClass = (typeof SIZE_CLASS_IDS)[number];

export const sizeClasses: { id: SizeClass; label: string; examples: string }[] = [
  { id: 'compact', label: 'Compact', examples: 'Civic, Corolla, Mini, Fit' },
  { id: 'sedan', label: 'Sedan / Coupe', examples: 'Camry, Accord, Model 3, Mustang' },
  { id: 'suv', label: 'SUV / Crossover', examples: 'RAV4, CR-V, Model Y, Explorer' },
  { id: 'truck', label: 'Truck / Large SUV', examples: 'F-150, Tacoma, Tahoe, 4Runner' },
  { id: 'xl', label: 'Extra large', examples: 'Suburban, Sprinter, F-250+, 3-row vans' },
];

export const SERVICE_IDS = ['pdr', 'hail', 'paint-correction', 'ceramic', 'decon', 'interior'] as const;
export type ServiceId = (typeof SERVICE_IDS)[number];

export type ServiceDef = {
  id: ServiceId;
  plain: string;
  term: string;
  summary: string;
  /** Dent work: no fixed price without photos; photos are required to book. */
  dent: boolean;
  requiresPhotos: boolean;
  /** Exterior work is blocked on weather-flagged days. */
  exterior: boolean;
};

const DENT: ServiceId[] = ['pdr', 'hail'];
const INTERIOR_ONLY: ServiceId[] = ['interior'];

export const bookingServices: ServiceDef[] = SERVICE_IDS.map((id) => {
  const m = marketingServices.find((s) => s.id === id);
  return {
    id,
    plain: m?.plain ?? id,
    term: m?.term ?? id,
    summary: m?.summary ?? '',
    dent: DENT.includes(id),
    requiresPhotos: DENT.includes(id),
    exterior: !INTERIOR_ONLY.includes(id),
  };
});

export const serviceById = (id: string): ServiceDef | undefined => bookingServices.find((s) => s.id === id);
export const isDentService = (id: string): boolean => serviceById(id)?.dent === true;

export const ADDON_IDS = ['headlights', 'pet-hair', 'engine-bay', 'odor'] as const;
export type AddonId = (typeof ADDON_IDS)[number];
export const addonDefs: { id: AddonId; label: string; blurb: string; appliesTo: ServiceId[]; minutes: number }[] = [
  { id: 'headlights', label: 'Headlight restoration', blurb: 'Clear up yellow, foggy headlights.', appliesTo: ['paint-correction', 'ceramic', 'decon', 'interior'], minutes: 45 },
  { id: 'pet-hair', label: 'Heavy pet-hair removal', blurb: 'Extra time to lift embedded hair.', appliesTo: ['interior'], minutes: 40 },
  { id: 'engine-bay', label: 'Engine bay clean', blurb: 'Degrease and dress the engine bay.', appliesTo: ['interior', 'decon', 'paint-correction', 'ceramic'], minutes: 30 },
  { id: 'odor', label: 'Odor treatment', blurb: 'Neutralise smoke, food or pet odors.', appliesTo: ['interior'], minutes: 30 },
];

// [OWNER] Job duration in minutes by service and vehicle size. Dent work uses these only when the photo quote
// returns no panel count; otherwise dentMinutes below applies.
export const durations: Record<ServiceId, Record<SizeClass, number>> = {
  pdr: { compact: 90, sedan: 105, suv: 120, truck: 135, xl: 150 },
  hail: { compact: 240, sedan: 270, suv: 300, truck: 330, xl: 360 },
  'paint-correction': { compact: 240, sedan: 270, suv: 300, truck: 330, xl: 360 },
  ceramic: { compact: 300, sedan: 330, suv: 360, truck: 390, xl: 420 },
  decon: { compact: 60, sedan: 75, suv: 90, truck: 105, xl: 120 },
  interior: { compact: 120, sedan: 135, suv: 150, truck: 165, xl: 180 },
};
// [OWNER] When the photo quote counts panels: setup + minutes per panel.
export const dentMinutes = { setup: 30, perPanel: 45 };
/** Each additional service on the same visit saves this many setup minutes. */
export const multiServiceSavingsMin = 15;

export const bookingConfig = {
  baseZip: process.env.BASE_ZIP || site.baseZip,
  timezone: TIMEZONE,
  slotStepMin: 30,
  roundDurationToMin: 15,
  minLeadHours: 12,
  horizonDays: 21,
  /** A slot is held for this long while the customer pays the deposit. */
  holdMinutes: 15,
  /** Setup / cleanup / parking buffer between two jobs, on top of drive time. */
  bufferMin: 20,
  maxJobsPerTechPerDay: 4,
  travel: { avgMph: 28, roadFactor: 1.3, fallbackMin: 30 },
  /** Default weekly hours (local minutes) used by the mock store. Real hours live in tech_availability. */
  defaultWeekly: {
    0: [] as { start: number; end: number }[],
    1: [{ start: 8 * 60, end: 17 * 60 }],
    2: [{ start: 8 * 60, end: 17 * 60 }],
    3: [{ start: 8 * 60, end: 17 * 60 }],
    4: [{ start: 8 * 60, end: 17 * 60 }],
    5: [{ start: 8 * 60, end: 17 * 60 }],
    6: [{ start: 8 * 60, end: 15 * 60 }],
  } as Record<number, { start: number; end: number }[]>,
  photos: { minForDents: 2, max: 6, maxEdgePx: 1600, jpegQuality: 0.82, maxBytes: 3_000_000 },
  quote: { model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5', maxTokens: 1200 },
};

/** Deposit and change policy. Hours are measured from "now" to the appointment start. */
export const depositPolicy = {
  // Cancellation, most generous window first.
  cancel: [
    { minHoursBefore: 48, outcome: 'refund' as const },
    { minHoursBefore: 24, outcome: 'credit' as const },
    { minHoursBefore: 0, outcome: 'forfeit' as const },
  ],
  /** Reschedule is free when at least this many hours ahead. */
  rescheduleFreeHours: 24,
  /** Inside this many hours online changes are closed (call or text). */
  changeCutoffHours: 4,
  maxReschedules: 2,
  creditValidDays: 90,
};

export const notifyConfig = {
  reminderHours: [24, 2] as const,
  reviewDelayHours: 2,
  rebookMonths: 6,
  rebookSendHourLocal: 10,
  /** No texts between these local hours (except confirmation / on-the-way / STOP-HELP replies). */
  quiet: { startHour: 21, endHour: 8 },
  maxAttempts: 3,
  retryDelayMin: 10,
};

export const SMS_CONSENT_TEXT =
  `I agree to receive text messages from ${site.name} about my appointment (confirmation, reminders, on-the-way alerts, receipt and review request) and occasional service reminders. Message frequency varies. Message and data rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of purchase.`;
