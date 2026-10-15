// zod schemas for the booking API. Shared by routes and (types only) the UI.
import { z } from 'zod';
import { PHOTO_PATH_RE } from './photos-path';

const short = (n: number) => z.string().trim().max(n);
const opt = (n = 200) => z.string().trim().max(n).optional();

export const attributionSchema = z.object({
  utm_source: opt(), utm_medium: opt(), utm_campaign: opt(), utm_term: opt(), utm_content: opt(),
  gclid: opt(), fbclid: opt(), ref: opt(), referrer: opt(), landing_page: opt(),
}).partial();

export const vehicleSchema = z.object({
  year: z.number().int().min(1950).max(new Date().getFullYear() + 2),
  make: short(40).min(1), model: short(40).min(1), color: opt(30),
});

export const photoPath = z.string().regex(PHOTO_PATH_RE);

export const zipSchema = z.string().trim().regex(/^\d{5}$/, 'Enter a 5-digit ZIP');
export const isoInstant = z.iso.datetime({ offset: true });

export const createBookingSchema = z.object({
  services: z.array(short(40)).min(1).max(6),
  addons: z.array(short(40)).max(6).default([]),
  sizeClass: short(20),
  vehicle: vehicleSchema,
  photoPaths: z.array(photoPath).max(6).default([]),
  quoteId: z.string().uuid().optional(),
  zip: zipSchema,
  startsAt: isoInstant,
  techId: z.string().max(64).optional(),
  contact: z.object({
    name: short(80).min(2),
    phone: short(30).min(7),
    email: z.email().max(120),
    addressLine: short(120).min(4),
    notes: opt(500),
    smsConsent: z.boolean(),
    /** honeypot: real users never fill this */
    website: z.string().max(0).optional(),
  }),
  attribution: attributionSchema.optional(),
  firstTouch: attributionSchema.optional(),
});
export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const availabilityQuerySchema = z.object({
  services: z.array(short(40)).min(1).max(6),
  addons: z.array(short(40)).max(6).default([]),
  sizeClass: short(20),
  zip: zipSchema,
  panels: z.number().int().min(1).max(30).optional(),
  fromDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  days: z.number().int().min(1).max(30).optional(),
  excludeBookingId: z.string().max(64).optional(),
});
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export const quoteRequestSchema = z.object({
  services: z.array(short(40)).min(1).max(6),
  addons: z.array(short(40)).max(6).default([]),
  sizeClass: short(20),
  vehicle: vehicleSchema.partial().optional(),
  photoPaths: z.array(photoPath).max(6).default([]),
  zip: z.string().trim().regex(/^\d{5}$/).optional(),
});

export const tokenActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('reschedule'), startsAt: isoInstant, techId: z.string().max(64).optional() }),
  z.object({ action: z.literal('cancel'), reason: opt(200) }),
  z.object({ action: z.literal('confirm-payment') }),
  z.object({ action: z.literal('mock-pay') }),
  z.object({ action: z.literal('release') }),
]);

export const leadSchema = z.object({
  name: short(80).min(2), phone: short(30).optional(), email: z.email().max(120).optional(),
  zip: zipSchema, services: z.array(short(40)).max(6).default([]), notes: opt(500),
  smsConsent: z.boolean().default(false), website: z.string().max(0).optional(),
  attribution: attributionSchema.optional(),
}).refine((v) => v.phone || v.email, { message: 'Phone or email required' });
