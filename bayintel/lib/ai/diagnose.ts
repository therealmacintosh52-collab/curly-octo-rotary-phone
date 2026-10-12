import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NOT_IN_DATABASE, APP_NAME } from "@/lib/config";
import { DiagnosisSchema, type ContextDoc, type DiagnosisResult } from "./schema";
import { detectSafetyFlags, scrubDiagnosis } from "./guardrails";

export const AI_MODEL = process.env.AI_MODEL || "claude-opus-5-5";

export function aiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export class AiRefusedError extends Error {
  constructor(public category: string | null) {
    super("The assistant declined this request.");
  }
}

const SYSTEM_PROMPT = `You are the diagnostic assistant inside ${APP_NAME}, a repair-intelligence tool used by professional automotive technicians in the service bay.

You reason ONLY from the context documents supplied in the user message (community confirmed fixes, generic DTC definitions, NHTSA recalls and owner complaints, and any licensed or sample articles). You are not a substitute for OEM service information.

HARD RULES - violating any of these is a failure:
1. Never state torque specifications, fluid capacities, wiring pinouts, pin or terminal numbers, connector IDs, wire colors, gap/clearance/preload values, pressure, voltage or resistance specifications, or any other calibration value, unless that exact value appears in a context document whose source is LICENSED. If the technician needs such a value and it is not in a LICENSED document, write exactly: "${NOT_IN_DATABASE}" and list the item in not_in_database.
2. Never invent part numbers. Only repeat a part number if it appears in a context document, and say which document it came from. Part numbers from SAMPLE documents are placeholders and must be called out as such.
3. Every probable cause and every test step must cite the context document ids that support it. Cite only ids that exist in the context. If nothing in the context supports a cause, you may still list it as general diagnostic reasoning with an empty citations array and lower confidence, and say so in the rationale.
4. Order the test plan cheapest and fastest first: visual inspection and scan-data checks before component tests, component tests before teardown, teardown before parts replacement. Never recommend replacing a part as a test.
5. Flag safety systems (brakes, SRS/airbags, steering, EV/hybrid high voltage, pressurized fuel) in safety_flags whenever they are involved.
6. Treat SAMPLE documents as illustrations of data shape, not evidence; weight COMMUNITY fixes by their confirmation counts; treat OWNER-reported complaints as anecdotal.
7. Be direct and concrete, in the voice of a senior diagnostic technician talking to another technician. No filler.`;

export async function runDiagnosis(opts: {
  vehicle: { year: number; make: string; model: string; engine?: string | null };
  mileage?: number | null;
  symptoms: string;
  codes: string[];
  tests: { test: string; result: string }[];
  docs: ContextDoc[];
  history?: { role: "user" | "assistant"; content: string }[];
  followUp?: string;
}): Promise<DiagnosisResult> {
  if (!aiConfigured()) throw new Error("AI is not configured (ANTHROPIC_API_KEY missing).");
  const client = new Anthropic();

  const caseBlock = [
    `VEHICLE: ${opts.vehicle.year} ${opts.vehicle.make} ${opts.vehicle.model}${opts.vehicle.engine ? ` ${opts.vehicle.engine}` : ""}${opts.mileage ? ` · ${opts.mileage.toLocaleString()} mi` : ""}`,
    `SYMPTOMS: ${opts.symptoms}`,
    `DTCs: ${opts.codes.length ? opts.codes.join(", ") : "none reported"}`,
    opts.tests.length ? `TESTS ALREADY PERFORMED:\n${opts.tests.map((t) => `- ${t.test}: ${t.result || "(no result recorded)"}`).join("\n")}` : "TESTS ALREADY PERFORMED: none",
  ].join("\n");

  const contextBlock = `CONTEXT DOCUMENTS (the only evidence you may cite):\n${JSON.stringify(
    opts.docs.map((d) => ({ id: d.id, kind: d.kind, source: d.source, title: d.title, ...d.body })),
    null,
    0,
  )}`;

  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const h of opts.history ?? []) messages.push({ role: h.role, content: h.content });
  const userText = opts.followUp
    ? `FOLLOW-UP from the technician: ${opts.followUp}\n\nRe-evaluate the case below with this new information and return an updated full diagnosis.\n\n${caseBlock}\n\n${contextBlock}`
    : `${caseBlock}\n\n${contextBlock}\n\nProduce the diagnosis.`;
  messages.push({ role: "user", content: userText });

  const response = await client.beta.messages.parse({
    model: AI_MODEL,
    max_tokens: 12000,
    system: SYSTEM_PROMPT,
    output_config: { effort: "high", format: betaZodOutputFormat(DiagnosisSchema) },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    messages,
  });

  if (response.stop_reason === "refusal") throw new AiRefusedError(response.stop_details?.category ?? null);
  const parsed = response.parsed_output;
  if (!parsed) throw new Error(response.stop_reason === "max_tokens" ? "The response was cut off. Try fewer codes or shorter symptoms." : "The assistant returned an unreadable response.");

  // Post-processing guardrails: scrub spec values, validate citations, add deterministic safety flags.
  const { value: diagnosis, redactions } = scrubDiagnosis(parsed);
  const known = new Map(opts.docs.map((d) => [d.id, d]));
  const used = new Set<string>();
  const clean = (ids: string[]) => ids.filter((id) => known.has(id) && (used.add(id), true));
  diagnosis.probable_causes = diagnosis.probable_causes.map((c) => ({ ...c, citations: clean(c.citations) }));
  diagnosis.test_plan = diagnosis.test_plan
    .map((t) => ({ ...t, citations: clean(t.citations) }))
    .sort((a, b) => a.step - b.step)
    .map((t, i) => ({ ...t, step: i + 1 }));
  const flagged = new Set(diagnosis.safety_flags.map((f) => f.system.toLowerCase()));
  for (const f of detectSafetyFlags([opts.symptoms, ...opts.codes, ...diagnosis.probable_causes.map((c) => c.cause), ...diagnosis.test_plan.map((t) => t.test)])) {
    if (![...flagged].some((s) => s.includes(f.system.toLowerCase().split(" ")[0]))) diagnosis.safety_flags.push(f);
  }
  if (redactions.length) diagnosis.not_in_database.push(...redactions.map((r) => r.split(":")[0]).filter((v, i, a) => a.indexOf(v) === i));

  return {
    diagnosis,
    citations: [...used].map((id) => known.get(id)!),
    guardrail_redactions: redactions,
    model: response.model,
    usage: { input_tokens: response.usage.input_tokens, output_tokens: response.usage.output_tokens },
  };
}
