import { z } from "zod";

export const AUDIT_REQUESTED = "audit/requested" as const;

export const AuditRequested = z.object({
  auditId: z.string().uuid(),
  businessId: z.string().uuid(),
  requestedBy: z.string().uuid().optional(),
});
export type AuditRequested = z.infer<typeof AuditRequested>;
