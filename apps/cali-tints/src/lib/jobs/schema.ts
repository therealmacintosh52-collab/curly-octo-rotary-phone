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
  year: z.number().int().min(1900).max(2100).nullable(),
  make: z.string().trim().max(60).nullable(),
  model: z.string().trim().max(80).nullable(),
  color: z.string().trim().max(40).nullable(),
  performed_at: z.string().datetime({ offset: true }),
  ro_po_number: z.string().trim().max(40).nullable(),
  notes: z.string().trim().max(2000).nullable(),
  services: z.array(serviceLine).min(1),
});
export type UpdateJobInput = z.input<typeof updateJobSchema>;
