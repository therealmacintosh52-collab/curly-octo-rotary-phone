"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { inngest } from "@/inngest/client";
import { AUDIT_REQUESTED } from "@/inngest/events";
import { hasResolvableInput, parseInputs } from "@/lib/resolve/inputs";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/db/types";

export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string; problems?: string[] };

const NewAuditSchema = z.object({
  website: z.string().trim().max(2000).optional().default(""),
  gbp: z.string().trim().max(2000).optional().default(""),
  yelp: z.string().trim().max(2000).optional().default(""),
  extraUrls: z.string().trim().max(5000).optional().default(""),
  serviceArea: z.string().trim().max(200).optional().default(""),
  services: z.string().trim().max(1000).optional().default(""),
  avgTicket: z.string().trim().max(20).optional().default(""),
});

function placeholderName(p: ReturnType<typeof parseInputs>): string {
  if (p.gbp?.kind === "text") return p.gbp.query;
  if (p.gbp?.kind === "maps_url" && p.gbp.parsed.name) return p.gbp.parsed.name;
  if (p.website) return p.website.host;
  if (p.yelp) return p.yelp.alias.replace(/-/g, " ");
  return "New audit";
}

/**
 * Creates the business + audit rows and enqueues the job. The job (not this
 * action) does the resolution, so the admin gets a page immediately.
 */
export async function createAuditAction(_prev: ActionResult<{ auditId: string }> | null, formData: FormData): Promise<ActionResult<{ auditId: string }>> {
  const session = await requireAdmin();
  const parsedForm = NewAuditSchema.safeParse(Object.fromEntries(formData));
  if (!parsedForm.success) return { ok: false, error: "The form could not be read." };
  const raw = parsedForm.data;
  const inputs = parseInputs(raw);
  if (inputs.problems.length) return { ok: false, error: "Some inputs could not be understood.", problems: inputs.problems };
  if (!hasResolvableInput(inputs)) return { ok: false, error: "Give at least one of: website, Google Business Profile, Yelp URL." };

  const supabase = await createClient();
  const { data: business, error: berr } = await supabase
    .from("businesses")
    .insert({ name: placeholderName(inputs), canonical_domain: inputs.website?.host ?? null, yelp_alias: inputs.yelp?.alias ?? null, created_by: session.userId })
    .select("id")
    .single();
  if (berr || !business) return { ok: false, error: `Could not create the business: ${berr?.message ?? "unknown error"}` };

  const storedInputs: Json = {
    website: raw.website || null,
    gbp: raw.gbp || null,
    yelp: raw.yelp || null,
    extraUrls: raw.extraUrls || null,
    serviceArea: raw.serviceArea || null,
    services: raw.services || null,
    avgTicket: raw.avgTicket || null,
    extras: inputs.extras.map((e) => ({ url: e.url, kind: e.kind, network: e.network ?? null, directory: e.directory ?? null })),
  };
  const { data: audit, error: aerr } = await supabase
    .from("audits")
    .insert({ business_id: business.id, status: "queued", inputs: storedInputs, current_step: "queued" })
    .select("id")
    .single();
  if (aerr || !audit) return { ok: false, error: `Could not create the audit: ${aerr?.message ?? "unknown error"}` };

  try {
    await inngest.send({ name: AUDIT_REQUESTED, data: { auditId: audit.id, businessId: business.id, requestedBy: session.userId } });
  } catch (err) {
    // No dev server / no event key: leave a clear failure on the audit instead of a silent queue.
    const message = err instanceof Error ? err.message : String(err);
    await createAdminClient().from("audits").update({ status: "failed", current_step: `failed to enqueue: ${message.slice(0, 180)}` }).eq("id", audit.id);
  }

  redirect(`/admin/audits/${audit.id}`);
}
