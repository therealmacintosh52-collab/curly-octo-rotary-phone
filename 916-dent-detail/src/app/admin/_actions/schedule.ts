'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { ADDON_IDS, SERVICE_IDS, SIZE_CLASS_IDS } from '@/config/booking';
import { HttpError } from '@/lib/admin/api';
import { actorOf } from '@/lib/admin/events';
import { localInputToIso } from '@/lib/admin/format';
import { LEAD_SOURCES, findOrCreateCustomer } from '@/lib/admin/pipeline';
import { saveVehicleRecord } from '@/lib/admin/records';
import { addBlackout, addBlock, adminCancel, adminReschedule, createManualBooking, toggleWeather } from '@/lib/admin/schedule';
import { resetSettings, saveSettings, settingsSchema, type SettingsOverride } from '@/lib/admin/settings';
import { repo, type LeadSource } from '@/lib/db';
import { checkbox, optNum, optText, parseForm, reqText, run, STAFF, uuid } from './util';
import type { ActionResult } from '../_ui/forms';

const isoOrDate = z.string().min(1, 'Pick a time.');

export async function createBookingAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const i = parseForm(z.object({
      customerId: z.string().optional(), leadId: z.string().optional(), quoteId: z.string().optional(), vehicleId: z.string().optional(),
      vYear: optNum, vMake: optText(40), vModel: optText(40), sizeClass: z.enum(SIZE_CLASS_IDS), zip: z.string().trim().regex(/^\d{5}$/, 'Enter a 5-digit ZIP.'),
      addressLine: reqText('Address', 120), techId: z.string().optional(), startsAt: isoOrDate, customStart: z.string().optional(), override: checkbox,
      durationMin: optNum, deposit: z.enum(['none', 'collected']), depositMethod: z.string().max(20).optional(), notify: checkbox, notes: optText(500),
      source: z.string().optional(), key: z.string().min(8).max(80),
    }), fd);
    const services = fd.getAll('services').map(String).filter((x) => (SERVICE_IDS as readonly string[]).includes(x));
    const addons = fd.getAll('addons').map(String).filter((x) => (ADDON_IDS as readonly string[]).includes(x));
    if (!services.length) throw new HttpError(400, 'services', 'Choose at least one service.');
    const lead = i.leadId ? await repo().leads.get(i.leadId) : null;
    let customerId = i.customerId || lead?.customer_id || '';
    if (!customerId && lead) customerId = (await findOrCreateCustomer({ name: lead.name ?? 'Customer', phone: lead.phone, email: lead.email })).customer.id;
    if (!customerId) throw new HttpError(400, 'customer', 'Choose a customer first.');
    if (lead && !lead.customer_id) await repo().leads.update(lead.id, { customer_id: customerId });
    let vehicleId = i.vehicleId || null;
    if (!vehicleId && (i.vMake || i.vModel)) vehicleId = (await saveVehicleRecord(customerId, { year: i.vYear, make: i.vMake, model: i.vModel, sizeClass: i.sizeClass }, actorOf(s))).id;
    let startsAt = i.startsAt;
    if (i.override && i.customStart) { const iso = localInputToIso(i.customStart); if (!iso) throw new HttpError(400, 'time', 'That date and time does not exist.'); startsAt = iso; }
    const src = (LEAD_SOURCES as string[]).includes(i.source ?? '') ? (i.source as LeadSource) : undefined;
    const r = await createManualBooking({
      customerId, vehicleId, leadId: lead?.id ?? null, quoteId: i.quoteId || null, services, addons, sizeClass: i.sizeClass, startsAt, techId: i.techId || null, zip: i.zip,
      addressLine: i.addressLine, notes: i.notes ?? null, source: src, deposit: i.deposit, depositMethod: i.depositMethod, notifyCustomer: i.notify, override: i.override,
      durationMin: i.override ? i.durationMin ?? null : null, idempotencyKey: i.key,
    }, actorOf(s));
    revalidatePath('/admin/schedule'); revalidatePath('/admin/pipeline');
    redirect(`/admin/bookings/${r.booking.id}?created=1`);
  });
}

export async function rescheduleAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const i = parseForm(z.object({ id: uuid, startsAt: z.string().optional(), customStart: z.string().optional(), techId: z.string().optional(), override: checkbox, notify: checkbox }), fd);
    let startsAt = i.startsAt || '';
    if (i.override && i.customStart) { const iso = localInputToIso(i.customStart); if (!iso) throw new HttpError(400, 'time', 'That date and time does not exist.'); startsAt = iso; }
    if (!startsAt) throw new HttpError(400, 'time', 'Pick a new time.');
    await adminReschedule(i.id, { startsAt, techId: i.techId || null, override: i.override, notifyCustomer: i.notify }, actorOf(s));
    revalidatePath(`/admin/bookings/${i.id}`); revalidatePath('/admin/schedule');
    redirect(`/admin/bookings/${i.id}?moved=1`);
  });
}

export async function cancelBookingAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const i = parseForm(z.object({ id: uuid, reason: reqText('Reason', 200), initiatedBy: z.enum(['customer', 'us']), choice: z.enum(['policy', 'refund', 'credit', 'keep']), noShow: checkbox, notify: checkbox }), fd);
    await adminCancel(i.id, { reason: i.reason, initiatedBy: i.initiatedBy, choice: i.choice, noShow: i.noShow, notifyCustomer: i.notify }, actorOf(s));
    revalidatePath(`/admin/bookings/${i.id}`); revalidatePath('/admin/schedule'); revalidatePath('/admin/pipeline');
    redirect(`/admin/bookings/${i.id}?cancelled=1`);
  });
}

export async function addBlockAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const i = parseForm(z.object({ techId: z.string().optional(), start: z.string(), end: z.string(), reason: optText(120) }), fd);
    const a = localInputToIso(i.start), b = localInputToIso(i.end);
    if (!a || !b) throw new HttpError(400, 'time', 'Enter a start and an end time.');
    await addBlock({ techId: i.techId || null, startsAt: a, endsAt: b, reason: i.reason }, actorOf(s));
    revalidatePath('/admin/schedule/settings'); revalidatePath('/admin/schedule');
    return { message: 'Time blocked.' };
  });
}
export async function deleteRowAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async () => {
    const i = parseForm(z.object({ table: z.enum(['admin_blocks', 'blackout_dates']), id: uuid }), fd);
    await repo()[i.table].remove(i.id);
    revalidatePath('/admin/schedule/settings'); revalidatePath('/admin/schedule');
    return { message: 'Removed.' };
  });
}
export async function addBlackoutAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const i = parseForm(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date.'), techId: z.string().optional(), reason: optText(120) }), fd);
    await addBlackout({ date: i.date, techId: i.techId || null, reason: i.reason }, actorOf(s));
    revalidatePath('/admin/schedule/settings'); revalidatePath('/admin/schedule');
    return { message: 'Day closed.' };
  });
}
export async function toggleWeatherAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const i = parseForm(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), reason: optText(60) }), fd);
    const on = await toggleWeather(i.date, i.reason ?? null, actorOf(s));
    revalidatePath('/admin/schedule/settings'); revalidatePath('/admin/schedule');
    return { message: on ? 'Weather hold on: exterior slots are hidden for that day.' : 'Weather hold cleared.' };
  });
}

export async function saveSettingsAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const num = (k: string) => { const v = String(fd.get(k) ?? '').trim(); return v === '' ? undefined : Number(v); };
    const durations: Record<string, Record<string, number>> = {};
    for (const sv of SERVICE_IDS) for (const sz of SIZE_CLASS_IDS) { const v = num(`d.${sv}.${sz}`); if (v !== undefined) (durations[sv] ??= {})[sz] = v; }
    const candidate = {
      bufferMin: num('bufferMin'), maxJobsPerTechPerDay: num('maxJobsPerTechPerDay'), minLeadHours: num('minLeadHours'), slotStepMin: num('slotStepMin'),
      multiServiceSavingsMin: num('multiServiceSavingsMin'), dentMinutes: { setup: num('dent.setup'), perPanel: num('dent.perPanel') }, durations,
    };
    const parsed = settingsSchema.safeParse(JSON.parse(JSON.stringify(candidate)));
    if (!parsed.success) throw new HttpError(400, 'invalid', `${parsed.error.issues[0]?.path.join(' › ')}: ${parsed.error.issues[0]?.message}`);
    // store only what differs from config so "falls back to config" stays true for everything you did not change
    const { mergeSettings, diffFromConfig } = await import('@/lib/admin/settings');
    await saveSettings(diffFromConfig(mergeSettings(parsed.data)) as SettingsOverride, actorOf(s));
    revalidatePath('/admin/schedule/settings');
    return { message: 'Saved. New bookings use these values straight away.' };
  });
}
export async function resetSettingsAction(): Promise<ActionResult> {
  return run(STAFF, async (s) => { await resetSettings(actorOf(s)); revalidatePath('/admin/schedule/settings'); return { message: 'Back to the config defaults.' }; });
}
