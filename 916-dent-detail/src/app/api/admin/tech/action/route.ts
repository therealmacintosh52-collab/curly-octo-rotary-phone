import { z } from 'zod';
import { headers } from 'next/headers';
import { adminRoute, HttpError } from '@/lib/admin/api';
import { jobForSession } from '@/lib/admin/access';
import { actorOf } from '@/lib/admin/events';
import { checkPayLink, demoPayLink, editJobLines, finishJob, makePayLink, sendOnMyWay, snapshotFor, startJobForBooking, takePayment } from '@/lib/admin/jobs';
import { MANUAL_METHODS } from '@/lib/admin/payments';
import { addNoteRecord } from '@/lib/admin/records';
import { ok } from '@/lib/api/http';
import { ANY_ROLE } from '@/lib/auth/roles';
import { useVisit } from '@/lib/memberships';
import { repo } from '@/lib/db';

export const dynamic = 'force-dynamic';

const id = z.string().uuid();
const op = z.string().min(8).max(80);
const schema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('on_my_way'), jobId: id, etaMinutes: z.number().int().min(1).max(240).optional(), opId: op.optional() }),
  z.object({ action: z.literal('start'), jobId: id, opId: op.optional() }),
  z.object({ action: z.literal('add_addon'), jobId: id, lineId: z.string().min(8).max(80), addonId: z.string().max(40), opId: op.optional() }),
  z.object({ action: z.literal('add_custom'), jobId: id, lineId: z.string().min(8).max(80), label: z.string().trim().min(1).max(120), amount: z.number().finite(), kind: z.enum(['service', 'custom', 'discount']).optional(), opId: op.optional() }),
  z.object({ action: z.literal('set_amount'), jobId: id, lineId: z.string().min(8).max(80), amount: z.number().finite(), opId: op.optional() }),
  z.object({ action: z.literal('remove_line'), jobId: id, lineId: z.string().min(8).max(80), opId: op.optional() }),
  z.object({ action: z.literal('note'), jobId: id, noteId: id, body: z.string().trim().min(1).max(2000), opId: op.optional() }),
  z.object({ action: z.literal('pay'), jobId: id, amount: z.number().positive().max(50_000), method: z.enum(MANUAL_METHODS), reference: z.string().max(80).optional(), opId: op }),
  z.object({ action: z.literal('pay_link'), jobId: id, opId: op.optional() }),
  z.object({ action: z.literal('pay_link_check'), jobId: id, opId: op.optional() }),
  z.object({ action: z.literal('demo_pay'), jobId: id, opId: op.optional() }),
  z.object({ action: z.literal('use_visit'), jobId: id, membershipId: id, opId: op.optional() }),
  z.object({ action: z.literal('finish'), jobId: id, summary: z.string().max(500).optional(), opId: op.optional() }),
]);

/** One endpoint for every tech-view write. Every branch re-checks job access and is idempotent (outbox replays). */
export async function POST(req: Request) {
  return adminRoute('admin.tech', req, ANY_ROLE, schema, async ({ session, body: b }) => {
    const job = await jobForSession(session, b.jobId);
    const actor = actorOf(session);
    const bookingId = job.booking_id;
    if (!bookingId) throw new HttpError(409, 'no_booking', 'This job has no booking.');
    const res = await (async () => {
    switch (b.action) {
      case 'on_my_way': return ok(await sendOnMyWay(bookingId, actor, b.etaMinutes));
      case 'start': { const j = await startJobForBooking(bookingId, actor); return ok({ startedAt: j.started_at }); }
      case 'add_addon': return ok({ lines: await editJobLines(job.id, { op: 'add_addon', id: b.lineId, addonId: b.addonId }, actor) });
      case 'add_custom':
        // techs may add a custom service/extra line; a discount is an owner decision
        if (b.kind === 'discount' && session.role === 'tech') throw new HttpError(403, 'forbidden', 'Ask an owner to apply a discount.');
        return ok({ lines: await editJobLines(job.id, { op: 'add_custom', id: b.lineId, label: b.label, amount: b.amount, kind: b.kind }, actor) });
      case 'set_amount': return ok({ lines: await editJobLines(job.id, { op: 'set_amount', id: b.lineId, amount: b.amount }, actor) });
      case 'remove_line': return ok({ lines: await editJobLines(job.id, { op: 'remove', id: b.lineId }, actor) });
      case 'note': { await addNoteRecord('job', job.id, b.body, session.mode === 'live' ? session.sub : null, b.noteId); return ok({ ok: true }); }
      case 'pay': { const r = await takePayment(job.id, { amount: b.amount, method: b.method, reference: b.reference, actor, recordedBy: session.mode === 'live' ? session.sub : null, opId: b.opId }); return ok({ balance: r.math.balance, status: r.invoice.status }); }
      case 'pay_link': {
        const h = await headers(); const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
        const origin = `${h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')}://${host}`;
        return ok(await makePayLink(job.id, origin, actor));
      }
      case 'pay_link_check': return ok(await checkPayLink(job.id, actor));
      case 'demo_pay': { const r = await demoPayLink(job.id, actor); return ok({ balance: r.math.balance, status: r.invoice.status }); }
      case 'use_visit': {
        const m = await repo().memberships.get(b.membershipId);
        const bk = await repo().bookings.get(bookingId);
        if (!m || m.customer_id !== bk?.customer_id) throw new HttpError(404, 'not_found', 'Membership not found.');
        try { return ok({ left: await useVisit(m.id, bookingId, actor) }); } catch (e) { throw new HttpError(409, 'no_credits', (e as Error).message); }
      }
      case 'finish': { const r = await finishJob(job.id, actor, { summary: b.summary }); return ok({ replay: r.replay, invoiceId: r.invoice.id, number: r.invoice.number, balance: r.math.balance, status: r.invoice.status, invoiceUrl: r.invoiceUrl }); }
    }
    })();
    // every successful write returns the fresh job state so the phone never has to reload
    const data = (await res.json()) as Record<string, unknown>;
    return ok({ ...data, snapshot: await snapshotFor(job.id) });
  });
}
