import type { CallContext } from "@/lib/providers/core";
import type { Providers } from "@/lib/providers";
import { runChecks, type CheckContext } from "@/lib/checks";
import { parseInputs, type RawInputs } from "@/lib/resolve/inputs";
import { resolveBusiness, summarizeResolution } from "@/lib/resolve/resolver";
import type { AuditRepo } from "./repo";

export interface ResolveStepDeps {
  repo: AuditRepo;
  providers: Providers;
  /** Snapshot store + mode; auditId is set by the step. */
  ctx: Omit<CallContext, "auditId">;
  progress?: (pct: number, step: string) => Promise<void>;
}

/**
 * The Phase 1 pipeline step: parse inputs → resolve the entity → persist the
 * business, evidence and identity findings. Returns only a serializable
 * summary (no HTML) so it can be an Inngest step result.
 */
export async function runResolveStep(auditId: string, deps: ResolveStepDeps) {
  const { audit, business } = await deps.repo.load(auditId);
  const inputs = parseInputs((audit.inputs ?? {}) as RawInputs);
  await deps.progress?.(10, "resolve: reading inputs");

  const resolved = await resolveBusiness(inputs, { providers: deps.providers, ctx: { ...deps.ctx, auditId } });
  await deps.progress?.(35, "resolve: cross-checking name, address and phone");

  // 1. Business row: only overwrite with values we actually found.
  const patch: Parameters<AuditRepo["updateBusiness"]>[1] = {};
  if (resolved.name) patch.name = resolved.name;
  if (resolved.canonical_domain) patch.canonical_domain = resolved.canonical_domain;
  if (resolved.phone) patch.phone = resolved.phone;
  if (resolved.address) patch.address = resolved.address;
  if (resolved.lat !== null && resolved.lng !== null) {
    patch.lat = resolved.lat;
    patch.lng = resolved.lng;
  }
  if (resolved.place_id) patch.place_id = resolved.place_id;
  if (resolved.yelp_alias) patch.yelp_alias = resolved.yelp_alias;
  if (resolved.primary_category) patch.primary_category = resolved.primary_category;
  if (inputs.avgTicket) patch.avg_ticket = inputs.avgTicket;
  if (inputs.serviceArea || inputs.services.length) patch.service_area = { area: inputs.serviceArea, services: inputs.services };
  if (Object.keys(patch).length) await deps.repo.updateBusiness(business.id, patch);

  // 2. Evidence: one row per source, plus one per UNAVAILABLE source so the gap is on record.
  const evidenceRows = [
    ...resolved.evidence.map((e) => ({ type: e.type, excerpt: e.excerpt, source_url: e.source_url ?? null })),
    ...resolved.unavailable.map((u) => ({ type: "api_field" as const, excerpt: JSON.stringify({ source: u.source, status: "UNAVAILABLE", reason: u.reason, message: u.message }), source_url: null })),
  ];
  await deps.repo.insertEvidence(auditId, evidenceRows);

  // 3. Identity checks → findings, each finding's evidence stored and linked.
  const web = resolved.sources.website?.status === "ok" ? resolved.sources.website.data : null;
  const gbp = resolved.sources.gbp?.status === "ok" ? resolved.sources.gbp.data : null;
  const checkCtx: CheckContext = {
    audit: { id: auditId },
    business: { name: resolved.name ?? business.name, canonicalDomain: resolved.canonical_domain, phone: resolved.phone, address: resolved.address },
    website: web ? { pages: web.pages } : undefined,
    places: gbp ? { business: gbp.place } : undefined,
    yelp: resolved.sources.yelp?.status === "ok" ? { business: resolved.sources.yelp.data } : undefined,
    identity: {
      comparison: resolved.nap,
      gbpInputGiven: !!inputs.gbp,
      gbpFound: !!gbp,
      gbpWebsiteHost: resolved.gbp_website_host,
      canonicalDomain: resolved.canonical_domain,
      websiteFetched: !!web,
      websitePhones: web?.nap.phones ?? [],
      websiteAddresses: web?.nap.addresses ?? [],
    },
  };
  const run = await runChecks(checkCtx);
  const findingRows = [];
  for (const f of run.findings) {
    const ids = await deps.repo.insertEvidence(auditId, f.evidence.map((e) => ({ type: e.type, excerpt: e.excerpt, source_url: e.source_url ?? null })));
    findingRows.push({
      check_id: f.check_id,
      category: f.category,
      title: f.title,
      plain_english: f.plain_english,
      severity: f.severity,
      impact_score: f.impact_score,
      fix_difficulty: f.fix_difficulty,
      evidence_ids: ids,
    });
  }
  await deps.repo.insertFindings(auditId, findingRows);
  await deps.repo.mergeScores(auditId, {
    checks: {
      phase: 1,
      ran_at: new Date().toISOString(),
      passed: run.passed,
      unavailable: run.unavailable,
      assessed: run.assessed,
      resolution: summarizeResolution(resolved),
    },
  });
  await deps.progress?.(50, "resolve: done");

  return { ...summarizeResolution(resolved), findings: findingRows.length, passed: run.passed.length, checks_unavailable: run.unavailable.length };
}
