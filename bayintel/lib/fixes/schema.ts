import { z } from "zod";

export const TestSchema = z.object({ test: z.string().trim().min(1).max(300), result: z.string().trim().max(500).default("") });
export const PartSchema = z.object({
  name: z.string().trim().min(1).max(120),
  part_number: z.string().trim().max(60).nullable().default(null),
  brand: z.string().trim().max(60).nullable().default(null),
  quantity: z.coerce.number().positive().max(999).default(1),
  unit_price: z.coerce.number().min(0).max(100000).nullable().default(null),
});

export const FixInputSchema = z.object({
  vehicle_id: z.string().uuid().nullable().default(null),
  repair_order_id: z.string().uuid().nullable().default(null),
  title: z.string().trim().min(8, "Give the fix a descriptive title").max(140),
  year: z.coerce.number().int().min(1949).max(2100),
  make: z.string().trim().min(1).max(60),
  model: z.string().trim().min(1).max(80),
  engine: z.string().trim().max(80).nullable().default(null),
  mileage: z.coerce.number().int().min(0).max(2000000).nullable().default(null),
  symptoms: z.string().trim().min(10, "Describe the symptoms").max(4000),
  codes: z.array(z.string().regex(/^[PBCU][0-9A-F]{4}$/)).max(20).default([]),
  freeze_frame_notes: z.string().trim().max(2000).nullable().default(null),
  tests_performed: z.array(TestSchema).max(30).default([]),
  root_cause: z.string().trim().min(5, "State the root cause").max(2000),
  fix_description: z.string().trim().min(10, "Describe the fix").max(6000),
  parts: z.array(PartSchema).max(40).default([]),
  labor_hours: z.coerce.number().min(0).max(200).nullable().default(null),
  media: z.array(z.object({ storage_path: z.string().min(1), caption: z.string().max(200).nullable().default(null) })).max(12).default([]),
  change_note: z.string().trim().max(300).nullable().default(null),
});
export type FixInput = z.input<typeof FixInputSchema>;
export type FixInputParsed = z.output<typeof FixInputSchema>;
