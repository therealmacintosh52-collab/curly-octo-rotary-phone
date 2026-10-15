'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { HttpError } from '@/lib/admin/api';
import { actorOf } from '@/lib/admin/events';
import { createBillingPortal } from '@/lib/stripe/subscriptions';
import { adjustVisits, cancelMembership, grantForPeriod, periodKey, startMembership, useVisit } from '@/lib/memberships';
import { ensureReferralCode } from '@/lib/referrals';
import { repo } from '@/lib/db';
import { optNum, parseForm, reqText, run, STAFF, uuid } from './util';
import type { ActionResult } from '../_ui/forms';

async function origin(): Promise<string> {
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  return `${h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')}://${host}`;
}

export async function startMembershipAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const i = parseForm(z.object({ customerId: uuid, tier: z.string().max(20) }), fd);
    const c = await repo().customers.get(i.customerId);
    if (!c) throw new HttpError(404, 'not_found', 'Customer not found.');
    const r = await startMembership(c, i.tier, await origin(), actorOf(s));
    revalidatePath(`/admin/customers/${c.id}`); revalidatePath('/admin/memberships');
    return r.mode === 'live'
      ? { message: `Send this Stripe checkout link to the customer: ${r.checkoutUrl}` }
      : { message: 'DEMO membership started (no card charged). One visit credit granted.' };
  });
}

export async function membershipAdminAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const i = parseForm(z.object({ id: uuid, op: z.enum(['use', 'grant', 'adjust', 'cancel', 'portal']), visits: optNum, note: z.string().max(120).optional() }), fd);
    const m = await repo().memberships.get(i.id);
    if (!m) throw new HttpError(404, 'not_found', 'Membership not found.');
    const actor = actorOf(s);
    let message = 'Done.';
    if (i.op === 'use') { const left = await useVisit(m.id, null, actor).catch((e: Error) => { throw new HttpError(409, 'no_credits', e.message); }); message = `Visit used. ${left} left.`; }
    else if (i.op === 'grant') { const n = await grantForPeriod(m, periodKey(), actor); message = n ? `Granted ${n} visit(s).` : 'This period was already granted.'; }
    else if (i.op === 'adjust') { if (!i.visits) throw new HttpError(400, 'visits', 'Enter how many visits to add or remove.'); await adjustVisits(m.id, i.visits, i.note || 'manual adjustment', actor); message = 'Adjusted.'; }
    else if (i.op === 'cancel') { await cancelMembership(m.id, actor); message = 'Cancelled.'; }
    else {
      const c = m.stripe_customer_id ?? (m.customer_id ? (await repo().customers.get(m.customer_id))?.stripe_customer_id : null);
      const url = c ? await createBillingPortal(c, `${await origin()}/admin/memberships`) : null;
      message = url ? `Billing portal link (send to the customer): ${url}` : 'The billing portal needs a live Stripe customer. Not available in demo mode.';
    }
    revalidatePath('/admin/memberships');
    return { message };
  });
}

export async function generateReferralCodeAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async () => {
    const i = parseForm(z.object({ customerId: uuid }), fd);
    await ensureReferralCode(i.customerId);
    revalidatePath(`/admin/customers/${i.customerId}`); revalidatePath('/admin/referrals');
    return { message: 'Code created.' };
  });
}

export async function referralAdminAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const i = parseForm(z.object({ id: uuid, op: z.enum(['deactivate', 'activate', 'void_credit']), note: reqText('Reason', 120).optional() }), fd);
    if (i.op === 'void_credit') {
      const r = await repo().referral_credits.updateIf(i.id, { status: 'available' }, { status: 'void' });
      if (!r) throw new HttpError(409, 'stale', 'That credit is no longer available to void.');
      void s;
    } else await repo().referral_codes.update(i.id, { active: i.op === 'activate' });
    revalidatePath('/admin/referrals');
    return { message: 'Updated.' };
  });
}
