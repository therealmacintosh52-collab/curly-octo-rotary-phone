// The 11 concierge tools and their SERVER-SIDE enforcement. The model proposes calls; this file decides.
//   * every input is zod-validated (strict objects, bounded strings)
//   * slots: create_booking / reschedule_booking only accept a slot id that check_availability returned IN THIS conversation
//   * photos: dent quotes and dent bookings need photos attached IN THIS conversation (ids P1.., never paths)
//   * identity: lookup/reschedule/cancel/deposit-link need the verified phone of the channel or a signed manage token
//   * cancel is two-step across customer turns, so one injected message can never cancel anything
//   * results are sanitised before the model sees them (they can contain customer/vision text)
// Business logic is NOT re-implemented: availability, pricing, booking, policy and quote all come from src/lib/*.
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { ADDON_IDS, SERVICE_IDS, SIZE_CLASS_IDS, bookingConfig, depositPolicy, serviceById, sizeClasses } from '@/config/booking';
import { ESTIMATE_LABEL, depositAmount } from '@/config/pricing';
import { formatDay, formatTime } from '@/lib/availability/tz';
import { log } from '@/lib/api/log';
import { BookingError, cancelBooking, createBooking, rescheduleBooking } from '@/lib/booking/service';
import { availabilityFor } from '@/lib/booking/loader';
import { loadPhoto } from '@/lib/booking/photos';
import { decisionMessage, evaluateCancel, evaluateReschedule, policyLines } from '@/lib/booking/policy';
import { createBookingSchema } from '@/lib/booking/schema';
import type { BookingStatus } from '@/lib/booking/state';
import { signBookingToken } from '@/lib/booking/tokens';
import { repo, type BookingRow } from '@/lib/db';
import { assessZip } from '@/lib/geo';
import { baseUrl } from '@/lib/notify/dispatch';
import { computeDuration, computePrice, hasDent, validateSelection } from '@/lib/pricing';
import { getQuote, type QuotePhoto } from '@/lib/quote';
import { isSmsLive, normalizePhone } from '@/lib/sms';
import { isSupabaseLive } from '@/lib/db';
import { authorizeBooking, bookingsForVerifiedPhone, verifiedPhoneOf } from './authz';
import { conciergeConfig } from './config';
import { businessFacts } from './facts';
import { sanitizeDeep, sanitizeUntrusted } from './guardrails';
import { escalate } from './owners';
import { ensureLead, type ConvRecord, type OfferedSlot } from './state';
import type { ChannelIdentity, EscalationReason, ToolDef, ToolOutcome, UiBlock } from './types';

const HOUR = 3_600_000;
const MIN = 60_000;

export type ToolContext = {
  rec: ConvRecord;
  identity: ChannelIdentity;
  now: number;
  /** 1-based customer-message counter for this conversation. */
  turn: number;
  /** Filled by the executor so the output filter knows what the tools legitimately produced this turn. */
  turnLog: { urls: Set<string>; done: { create_booking?: 'pending_deposit' | 'confirmed'; reschedule_booking?: boolean; cancel_booking?: boolean; send_deposit_link?: boolean; escalate?: boolean }; quoted: boolean };
};

const serviceEnum = z.enum(SERVICE_IDS);
const sizeEnum = z.enum(SIZE_CLASS_IDS);
const addonEnum = z.enum(ADDON_IDS);
const zip5 = z.string().trim().regex(/^\d{5}$/, 'ZIP must be 5 digits');
const shortText = (n: number) => z.string().trim().max(n);
const vehicleIn = z.object({ year: z.number().int().min(1950).max(new Date().getFullYear() + 2).optional(), make: shortText(40).optional(), model: shortText(40).optional(), color: shortText(30).optional() }).strict();

export const toolSchemas = {
  get_services: z.object({}).strict(),
  check_service_area: z.object({ zip: zip5 }).strict(),
  get_quote_range: z.object({
    services: z.array(serviceEnum).min(1).max(4),
    size_class: sizeEnum,
    vehicle: vehicleIn.optional(),
    photo_ids: z.array(shortText(8)).max(6).optional(),
    addons: z.array(addonEnum).max(4).default([]),
    zip: zip5.optional(),
  }).strict(),
  check_availability: z.object({
    services: z.array(serviceEnum).min(1).max(4).optional(),
    addons: z.array(addonEnum).max(4).default([]),
    size_class: sizeEnum.optional(),
    zip: zip5.optional(),
    booking_id: shortText(64).optional(),
    manage_token: shortText(500).optional(),
    from_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    days: z.number().int().min(1).max(14).optional(),
  }).strict(),
  create_booking: z.object({
    slot_id: shortText(16),
    name: shortText(80).min(2),
    email: z.email().max(120),
    address_line: shortText(120).min(4),
    vehicle: z.object({ year: z.number().int().min(1950).max(new Date().getFullYear() + 2), make: shortText(40).min(1), model: shortText(40).min(1), color: shortText(30).optional() }).strict(),
    notes: shortText(300).optional(),
  }).strict(),
  send_deposit_link: z.object({ booking_id: shortText(64) }).strict(),
  reschedule_booking: z.object({ slot_id: shortText(16), booking_id: shortText(64).optional(), manage_token: shortText(500).optional() }).strict(),
  cancel_booking: z.object({ booking_id: shortText(64).optional(), manage_token: shortText(500).optional(), reason: shortText(200).optional(), confirmed: z.boolean().default(false) }).strict(),
  lookup_booking: z.object({ phone: shortText(30).optional() }).strict(),
  create_lead: z.object({
    name: shortText(80).optional(), phone: shortText(30).optional(), email: z.email().max(120).optional(), zip: zip5.optional(),
    services: z.array(serviceEnum).max(4).optional(), notes: shortText(400).optional(),
    reason: z.enum(['out_of_area', 'needs_review', 'callback', 'general']).default('general'),
  }).strict(),
  escalate_to_human: z.object({
    reason: z.enum(['complaint', 'insurance', 'legal', 'safety', 'uncertainty', 'abuse', 'requested_human', 'other']),
    summary: shortText(400).min(3),
  }).strict(),
} as const;

export type ToolName = keyof typeof toolSchemas;
export const TOOL_NAMES = Object.keys(toolSchemas) as ToolName[];

const DESCRIPTIONS: Record<ToolName, string> = {
  get_services: 'List the services we offer in plain language, vehicle size classes with examples, add-ons, the deposit and the change/cancel policy. Call this before describing services or policies. It never contains prices.',
  check_service_area: 'Check whether we come to a 5-digit ZIP and what the travel fee is. Call as soon as the customer gives a ZIP. If it is not in_area, do not offer times: offer to take their details with create_lead.',
  get_quote_range: 'Get a price range. Detailing services are priced from our price list. Dent Removal and Hail Fix NEED photos the customer attached in this chat (photo_ids like P1, P2; omit to use all). Without enough photos this returns needs_photos and no price: ask for photos. Never state a dent price that did not come from this tool.',
  check_availability: 'Find real open times. Returns slot_id values you must use for booking. Never suggest a time that this tool did not return. To change an existing booking pass booking_id (or manage_token) instead of services; the booking must belong to this customer.',
  create_booking: 'HOLD one of the slots returned by check_availability in this chat (slot_id) for 15 minutes pending the deposit. Needs the verified phone of this chat, plus name, email, service address and vehicle. This does NOT confirm the booking: call send_deposit_link next.',
  send_deposit_link: 'Give the customer the secure link to pay the deposit for a booking you just held. The booking is only confirmed after the deposit is paid.',
  reschedule_booking: 'Move an existing booking to a slot returned by check_availability for that same booking. The customer must be verified (or give their manage_token). Policy limits are enforced by the system.',
  cancel_booking: 'Cancel a booking. Two steps: first call with confirmed=false to get the deposit outcome and tell the customer; only after the customer says yes in a LATER message, call again with confirmed=true.',
  lookup_booking: 'Look up the bookings of the customer in this chat. Works only for the verified phone of this chat; any phone argument must match it. If verification_required comes back, tell the customer to verify their phone in the chat.',
  create_lead: 'Save the customer as a lead (name, phone, email, ZIP, what they want). Use for out-of-area ZIPs, callbacks, or anyone who is not ready to book.',
  escalate_to_human: 'Hand the conversation to the owners and text them a summary. Use for complaints, insurance claims, legal threats, safety issues, abusive customers, requests for a person, or anything you are unsure about.',
};

export function toolDefs(): ToolDef[] {
  return TOOL_NAMES.map((name) => {
    const js = z.toJSONSchema(toolSchemas[name], { io: 'input' }) as Record<string, unknown>;
    delete js.$schema;
    return { name, description: DESCRIPTIONS[name], input_schema: js };
  });
}

// ------------------------------------------------------------------------------------------------ helpers

const refuse = (blocked: string, message: string, extra: Record<string, unknown> = {}, ui?: UiBlock[]): ToolOutcome => ({ ok: false, blocked, data: { status: blocked, message, ...extra }, ui });
const fail = (message: string, extra: Record<string, unknown> = {}): ToolOutcome => ({ ok: false, data: { status: 'error', message, ...extra } });

const slotLabel = (startMs: number) => `${formatDay(startMs)} at ${formatTime(startMs)}`;
const plainNames = (ids: string[]) => ids.map((s) => serviceById(s)?.plain ?? s);
const slotId = (convId: string, startISO: string, techId: string, key: string) => `S${createHash('sha256').update(`${convId}|${startISO}|${techId}|${key}`).digest('hex').slice(0, 7)}`;

export const mockVerifyAllowed = (): boolean => !isSupabaseLive();
/** Can this deployment verify a web visitor's phone at all? (live SMS, or demo mode with no real data) */
export const verificationAvailable = (): boolean => isSmsLive() || mockVerifyAllowed();
const verifyUi = (): UiBlock[] => (verificationAvailable() ? [{ type: 'verify_phone', mockCodeHint: !isSmsLive() && mockVerifyAllowed() ? conciergeConfig.mockVerifyCode : undefined }] : []);

function needVerification(): ToolOutcome {
  return refuse('verification_required',
    verificationAvailable()
      ? 'I need to verify the phone number for this chat first. On the website a verify-phone form appears in the chat for the customer; or they can text us from their own phone.'
      : 'Phone verification is not available right now. Offer to pass this to the owners with escalate_to_human, or have the customer text us from their own phone.',
    {}, verifyUi());
}

const toManage = (b: BookingRow) => signBookingToken(b.id, Math.max(Date.parse(b.starts_at), Date.now()) + 7 * 24 * HOUR);

function bookingSummary(b: BookingRow, now: number) {
  const pol = { status: b.status as BookingStatus, startsAt: Date.parse(b.starts_at), depositPaid: b.deposit_status === 'paid', rescheduleCount: b.reschedule_count };
  const rs = evaluateReschedule(pol, now);
  const cn = evaluateCancel(pol, now);
  return {
    booking_id: b.id, status: b.status, services: plainNames(b.services), when: slotLabel(Date.parse(b.starts_at)), city: b.city ?? null,
    deposit_status: b.deposit_status, price_low: b.price_low ?? null, price_high: b.price_high ?? null,
    can_reschedule: rs.allowed, reschedule_note: rs.allowed ? (rs.late ? 'Allowed. Inside the free window; the deposit still moves to the new time.' : 'Allowed. Free, and the deposit moves with the booking.') : decisionMessage(rs),
    can_cancel: cn.allowed, cancel_outcome: cn.allowed ? cn.depositOutcome : null, cancel_note: cn.allowed ? undefined : decisionMessage(cn),
  };
}

function rememberSelection(ctx: ToolContext, p: { services?: string[]; sizeClass?: string; zip?: string; vehicle?: { year?: number; make?: string; model?: string } }) {
  const c = ctx.rec.state.collected;
  if (p.services?.length) c.services = p.services;
  if (p.sizeClass) c.sizeClass = p.sizeClass;
  if (p.zip) c.zip = p.zip;
  if (p.vehicle && (p.vehicle.make || p.vehicle.model)) c.vehicle = { ...c.vehicle, ...p.vehicle };
}

// ------------------------------------------------------------------------------------------------ tools

type Runner<K extends ToolName> = (input: z.infer<(typeof toolSchemas)[K]>, ctx: ToolContext) => Promise<ToolOutcome>;

const get_services: Runner<'get_services'> = async () => {
  const active = new Set((await repo().services.list({ where: { active: true } })).map((s) => s.id));
  const list = SERVICE_IDS.filter((id) => active.size === 0 || active.has(id)).map((id) => {
    const s = serviceById(id)!;
    return { id, name: s.plain, summary: s.summary, needs_photos_for_price: s.dent, needs_photos_to_book: s.requiresPhotos };
  });
  return {
    ok: true,
    data: {
      services: list,
      vehicle_size_classes: sizeClasses.map((c) => ({ id: c.id, label: c.label, examples: c.examples })),
      addons: ADDON_IDS,
      deposit_amount: depositAmount,
      deposit_note: `A $${depositAmount} deposit holds your time and is credited to the final invoice.`,
      change_cancel_policy: policyLines(depositPolicy),
      travel: businessFacts.travelFeeNote,
      estimate_label: ESTIMATE_LABEL,
      photos_guidance: `Dent work needs at least ${bookingConfig.photos.minForDents} photos: one wide shot of the panel and one close-up of each dent.`,
    },
  };
};

const check_service_area: Runner<'check_service_area'> = async ({ zip }, ctx) => {
  const a = assessZip(zip);
  ctx.rec.state.zip = { zip, status: a.status, city: a.city, fee: a.travelFee, at: ctx.now };
  rememberSelection(ctx, { zip });
  await ensureLead(ctx.rec, ctx.identity.channel, { zip, area_status: a.status });
  return {
    ok: true,
    data: {
      zip, status: a.status, city: a.city ?? null, travel_fee: a.travelFee, message: a.message,
      next: a.status === 'in_area' ? 'Offer to check times.' : 'Do not offer times. Offer to take their details with create_lead, or hand to the owners.',
    },
  };
};

const get_quote_range: Runner<'get_quote_range'> = async (inp, ctx) => {
  const st = ctx.rec.state;
  const sel = validateSelection(inp.services, inp.size_class, inp.addons);
  if (!sel.ok) return fail(sel.error);
  rememberSelection(ctx, { services: sel.services, sizeClass: sel.sizeClass, zip: inp.zip, vehicle: inp.vehicle });
  const zip = inp.zip ?? st.collected.zip;
  const area = zip ? assessZip(zip) : null;
  const travelFee = area?.status === 'in_area' ? area.travelFee ?? 0 : 0;

  if (!hasDent(sel.services)) {
    const price = computePrice({ services: sel.services, sizeClass: sel.sizeClass, addons: sel.addons, travelFee });
    if (!price.ok || price.low === null || price.high === null) return fail(price.ok ? 'No price available.' : price.error);
    ctx.turnLog.quoted = true;
    await ensureLead(ctx.rec, ctx.identity.channel, { stage: 'quoted' });
    return {
      ok: true,
      data: { status: 'ok', kind: 'price_list', range: { low: price.low, high: price.high }, travel_fee: price.travelFee, total_low: price.totalLow, total_high: price.totalHigh, lines: price.lines, deposit: price.deposit, label: ESTIMATE_LABEL, travel_fee_applies_only_if_zip_known: !area },
      ui: [{ type: 'quote', low: price.low, high: price.high, label: ESTIMATE_LABEL, services: plainNames(sel.services), travelFee: price.travelFee, deposit: price.deposit }],
    };
  }

  // Dent work: photos from THIS conversation, or no price. The server decides, not the model.
  const wanted = inp.photo_ids?.length ? inp.photo_ids : st.photos.map((p) => p.id);
  const chosen = wanted.map((id) => st.photos.find((p) => p.id === id));
  if (chosen.some((p) => !p)) return refuse('unknown_photo', 'One of those photo ids was not attached in this chat. Use only the photo ids you were given.');
  const photos = chosen as NonNullable<(typeof chosen)[number]>[];
  if (photos.length < bookingConfig.photos.minForDents) {
    return refuse('needs_photos', `Dent work needs photos before any price. Ask the customer to send at least ${bookingConfig.photos.minForDents}: one wide shot of the panel and one close-up of each dent. Do not give a number.`, { photos_attached: photos.length, photos_needed: bookingConfig.photos.minForDents });
  }
  const loaded: QuotePhoto[] = [];
  for (const p of photos) { const l = await loadPhoto(p.path); if (l) loaded.push(l); }
  if (loaded.length < bookingConfig.photos.minForDents) return refuse('needs_photos', 'Those photos could not be read. Ask the customer to send them again.', { photos_attached: loaded.length });
  const quote = await getQuote({ services: sel.services, sizeClass: sel.sizeClass, vehicle: inp.vehicle, photos: loaded });
  if (quote.status !== 'ok') {
    return { ok: true, data: { status: quote.status, message: quote.message, label: ESTIMATE_LABEL, next: 'No price yet. Offer to book an inspection time; a technician will confirm the price.' } };
  }
  const row = await repo().quotes.insert({
    services: sel.services, size_class: sel.sizeClass, low: quote.low, high: quote.high, confidence: quote.confidence, panels: quote.panels,
    notes: quote.notes, photo_paths: photos.map((p) => p.path), model: quote.mock ? 'mock' : bookingConfig.quote.model, mock: quote.mock, label: quote.label,
  });
  const price = computePrice({ services: sel.services, sizeClass: sel.sizeClass, addons: sel.addons, dentQuote: { low: quote.low, high: quote.high }, travelFee });
  const totalLow = price.ok ? price.totalLow : null; const totalHigh = price.ok ? price.totalHigh : null;
  st.quote = { id: row.id, low: quote.low, high: quote.high, totalLow, totalHigh, travelFee, services: sel.services, sizeClass: sel.sizeClass, panels: quote.panelCount, at: ctx.now };
  ctx.turnLog.quoted = true;
  await ensureLead(ctx.rec, ctx.identity.channel, { stage: 'quoted' });
  return {
    ok: true,
    data: {
      status: 'ok', kind: 'photo_quote', range: { low: quote.low, high: quote.high }, total_low: totalLow, total_high: totalHigh, travel_fee: travelFee,
      panels_seen: quote.panelCount, confidence: quote.confidenceLabel, deposit: depositAmount, label: ESTIMATE_LABEL,
      // vision-model text: untrusted, sanitised, short
      photo_notes: quote.notes, mock_estimate: quote.mock,
    },
    ui: [{ type: 'quote', low: quote.low, high: quote.high, label: ESTIMATE_LABEL, services: plainNames(sel.services), travelFee, deposit: depositAmount }],
  };
};

const check_availability: Runner<'check_availability'> = async (inp, ctx) => {
  const st = ctx.rec.state;
  let services: string[]; let addons: string[]; let sizeClass: string; let zip: string; let excludeBookingId: string | undefined; let forBookingId: string | undefined; let panels: number | undefined;

  if (inp.booking_id || inp.manage_token) {
    const acc = await authorizeBooking({ identity: ctx.identity, state: st, bookingId: inp.booking_id, token: inp.manage_token, now: ctx.now });
    if (!acc.ok) return acc.reason === 'verification_required' ? needVerification() : refuse('not_accessible', "I can't access that booking from this chat.");
    const b = acc.booking;
    if (b.status !== 'confirmed') return refuse('not_changeable', 'Only confirmed bookings can be rescheduled here.');
    services = b.services; addons = b.addons; sizeClass = b.size_class ?? 'sedan'; zip = b.zip ?? ''; excludeBookingId = b.id; forBookingId = b.id;
    const q = b.quote_id ? await repo().quotes.get(b.quote_id) : null;
    panels = q && Array.isArray(q.panels) && q.panels.length ? q.panels.length : undefined;
  } else {
    services = inp.services ?? st.collected.services ?? [];
    sizeClass = inp.size_class ?? st.collected.sizeClass ?? '';
    zip = inp.zip ?? st.collected.zip ?? '';
    addons = inp.addons;
    if (!services.length || !sizeClass || !zip) return fail('Need the service, the vehicle size class and the ZIP before checking times.', { missing: [!services.length && 'services', !sizeClass && 'size_class', !zip && 'zip'].filter(Boolean) });
    if (st.quote && st.quote.sizeClass === sizeClass && st.quote.services.every((s) => services.includes(s))) panels = st.quote.panels;
  }
  const sel = validateSelection(services, sizeClass, addons);
  if (!sel.ok) return fail(sel.error);
  const area = assessZip(zip);
  if (area.status !== 'in_area') return refuse('out_of_area', area.message, { area_status: area.status });
  rememberSelection(ctx, { services: sel.services, sizeClass: sel.sizeClass, zip });

  const durationMin = computeDuration({ services: sel.services, sizeClass: sel.sizeClass, addons: sel.addons, panels });
  const exterior = sel.services.some((s) => serviceById(s)?.exterior);
  const { slots } = await availabilityFor(ctx.now, { durationMin, zip, exterior, fromDate: inp.from_date, days: inp.days ?? 7, excludeBookingId });

  // spread the offer: up to two per day (earliest, and one at least 3 h later) over the first three open days
  const byDay = new Map<string, typeof slots>();
  for (const s of slots) byDay.set(s.date, [...(byDay.get(s.date) ?? []), s]);
  const picked: typeof slots = [];
  for (const [, daySlots] of [...byDay].slice(0, 3)) {
    picked.push(daySlots[0]!);
    const later = daySlots.find((s) => s.start - daySlots[0]!.start >= 3 * HOUR);
    if (later) picked.push(later);
  }
  const offered = picked.slice(0, conciergeConfig.maxOfferedSlots);

  // forget stale offers, then remember these (this list IS the provenance check for create/reschedule)
  st.offered = st.offered.filter((o) => ctx.now - o.offeredAt < conciergeConfig.slotTtlMs && o.forBookingId !== forBookingId);
  const key = `${sel.services.join('+')}|${sel.addons.join('+')}|${sel.sizeClass}|${zip}|${forBookingId ?? ''}`;
  const rows: OfferedSlot[] = offered.map((s) => ({
    id: slotId(ctx.rec.conv.id, s.startISO, s.techId, key), startsAt: s.startISO, endsAt: s.endISO, techId: s.techId, label: slotLabel(s.start),
    services: sel.services, addons: sel.addons, sizeClass: sel.sizeClass, zip, panels, offeredAt: ctx.now, forBookingId,
  }));
  st.offered = [...st.offered.filter((o) => !rows.some((r) => r.id === o.id)), ...rows].slice(-30);

  if (rows.length === 0) return { ok: true, data: { status: 'no_openings', slots: [], message: 'No open times in that window. Offer to look further out, or take their details with create_lead so the owners can follow up.' } };
  const needsPhotos = sel.services.some((s) => serviceById(s)?.requiresPhotos) && st.photos.length < bookingConfig.photos.minForDents;
  return {
    ok: true,
    data: {
      status: 'ok', duration_minutes: durationMin, slots: rows.map((r) => ({ slot_id: r.id, when: r.label })),
      note: needsPhotos ? `These times are real, but dent work also needs at least ${bookingConfig.photos.minForDents} photos before it can be booked.` : undefined,
    },
    ui: [{ type: 'slots', slots: rows.map((r) => ({ id: r.id, label: r.label })), durationMin }],
  };
};

const create_booking: Runner<'create_booking'> = async (inp, ctx) => {
  const st = ctx.rec.state;
  const slot = st.offered.find((o) => o.id === inp.slot_id);
  if (!slot || slot.forBookingId) return refuse('slot_not_offered', 'That time was not offered in this chat. Only book a slot_id that check_availability returned. Check availability again and offer real times.');
  if (ctx.now - slot.offeredAt > conciergeConfig.slotTtlMs) return refuse('slot_expired', 'That offer is too old. Check availability again.');
  const phone = verifiedPhoneOf(ctx.identity, st);
  if (!phone) return needVerification();

  const needsPhotos = slot.services.some((s) => serviceById(s)?.requiresPhotos);
  if (needsPhotos && st.photos.length < bookingConfig.photos.minForDents) {
    return refuse('needs_photos', `Dent work needs at least ${bookingConfig.photos.minForDents} photos before it can be booked. Ask for photos first.`, { photos_attached: st.photos.length });
  }
  const quoteOk = st.quote && st.quote.id && st.quote.sizeClass === slot.sizeClass && st.quote.services.every((s) => slot.services.includes(s));
  const a = st.attribution?.last ?? {};
  const parsed = createBookingSchema.safeParse({
    services: slot.services, addons: slot.addons, sizeClass: slot.sizeClass,
    vehicle: { year: inp.vehicle.year, make: inp.vehicle.make, model: inp.vehicle.model, color: inp.vehicle.color },
    photoPaths: needsPhotos ? st.photos.map((p) => p.path).slice(0, bookingConfig.photos.max) : [],
    quoteId: quoteOk ? st.quote!.id! : undefined, zip: slot.zip, startsAt: slot.startsAt, techId: slot.techId,
    // SMS consent is NEVER inferred from a chat: reminders by text need the explicit checkbox flow on /book. Email still works.
    contact: { name: inp.name, phone, email: inp.email, addressLine: inp.address_line, notes: inp.notes, smsConsent: false },
    attribution: { ...a, landing_page: a.landing_page },
  });
  if (!parsed.success) return fail('Some details are missing or invalid.', { fields: parsed.error.issues.slice(0, 6).map((i) => ({ field: i.path.join('.'), problem: i.message })) });

  const key = `cc${ctx.rec.conv.id.replace(/-/g, '')}${slot.id}`.slice(0, 80);
  let res: Awaited<ReturnType<typeof createBooking>>;
  try { res = await createBooking(parsed.data, key, ctx.now); }
  catch (e) {
    if (e instanceof BookingError) {
      if (e.code === 'slot_unavailable') st.offered = st.offered.filter((o) => o.id !== slot.id);
      return refuse(e.code, e.message, e.code === 'slot_unavailable' ? { next: 'Check availability again and offer other times.' } : {});
    }
    throw e;
  }
  const { booking } = res;
  st.offered = st.offered.filter((o) => o.id !== slot.id);
  if (!st.bookingIds.includes(booking.id)) st.bookingIds.push(booking.id);
  st.collected.name = inp.name; st.collected.email = inp.email; st.collected.vehicle = { year: inp.vehicle.year, make: inp.vehicle.make, model: inp.vehicle.model };

  // One lead per conversation: fold the lead createBooking made into the chat's lead (source chat/sms, attribution kept).
  const db = repo();
  const convLeadId = ctx.rec.conv.lead_id;
  if (!res.replay && convLeadId && booking.lead_id && booking.lead_id !== convLeadId) {
    const dup = booking.lead_id;
    await db.bookings.update(booking.id, { lead_id: convLeadId });
    await db.leads.remove(dup).catch(() => undefined);
  } else if (!convLeadId && booking.lead_id) {
    ctx.rec.conv = await db.conversations.update(ctx.rec.conv.id, { lead_id: booking.lead_id });
    await db.leads.update(booking.lead_id, { source: ctx.identity.channel === 'sms' ? 'sms' : 'chat' }); // createBooking labelled it 'direct'
  }
  await ensureLead(ctx.rec, ctx.identity.channel, { name: inp.name, email: inp.email, phone, zip: slot.zip, customer_id: booking.customer_id ?? null, stage: 'quoted' });
  if (booking.customer_id && ctx.rec.conv.customer_id !== booking.customer_id) ctx.rec.conv = await db.conversations.update(ctx.rec.conv.id, { customer_id: booking.customer_id });

  ctx.turnLog.done.create_booking = booking.status === 'confirmed' ? 'confirmed' : 'pending_deposit';
  return {
    ok: true,
    data: {
      status: booking.status, booking_id: booking.id, when: slotLabel(Date.parse(booking.starts_at)), services: plainNames(booking.services),
      price_low: booking.price_low ?? null, price_high: booking.price_high ?? null, travel_fee: booking.travel_fee, deposit: booking.deposit_amount,
      hold_minutes: bookingConfig.holdMinutes, estimate_label: ESTIMATE_LABEL, needs_inspection_price: booking.needs_review,
      note: 'Time is HELD, not confirmed. Call send_deposit_link now; the booking is confirmed only when the deposit is paid.',
    },
  };
};

const send_deposit_link: Runner<'send_deposit_link'> = async ({ booking_id }, ctx) => {
  const st = ctx.rec.state;
  let b: BookingRow | null = null;
  if (st.bookingIds.includes(booking_id)) b = await repo().bookings.get(booking_id);
  else {
    const acc = await authorizeBooking({ identity: ctx.identity, state: st, bookingId: booking_id, now: ctx.now });
    if (!acc.ok) return acc.reason === 'verification_required' ? needVerification() : refuse('not_accessible', "I can't access that booking from this chat.");
    b = acc.booking;
  }
  if (!b) return refuse('not_accessible', "I can't access that booking from this chat.");
  if (b.status === 'confirmed') return { ok: true, data: { status: 'already_confirmed', message: 'The deposit is already paid; the booking is confirmed.' } };
  if (b.status !== 'pending_deposit') return refuse('not_payable', 'That booking is not waiting for a deposit.');
  if (b.hold_expires_at && Date.parse(b.hold_expires_at) <= ctx.now) return refuse('hold_expired', 'The 15-minute hold on that time ran out. Check availability again and hold a new time.');
  const url = `${baseUrl()}/booking/${toManage(b)}`;
  ctx.turnLog.urls.add(url);
  ctx.turnLog.done.send_deposit_link = true;
  const mins = b.hold_expires_at ? Math.max(1, Math.round((Date.parse(b.hold_expires_at) - ctx.now) / MIN)) : bookingConfig.holdMinutes;
  return {
    ok: true,
    data: { status: 'sent', deposit_url: url, deposit: b.deposit_amount, hold_minutes_left: mins, note: 'Give the customer this link. Say the time is held and locked in once the deposit is paid.' },
    ui: [{ type: 'booking_hold', bookingId: b.id, when: slotLabel(Date.parse(b.starts_at)), services: plainNames(b.services), holdMinutes: mins, deposit: b.deposit_amount, depositUrl: url, priceLow: b.price_low ?? null, priceHigh: b.price_high ?? null, estimateLabel: ESTIMATE_LABEL }],
  };
};

const lookup_booking: Runner<'lookup_booking'> = async ({ phone }, ctx) => {
  const verified = verifiedPhoneOf(ctx.identity, ctx.rec.state);
  if (!verified) return needVerification();
  if (phone !== undefined) {
    const asked = normalizePhone(phone);
    if (!asked || asked !== verified) {
      // Same answer whether or not that other number has bookings: nothing to enumerate.
      return refuse('not_verified_for_that_number', 'I can only look up bookings for the phone number verified in this chat. I cannot share details for any other number.');
    }
  }
  const rows = (await bookingsForVerifiedPhone(verified)).slice(0, 5);
  const items = rows.map((b) => bookingSummary(b, ctx.now));
  return {
    ok: true,
    data: { status: 'ok', count: items.length, bookings: items, note: items.length ? undefined : 'No bookings found for this number.' },
    ui: items.length ? [{ type: 'booking_list', bookings: items.map((i) => ({ id: i.booking_id, when: i.when, services: i.services, status: i.status })) }] : undefined,
  };
};

const reschedule_booking: Runner<'reschedule_booking'> = async (inp, ctx) => {
  const st = ctx.rec.state;
  const acc = await authorizeBooking({ identity: ctx.identity, state: st, bookingId: inp.booking_id, token: inp.manage_token, now: ctx.now });
  if (!acc.ok) return acc.reason === 'verification_required' ? needVerification() : refuse('not_accessible', "I can't access that booking from this chat.");
  const b = acc.booking;
  const slot = st.offered.find((o) => o.id === inp.slot_id);
  if (!slot || slot.forBookingId !== b.id) return refuse('slot_not_offered', 'That time was not offered for this booking in this chat. Call check_availability with this booking_id and offer one of those times.');
  if (ctx.now - slot.offeredAt > conciergeConfig.slotTtlMs) return refuse('slot_expired', 'That offer is too old. Check availability again.');
  const pol = { status: b.status as BookingStatus, startsAt: Date.parse(b.starts_at), depositPaid: b.deposit_status === 'paid', rescheduleCount: b.reschedule_count };
  const d = evaluateReschedule(pol, ctx.now);
  if (!d.allowed) return refuse(d.reason, decisionMessage(d), { next: 'Offer to pass this to the owners with escalate_to_human; do not promise anything.' });
  try {
    const moved = await rescheduleBooking(toManage(b), slot.startsAt, slot.techId, ctx.now);
    st.offered = st.offered.filter((o) => o.forBookingId !== b.id);
    ctx.turnLog.done.reschedule_booking = true;
    return {
      ok: true,
      data: {
        status: 'rescheduled', booking_id: moved.id, new_time: slotLabel(Date.parse(moved.starts_at)), deposit_status: moved.deposit_status,
        note: d.late
          ? 'Done. Your deposit moves to the new time. This change was inside the 24-hour window, so it is no longer free to change again; the owners can confirm anything beyond that. Do not promise a refund.'
          : 'Done. Free, and your deposit moves with the booking.',
      },
    };
  } catch (e) {
    if (e instanceof BookingError) return refuse(e.code, e.message);
    throw e;
  }
};

const OUTCOME_TEXT = { refund: 'the deposit would be refunded', credit: `the deposit would become a credit toward a future visit (valid ${depositPolicy.creditValidDays} days)`, forfeit: 'the deposit would be kept to cover the reserved time', none: 'no deposit is affected' } as const;

const cancel_booking: Runner<'cancel_booking'> = async (inp, ctx) => {
  const st = ctx.rec.state;
  const acc = await authorizeBooking({ identity: ctx.identity, state: st, bookingId: inp.booking_id, token: inp.manage_token, now: ctx.now });
  if (!acc.ok) return acc.reason === 'verification_required' ? needVerification() : refuse('not_accessible', "I can't access that booking from this chat.");
  const b = acc.booking;
  const pol = { status: b.status as BookingStatus, startsAt: Date.parse(b.starts_at), depositPaid: b.deposit_status === 'paid', rescheduleCount: b.reschedule_count };
  const d = evaluateCancel(pol, ctx.now);
  if (!d.allowed) return refuse(d.reason, decisionMessage(d));
  const pending = st.pendingConfirm;
  const confirmedEarlier = pending && pending.action === 'cancel' && pending.bookingId === b.id && pending.turn < ctx.turn;
  if (!inp.confirmed || !confirmedEarlier) {
    st.pendingConfirm = { action: 'cancel', bookingId: b.id, turn: ctx.turn };
    return {
      ok: true,
      data: {
        status: 'confirmation_required', when: slotLabel(Date.parse(b.starts_at)), deposit_outcome: d.depositOutcome, outcome_text: OUTCOME_TEXT[d.depositOutcome],
        note: inp.confirmed ? 'The customer has not confirmed in a separate message yet. Tell them the outcome and ask for a clear yes. Call again with confirmed=true only after they reply.' : 'Tell the customer exactly what happens to the deposit and ask them to confirm. Nothing is cancelled yet.',
      },
    };
  }
  try {
    const r = await cancelBooking(toManage(b), inp.reason, ctx.now);
    st.pendingConfirm = undefined;
    ctx.turnLog.done.cancel_booking = true;
    return { ok: true, data: { status: 'cancelled', deposit_outcome: r.depositOutcome, outcome_text: OUTCOME_TEXT[r.depositOutcome as keyof typeof OUTCOME_TEXT] ?? 'no deposit is affected' } };
  } catch (e) {
    if (e instanceof BookingError) return refuse(e.code, e.message);
    throw e;
  }
};

const create_lead: Runner<'create_lead'> = async (inp, ctx) => {
  const phone = ctx.identity.phoneVerified && ctx.identity.phone ? ctx.identity.phone : normalizePhone(inp.phone);
  if (inp.phone && !phone) return fail('That phone number does not look valid.');
  const notes = [inp.reason !== 'general' ? `Reason: ${inp.reason}` : '', inp.services?.length ? `Wants: ${plainNames(inp.services).join(', ')}` : '', inp.notes ? sanitizeUntrusted(inp.notes, 300).text : ''].filter(Boolean).join(' | ');
  const area = inp.zip ? assessZip(inp.zip) : null;
  rememberSelection(ctx, { services: inp.services, zip: inp.zip });
  if (inp.name) ctx.rec.state.collected.name = inp.name;
  if (inp.email) ctx.rec.state.collected.email = inp.email;
  const lead = await ensureLead(ctx.rec, ctx.identity.channel, { name: inp.name, phone, email: inp.email, zip: inp.zip, notes, area_status: area?.status });
  return { ok: true, data: { status: 'saved', lead_saved: true, lead_ref: lead.id.slice(0, 8), message: 'Saved. The owners will follow up.' } };
};

const escalate_to_human: Runner<'escalate_to_human'> = async (inp, ctx) => {
  const { texted } = await escalate(ctx.rec, ctx.identity, inp.reason as EscalationReason, inp.summary, ctx.now);
  ctx.turnLog.done.escalate = true;
  return { ok: true, data: { status: 'escalated', owners_texted: texted, message: 'The owners have the conversation and will follow up directly. Tell the customer that, briefly. Do not argue or promise outcomes.' }, ui: [{ type: 'handoff', reason: inp.reason }] };
};

const RUNNERS: { [K in ToolName]: Runner<K> } = {
  get_services, check_service_area, get_quote_range, check_availability, create_booking, send_deposit_link,
  reschedule_booking, cancel_booking, lookup_booking, create_lead, escalate_to_human,
};

/** Validate, run, sanitise. Never throws: failures become tool errors the model can read (no internals, no PII). */
export async function executeTool(name: string, rawInput: unknown, ctx: ToolContext): Promise<ToolOutcome> {
  if (!(TOOL_NAMES as string[]).includes(name)) return fail(`Unknown tool.`);
  const tool = name as ToolName;
  const parsed = toolSchemas[tool].safeParse(rawInput ?? {});
  if (!parsed.success) return fail('Invalid tool input.', { fields: parsed.error.issues.slice(0, 6).map((i) => ({ field: i.path.join('.'), problem: i.message })) });
  try {
    const out = await (RUNNERS[tool] as Runner<ToolName>)(parsed.data as never, ctx);
    return { ...out, data: sanitizeDeep(out.data) };
  } catch (e) {
    log('error', 'concierge.tool_error', { tool, error: (e as Error).name, detail: (e as Error).message?.slice(0, 120) });
    return fail('That did not work on my side. Offer to pass it to the owners with escalate_to_human.');
  }
}

