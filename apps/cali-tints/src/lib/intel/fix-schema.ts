import { z } from "zod";

const trimmed = (max: number) => z.string().trim().max(max);

export const fixTestSchema = z.object({ test: trimmed(300).min(1), result: trimmed(500).default("") });
export const fixPartSchema = z.object({
  name: trimmed(120).min(1),
  part_number: trimmed(60).nullable().default(null),
  brand: trimmed(60).nullable().default(null),
  quantity: z.coerce.number().positive().max(999).default(1),
  unit_price: z.coerce.number().min(0).max(100000).nullable().default(null),
});

/** One fix, as the form sends it. Mirrors the checks in save_fix (0046); the database has the last word. */
export const fixSchema = z.object({
  id: z.uuid().optional(),
  vehicle_id: z.uuid().nullable().default(null),
  job_id: z.uuid().nullable().default(null),
  title: trimmed(140).min(8, "Give the fix a descriptive title"),
  year: z.coerce.number().int().min(1949, "Year, like 2019").max(2100, "Year, like 2019"),
  make: trimmed(60).min(1, "Make"),
  model: trimmed(80).min(1, "Model"),
  engine: trimmed(80).nullable().default(null),
  mileage: z.coerce.number().int().min(0).max(2_000_000).nullable().default(null),
  symptoms: trimmed(4000).min(10, "Describe the symptoms"),
  codes: z.array(z.string().regex(/^[PBCU][0-9A-F]{4}$/, "Trouble codes look like P0300")).max(20).default([]),
  freeze_frame_notes: trimmed(2000).nullable().default(null),
  tests: z.array(fixTestSchema).max(30).default([]),
  root_cause: trimmed(2000).min(5, "State the root cause"),
  fix_description: trimmed(6000).min(10, "Describe the fix"),
  labor_hours: z.coerce.number().min(0).max(200).nullable().default(null),
  parts: z.array(fixPartSchema).max(40).default([]),
  change_note: trimmed(300).nullable().default(null),
});
export type FixInput = z.input<typeof fixSchema>;
export type FixParsed = z.output<typeof fixSchema>;
