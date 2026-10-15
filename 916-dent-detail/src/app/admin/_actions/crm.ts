'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { SERVICE_IDS, SIZE_CLASS_IDS } from '@/config/booking';
import { HttpError } from '@/lib/admin/api';
import { actorOf, logEvent } from '@/lib/admin/events';
import { LEAD_SOURCES, createLead, moveStage, overrideSource } from '@/lib/admin/pipeline';
import { addNoteRecord, createCustomerRecord, createQuoteRecord, saveVehicleRecord, updateCustomerRecord } from '@/lib/admin/records';
import { repo, type LeadSource, type LeadStage } from '@/lib/db';
import { checkbox, optNum, optText, parseForm, reqText, run, STAFF, uuid } from './util';
import type { ActionResult } from '../_ui/forms';

const src = z.enum(LEAD_SOURCES as [LeadSource, ...LeadSource[]]);

export async function createCustomerAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const i = parseForm(z.object({ name: reqText('Name', 80), phone: optText(30), email: z.union([z.literal(''), z.email().max(120)]).optional() }), fd);
    const { customer, duplicates } = await createCustomerRecord({ name: i.name, phone: i.phone, email: i.email || null }, actorOf(s));
    revalidatePath('/admin/customers');
    redirect(`/admin/customers/${customer.id}${duplicates.length ? '?dup=1' : ''}`);
  });
}

export async function updateCustomerAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const i = parseForm(z.object({ id: uuid, name: reqText('Name', 80), phone: optText(30), email: z.union([z.literal(''), z.email().max(120)]).optional() }), fd);
    await updateCustomerRecord(i.id, { name: i.name, phone: i.phone, email: i.email || null }, actorOf(s));
    revalidatePath(`/admin/customers/${i.id}`);
    return { message: 'Saved.' };
  });
}

export async function saveVehicleAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const i = parseForm(z.object({
      customerId: uuid, id: z.string().optional(), year: optNum, make: optText(40), model: optText(40), color: optText(30), vin: optText(20),
      sizeClass: z.enum([...SIZE_CLASS_IDS, ''] as [string, ...string[]]).optional(),
    }), fd);
    if (i.year != null && (i.year < 1950 || i.year > new Date().getFullYear() + 2)) throw new HttpError(400, 'bad_year', 'Enter a real model year.');
    if (!i.make && !i.model) throw new HttpError(400, 'vehicle_required', 'Add at least a make or model.');
    await saveVehicleRecord(i.customerId, { year: i.year, make: i.make, model: i.model, color: i.color, vin: i.vin, sizeClass: i.sizeClass || null }, actorOf(s), i.id || undefined);
    revalidatePath(`/admin/customers/${i.customerId}`);
    if (i.id) redirect(`/admin/customers/${i.customerId}`);
    return { message: 'Vehicle saved.' };
  });
}

export async function addNoteAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const i = parseForm(z.object({ entityType: z.enum(['customer', 'lead', 'vehicle', 'booking', 'job']), entityId: uuid, body: reqText('Note', 2000), path: z.string().startsWith('/admin').max(200) }), fd);
    await addNoteRecord(i.entityType, i.entityId, i.body, s.mode === 'live' ? s.sub : null);
    revalidatePath(i.path);
    return { message: 'Note added.' };
  });
}

export async function mergeCustomersAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const i = parseForm(z.object({ keepId: uuid, dropId: uuid, confirm: checkbox }), fd);
    if (!i.confirm) throw new HttpError(400, 'confirm', 'Tick the box to confirm. A merge cannot be undone.');
    const r = await repo().admin.mergeCustomers(i.keepId, i.dropId);
    await logEvent('customer.merged', 'customer', i.keepId, actorOf(s), { dropped: i.dropId, moved: r.moved });
    revalidatePath('/admin/customers');
    redirect(`/admin/customers/${i.keepId}?merged=1`);
  });
}

export async function quickAddLeadAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const i = parseForm(z.object({ name: reqText('Name', 80), phone: reqText('Phone', 30), notes: optText(300), source: src.default('door_knock') }), fd);
    const lead = await createLead({ name: i.name, phone: i.phone, notes: i.notes ?? null, source: i.source }, actorOf(s));
    revalidatePath('/admin/pipeline');
    redirect(`/admin/leads/${lead.id}?added=1`);
  });
}

export async function moveStageAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const i = parseForm(z.object({ leadId: uuid, to: z.enum(['new', 'quoted', 'booked', 'in_progress', 'done', 'reviewed', 'lost']), reason: optText(200) }), fd);
    await moveStage(i.leadId, i.to as LeadStage, actorOf(s), { reason: i.reason });
    revalidatePath('/admin/pipeline'); revalidatePath(`/admin/leads/${i.leadId}`);
    return { message: 'Moved.' };
  });
}

export async function overrideSourceAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const i = parseForm(z.object({ leadId: uuid, source: src }), fd);
    await overrideSource(i.leadId, i.source, actorOf(s));
    revalidatePath(`/admin/leads/${i.leadId}`);
    return { message: 'Source updated.' };
  });
}

export async function createQuoteAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const i = parseForm(z.object({
      leadId: z.string().optional(), customerId: z.string().optional(), vehicleId: z.string().optional(), sizeClass: z.enum(SIZE_CLASS_IDS),
      low: optNum, high: optNum, notes: optText(1000),
    }), fd);
    const services = fd.getAll('services').map(String).filter((x) => (SERVICE_IDS as readonly string[]).includes(x));
    if (i.low != null && i.low < 0) throw new HttpError(400, 'bad_price', 'Prices cannot be negative.');
    if ((i.low == null) !== (i.high == null)) throw new HttpError(400, 'bad_range', 'Enter both a low and a high price, or leave both empty for "needs review".');
    const q = await createQuoteRecord({ leadId: i.leadId || null, customerId: i.customerId || null, vehicleId: i.vehicleId || null, services, sizeClass: i.sizeClass, low: i.low ?? null, high: i.high ?? null, notes: i.notes }, actorOf(s));
    if (i.leadId) {
      const lead = await repo().leads.get(i.leadId);
      if (lead?.stage === 'new' && q.low != null) await moveStage(lead.id, 'quoted', actorOf(s)).catch(() => undefined);
    }
    revalidatePath('/admin/pipeline');
    redirect(`/admin/quotes/${q.id}`);
  });
}
