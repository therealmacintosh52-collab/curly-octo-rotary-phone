// zod schemas for the dealer API (shared by routes; UI imports types only).
import { z } from 'zod';
import { attributionSchema } from '@/lib/booking/schema';

const s = (min: number, max: number) => z.string().trim().min(min).max(max);
const phone = z.string().trim().max(30).optional().or(z.literal(''));

export const signupSchema = z.object({
  businessName: s(2, 120),
  licenseNumber: z.string().trim().max(40).optional(), // optional by design: not every lot / fleet has a dealer license
  contactName: s(2, 80),
  email: z.email().max(120),
  phone,
  lotAddresses: z.array(s(5, 160)).min(1, 'Add at least one lot address').max(5),
  apEmail: z.email().max(120),
  expectedMonthlyVolume: z.number().int().min(0).max(5000).optional(),
  netTermsRequested: z.boolean().default(false),
  password: z.string().max(128).optional(),
  attribution: attributionSchema.optional(),
  /** honeypot: real people never fill this */
  website: z.string().max(0).optional(),
});
export type SignupBody = z.infer<typeof signupSchema>;

export const signinSchema = z.object({ email: z.email().max(120), password: z.string().max(128).optional() });

export const sheetRequestSchema = z.object({
  name: s(2, 80), company: s(2, 120), email: z.email().max(120), phone,
  message: z.string().trim().max(500).optional(),
  attribution: attributionSchema.optional(),
  website: z.string().max(0).optional(),
});

/** Single-vehicle form: converted to one CSV-style row so single and bulk share one validator. */
export const singleVehicleSchema = z.object({
  vin: s(1, 40), stockNumber: z.string().trim().max(40).optional(), year: z.string().trim().max(4).optional(),
  make: z.string().trim().max(40).optional(), model: z.string().trim().max(60).optional(), color: z.string().trim().max(30).optional(),
  panels: z.string().trim().max(3).optional(), services: z.array(z.string().max(40)).max(8).default([]), notes: z.string().trim().max(500).optional(),
});

export const submitSchema = z.union([
  z.object({ csv: z.string().max(260_000), dryRun: z.boolean().optional() }),
  z.object({ vehicle: singleVehicleSchema, dryRun: z.boolean().optional() }),
]);

export const decideSchema = z.object({ decision: z.enum(['approved', 'declined']), reason: z.string().trim().max(300).optional() });
export const cancelSchema = z.object({ action: z.literal('cancel') });
