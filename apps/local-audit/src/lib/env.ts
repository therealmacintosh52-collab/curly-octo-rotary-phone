import "server-only";

import { z } from "zod";

/**
 * Server-side environment, validated once. Values never leave this module
 * except through the typed getters; status pages get booleans from
 * providerStatus(), not from here.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  PROVIDER_MODE: z.enum(["mock", "record", "live"]).optional(),
  AUDIT_COST_BUDGET_USD: z.coerce.number().positive().default(5),
});

let cached: z.infer<typeof EnvSchema> | null = null;

export function env(): z.infer<typeof EnvSchema> {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  cached = parsed.data;
  return cached;
}

export function appUrl(): string {
  return env().NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
}

/** Per-audit spend ceiling; the job warns (and later pauses) past it. */
export function auditCostBudgetUsd(): number {
  return env().AUDIT_COST_BUDGET_USD;
}
