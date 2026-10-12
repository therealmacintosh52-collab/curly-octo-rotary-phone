import { z } from "zod";

export const DiagnosisSchema = z.object({
  summary: z.string().describe("Two or three sentences for the technician: what the evidence points to and what to do first."),
  probable_causes: z
    .array(
      z.object({
        cause: z.string(),
        confidence: z.number().min(0).max(100).describe("Relative likelihood in percent; all causes together should roughly sum to 100."),
        rationale: z.string().describe("Why, grounded only in the cited context documents."),
        citations: z.array(z.string()).describe("Ids of context documents that support this cause, e.g. fix:<uuid>, complaint:<odi>, recall:<campaign>, dtc:<code>."),
      }),
    )
    .min(1)
    .max(8),
  test_plan: z
    .array(
      z.object({
        step: z.number().int().min(1),
        test: z.string().describe("What to do."),
        looking_for: z.string().describe("What result confirms or rules out a cause. Never a numeric specification unless it is in a cited LICENSED document."),
        rules_in_or_out: z.string().describe("Which probable cause this test confirms or eliminates."),
        est_minutes: z.number().int().min(1).max(600),
        est_cost_usd: z.number().min(0).describe("Parts/consumables cost of the test itself, 0 for inspections."),
        citations: z.array(z.string()),
      }),
    )
    .min(1)
    .max(12)
    .describe("Ordered cheapest and fastest first."),
  safety_flags: z.array(z.object({ system: z.string(), note: z.string() })),
  not_in_database: z.array(z.string()).describe("Any specification or value the technician would need that is not in the provided context (torque, capacities, pinouts, connector ids, calibration values)."),
});
export type Diagnosis = z.infer<typeof DiagnosisSchema>;

export const DiagnoseRequestSchema = z.object({
  session_id: z.string().uuid().optional(),
  vehicle_id: z.string().uuid().nullable().optional(),
  vehicle: z
    .object({ year: z.coerce.number().int().min(1949).max(2100), make: z.string().min(1).max(60), model: z.string().min(1).max(80), engine: z.string().max(80).nullable().optional() })
    .optional(),
  symptoms: z.string().trim().min(3).max(4000),
  codes: z.array(z.string().regex(/^[PBCU][0-9A-F]{4}$/)).max(20).default([]),
  tests: z.array(z.object({ test: z.string().max(300), result: z.string().max(500) })).max(30).default([]),
  mileage: z.coerce.number().int().min(0).max(2000000).nullable().optional(),
  follow_up: z.string().trim().max(2000).optional(),
});
export type DiagnoseRequest = z.infer<typeof DiagnoseRequestSchema>;

export interface ContextDoc {
  id: string;
  kind: "fix" | "complaint" | "recall" | "dtc" | "article";
  source: "NHTSA" | "COMMUNITY" | "OWNER" | "LICENSED" | "SAMPLE";
  title: string;
  url?: string;
  body: Record<string, unknown>;
}

export interface DiagnosisResult {
  diagnosis: Diagnosis;
  citations: ContextDoc[];
  guardrail_redactions: string[];
  model: string;
  usage: { input_tokens: number; output_tokens: number };
}
