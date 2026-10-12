import { z } from "zod";
import { isPhoneShape } from "./phone";

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => trimmed(max).optional().nullable();

export const customerSchema = z.object({
  id: z.uuid().optional(),
  first_name: trimmed(80).optional().default(""),
  last_name: trimmed(80).optional().default(""),
  phone: optionalText(40).refine((v) => !v || isPhoneShape(v), "That phone number does not look right"),
  email: optionalText(160).refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "That email does not look right"),
  address_line1: optionalText(120),
  address_line2: optionalText(120),
  city: optionalText(80),
  state: optionalText(2),
  postal_code: optionalText(10),
  source: z.enum(["walk_in", "online_booking", "referral", "phone", "social", "other"]).optional(),
  tags: z.array(trimmed(40)).max(30).optional(),
  marketing_opt_in: z.boolean().optional(),
  sms_opt_in: z.boolean().optional(),
  consent_source: optionalText(80),
  notes: optionalText(4000),
});
export type CustomerInput = z.input<typeof customerSchema>;

export const vehicleSchema = z.object({
  id: z.uuid().optional(),
  customer_id: z.uuid().optional(),
  vin: optionalText(17),
  year: z.coerce.number().int().min(1900).max(2100).optional().nullable(),
  make: optionalText(60),
  model: optionalText(80),
  trim: optionalText(80),
  body_class: optionalText(120),
  size_class: z.enum(["compact", "sedan", "suv_truck", "xl"]).optional(),
  color: optionalText(40),
  plate: optionalText(12),
  notes: optionalText(2000),
  odometer: z.coerce.number().int().positive().max(9_999_999).optional().nullable(),
  archived: z.boolean().optional(),
});
export type VehicleInput = z.input<typeof vehicleSchema>;
