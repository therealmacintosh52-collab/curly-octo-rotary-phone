// Pipeline: New lead -> Quoted -> Booked -> In progress -> Done -> Reviewed (+ Lost). Transition rules are a pure
// function (evaluateMove) so the UI can show why a move is blocked and tests can pin the rules down.
import { repo, type BookingRow, type Customer, type Lead, type LeadSource, type LeadStage } from '@/lib/db';
import { normalizePhone } from '@/lib/sms';
import { HttpError } from './api';
import { logEvent } from './events';

export const PIPELINE_STAGES = ['new', 'quoted', 'booked', 'in_progress', 'done', 'reviewed'] as const satisfies readonly LeadStage[];
export const STAGE_LABEL: Record<LeadStage, string> = { new: 'New lead', quoted: 'Quoted', booked: 'Booked', in_progress: 'In progress', done: 'Done', reviewed: 'Reviewed', lost: 'Lost' };
/** Channels money can be spent on (ad_spend.channel check constraint in 0002). */
export const AD_CHANNELS: LeadSource[] = ['google', 'gbp', 'meta_ads', 'instagram', 'tiktok', 'door_knock', 'referral', 'dealer', 'organic', 'direct', 'other'];
/** Every lead source, including the ones the 916 Concierge assigns itself (chat = website widget, sms = text). */
export const LEAD_SOURCES: LeadSource[] = [...AD_CHANNELS, 'chat', 'sms'];

const LIVE = ['confirmed', 'on_the_way', 'in_progress'] as const;

export type MoveContext = { hasQuote: boolean; booking: { status: string } | null };
export type MoveDecision = { ok: true; effect?: 'start_job' | 'review' } | { ok: false; reason: string };

export function nextStages(from: LeadStage): LeadStage[] {
  switch (from) {
    case 'new': return ['quoted', 'booked', 'lost'];
    case 'quoted': return ['booked', 'lost'];
    case 'booked': return ['in_progress', 'lost'];
    case 'in_progress': return ['done'];
    case 'done': return ['reviewed'];
    case 'reviewed': return [];
    case 'lost': return ['new'];
  }
}

export function evaluateMove(from: LeadStage, to: LeadStage, ctx: MoveContext, reason?: string): MoveDecision {
  if (from === to) return { ok: false, reason: 'Already in that stage.' };
  if (!nextStages(from).includes(to)) return { ok: false, reason: `A lead cannot go from ${STAGE_LABEL[from]} to ${STAGE_LABEL[to]}.` };
  const live = ctx.booking && (LIVE as readonly string[]).includes(ctx.booking.status);
  switch (to) {
    case 'quoted': return ctx.hasQuote ? { ok: true } : { ok: false, reason: 'Create a quote first (price range for this customer).' };
    case 'booked': return live || ctx.booking?.status === 'completed' ? { ok: true } : { ok: false, reason: 'Book a time first. Use "Book it" so the calendar and deposit are handled.' };
    case 'in_progress': return live ? { ok: true, effect: 'start_job' } : { ok: false, reason: 'There is no active booking to start.' };
    case 'done': return ctx.booking?.status === 'completed' ? { ok: true } : { ok: false, reason: 'Finish the job (final price, payment, signature) from the job screen. That moves it to Done.' };
    case 'reviewed': return ctx.booking?.status === 'completed' ? { ok: true, effect: 'review' } : { ok: false, reason: 'Only finished jobs can be marked reviewed.' };
    case 'lost':
      if (live) return { ok: false, reason: 'Cancel or reschedule the booking first so the deposit policy is applied.' };
      return reason?.trim() ? { ok: true } : { ok: false, reason: 'Say why it was lost (price, no response, out of area...).' };
    case 'new': return { ok: true };
  }
}

async function ctxFor(lead: Lead): Promise<{ hasQuote: boolean; booking: BookingRow | null; bookings: BookingRow[] }> {
  const db = repo();
  const [quotes, bookings] = await Promise.all([db.quotes.list({ where: { lead_id: lead.id }, limit: 1 }), db.bookings.list({ where: { lead_id: lead.id }, orderBy: 'starts_at', desc: true })]);
  const booking = bookings.find((b) => (LIVE as readonly string[]).includes(b.status)) ?? bookings.find((b) => b.status === 'completed') ?? null;
  return { hasQuote: quotes.length > 0, booking, bookings };
}

export async function moveContext(lead: Lead) { return ctxFor(lead); }

/** Rule-checked stage change by a person. Side effects (starting a job, review stamp) live here, once. */
export async function moveStage(leadId: string, to: LeadStage, actor: string, opts: { reason?: string } = {}): Promise<Lead> {
  const db = repo();
  const lead = await db.leads.get(leadId);
  if (!lead) throw new HttpError(404, 'not_found', 'Lead not found.');
  const ctx = await ctxFor(lead);
  const d = evaluateMove(lead.stage, to, ctx, opts.reason);
  if (!d.ok) throw new HttpError(409, 'stage_blocked', d.reason);
  if (d.effect === 'start_job' && ctx.booking) {
    const { startJobForBooking } = await import('./jobs');
    await startJobForBooking(ctx.booking.id, actor);
  }
  const updated = await db.leads.updateIf(leadId, { stage: lead.stage }, { stage: to });
  if (!updated) throw new HttpError(409, 'stale', 'That lead just changed. Reload and try again.');
  if (d.effect === 'review' && ctx.booking) {
    const job = await db.jobs.first({ where: { booking_id: ctx.booking.id } });
    if (job) await db.jobs.update(job.id, { stage: 'reviewed', reviewed_at: new Date().toISOString() });
  }
  await logEvent('pipeline.stage_changed', 'lead', leadId, actor, { from: lead.stage, to, reason: opts.reason?.slice(0, 200) ?? null });
  return updated;
}

/** System-driven advance (tech started/finished a job). No rule checks: the booking state machine already did them. */
export async function advanceLead(leadId: string | null | undefined, to: LeadStage, actor: string): Promise<void> {
  if (!leadId) return;
  const lead = await repo().leads.get(leadId);
  if (!lead || lead.stage === to) return;
  await repo().leads.update(leadId, { stage: to });
  await logEvent('pipeline.stage_changed', 'lead', leadId, actor, { from: lead.stage, to, reason: 'system' });
}

export async function overrideSource(leadId: string, source: LeadSource, actor: string): Promise<Lead> {
  const db = repo();
  const lead = await db.leads.get(leadId);
  if (!lead) throw new HttpError(404, 'not_found', 'Lead not found.');
  if (lead.source === source) return lead;
  const updated = await db.leads.update(leadId, { source, source_auto: lead.source_overridden ? lead.source_auto ?? null : lead.source, source_overridden: true });
  await logEvent('lead.source_overridden', 'lead', leadId, actor, { from: lead.source, to: source });
  return updated;
}

/** Find a customer by normalized phone, else email; create one if neither matches. */
export async function findOrCreateCustomer(c: { name: string; phone?: string | null; email?: string | null }): Promise<{ customer: Customer; created: boolean }> {
  const db = repo();
  const phone = normalizePhone(c.phone);
  if (c.phone && !phone) throw new HttpError(400, 'invalid_phone', 'Enter a valid US phone number.');
  const email = c.email?.trim().toLowerCase() || null;
  const found = (phone ? await db.customers.first({ where: { phone } }) : null) ?? (email ? await db.customers.first({ where: { email } }) : null);
  if (found) return { customer: found, created: false };
  return { customer: await db.customers.insert({ name: c.name.trim(), phone, email, sms_opt_in: false }), created: true };
}

export type NewLeadInput = { name: string; phone?: string | null; email?: string | null; zip?: string | null; source: LeadSource; notes?: string | null };

/** Quick-add (door-knock mode needs only name + phone + where/what). Never texts anyone; consent is not assumed. */
export async function createLead(i: NewLeadInput, actor: string): Promise<Lead> {
  if (!i.phone && !i.email) throw new HttpError(400, 'contact_required', 'Add a phone number or an email so you can follow up.');
  const { customer } = await findOrCreateCustomer(i);
  const lead = await repo().leads.insert({
    customer_id: customer.id, name: i.name.trim(), phone: customer.phone ?? null, email: customer.email ?? null, zip: i.zip?.trim() || null,
    stage: 'new', source: i.source, source_auto: i.source, source_overridden: false, notes: i.notes?.trim().slice(0, 1000) || null,
  });
  await logEvent('lead.created', 'lead', lead.id, actor, { source: i.source, manual: true });
  return lead;
}

export type PipelineCard = { lead: Lead; customer: Customer | null; ageDays: number };

export async function loadPipeline(opts: { source?: LeadSource | null; includeLost?: boolean; now?: number } = {}): Promise<Record<LeadStage, PipelineCard[]>> {
  const db = repo();
  const now = opts.now ?? Date.now();
  const leads = await db.leads.list({ ...(opts.source ? { where: { source: opts.source } } : {}), orderBy: 'created_at', desc: true });
  const custIds = [...new Set(leads.map((l) => l.customer_id).filter((x): x is string => !!x))];
  const customers = custIds.length ? await db.customers.list({ whereIn: [{ col: 'id', values: custIds }] }) : [];
  const byId = new Map(customers.map((c) => [c.id, c]));
  const out = Object.fromEntries([...PIPELINE_STAGES, 'lost'].map((s) => [s, [] as PipelineCard[]])) as Record<LeadStage, PipelineCard[]>;
  for (const lead of leads) {
    if (lead.stage === 'lost' && !opts.includeLost) continue;
    out[lead.stage].push({ lead, customer: lead.customer_id ? byId.get(lead.customer_id) ?? null : null, ageDays: Math.floor((now - Date.parse(lead.created_at)) / 86_400_000) });
  }
  return out;
}
