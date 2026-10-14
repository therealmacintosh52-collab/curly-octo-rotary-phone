import { z } from "zod";

const serviceLine = z.object({
  service_id: z.uuid(),
  price: z.number().min(0),
  override_reason: z.string().trim().max(500).nullable().optional(),
  label: z.string().trim().max(120).nullable().optional(),
});

/** Everything about a car that can be edited after it was logged (update_job / edit_invoice_car). */
export const updateJobSchema = z.object({
  id: z.uuid(),
  dealership_id: z.uuid().optional(),
  detailer_id: z.uuid().optional(),
  tag_number: z.string().trim().min(1).max(32),
  vin: z.string().trim().toUpperCase().regex(/^[A-HJ-NPR-Z0-9]{17}$/).nullable(),
  year: z.number({ error: "Year is required" }).int().min(1900).max(2100),
  make: z.string({ error: "Make is required" }).trim().min(1, "Make is required").max(60),
  model: z.string({ error: "Model is required" }).trim().min(1, "Model is required").max(80),
  color: z.string({ error: "Color is required" }).trim().min(1, "Color is required").max(40),
  performed_at: z.string().datetime({ offset: true }),
  ro_po_number: z.string().trim().max(40).nullable(),
  notes: z.string().trim().max(2000).nullable(),
  /** Left out for a retail repair order: its lines change through an estimate (0052). */
  services: z.array(serviceLine).min(1).optional(),
});
export type UpdateJobInput = z.input<typeof updateJobSchema>;
