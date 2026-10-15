'use server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { HttpError } from '@/lib/admin/api';
import { actorOf, logEvent } from '@/lib/admin/events';
import { LEAD_SOURCES } from '@/lib/admin/pipeline';
import { repo, type LeadSource } from '@/lib/db';
import { optText, parseForm, run, STAFF, uuid } from './util';
import type { ActionResult } from '../_ui/forms';

export async function addAdSpendAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const i = parseForm(z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Pick a date.'), channel: z.enum(LEAD_SOURCES as [LeadSource, ...LeadSource[]]),
      spend: z.coerce.number('Enter the amount spent.').min(0, 'Spend cannot be negative.').max(1_000_000, 'That is too large.'), notes: optText(120),
    }), fd);
    if (i.date > new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)) throw new HttpError(400, 'future', 'That date is in the future.');
    const row = await repo().ad_spend.insert({ date: i.date, channel: i.channel, spend: Math.round(i.spend * 100) / 100, notes: i.notes ?? null });
    await logEvent('adspend.added', 'ad_spend', row.id, actorOf(s), { channel: i.channel, spend: row.spend });
    revalidatePath('/admin/reports');
    return { message: 'Ad spend saved.' };
  });
}

export async function deleteAdSpendAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const i = parseForm(z.object({ id: uuid }), fd);
    await repo().ad_spend.remove(i.id);
    await logEvent('adspend.deleted', 'ad_spend', i.id, actorOf(s), {});
    revalidatePath('/admin/reports');
    return { message: 'Removed.' };
  });
}
