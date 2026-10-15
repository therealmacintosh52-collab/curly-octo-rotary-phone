'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { HttpError } from '@/lib/admin/api';
import { actorOf, logEvent } from '@/lib/admin/events';
import { round2 } from '@/lib/admin/format';
import { parseLines, type LineItem } from '@/lib/admin/invoice';
import { MANUAL_METHODS, loadInvoiceBundle, recordPayment, updateInvoiceLines } from '@/lib/admin/payments';
import { repo } from '@/lib/db';
import { createPayLink } from '@/lib/stripe/payments';
import { optNum, optText, parseForm, run, STAFF, uuid } from './util';
import type { ActionResult } from '../_ui/forms';

export async function recordPaymentAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const i = parseForm(z.object({ invoiceId: uuid, amount: z.coerce.number().positive('Enter an amount above zero.'), method: z.enum(MANUAL_METHODS), reference: optText(80), opId: z.string().max(80).optional() }), fd);
    const r = await recordPayment({ invoiceId: i.invoiceId, amount: i.amount, method: i.method, reference: i.reference, actor: actorOf(s), recordedBy: s.mode === 'live' ? s.sub : null, opId: i.opId });
    revalidatePath(`/admin/invoices/${i.invoiceId}`); revalidatePath('/admin/invoices');
    return { message: r.duplicate ? 'Already recorded.' : r.bundle.invoice.status === 'paid' ? 'Payment recorded. Invoice is paid in full.' : `Payment recorded. ${r.bundle.math.balance.toFixed(2)} still due.` };
  });
}

export async function editInvoiceLinesAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const i = parseForm(z.object({ invoiceId: uuid, newLabel: optText(120), newAmount: optNum }), fd);
    const b = await loadInvoiceBundle(i.invoiceId);
    if (!b) throw new HttpError(404, 'not_found', 'Invoice not found.');
    let lines: LineItem[] = b.lines.flatMap((l) => {
      if (fd.get(`rm.${l.id}`) === 'on') return [];
      const raw = fd.get(`amt.${l.id}`);
      const v = raw === null || raw === '' ? l.amount : Number(raw);
      if (!Number.isFinite(v) || Math.abs(v) > 50_000) throw new HttpError(400, 'amount', 'One of the amounts is not valid.');
      return [{ ...l, amount: round2(l.kind === 'discount' || l.kind === 'credit' ? -Math.abs(v) : Math.max(0, v)) }];
    });
    if (i.newLabel && i.newAmount != null && i.newAmount !== 0) lines = [...lines, { id: crypto.randomUUID(), label: i.newLabel, amount: round2(i.newAmount), qty: 1, kind: i.newAmount < 0 ? 'discount' : 'custom' }];
    await updateInvoiceLines(i.invoiceId, parseLines(lines), actorOf(s));
    revalidatePath(`/admin/invoices/${i.invoiceId}`);
    return { message: 'Invoice updated.' };
  });
}

export async function voidInvoiceAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const i = parseForm(z.object({ invoiceId: uuid }), fd);
    const b = await loadInvoiceBundle(i.invoiceId);
    if (!b) throw new HttpError(404, 'not_found', 'Invoice not found.');
    if (b.payments.some((p) => p.status === 'succeeded')) throw new HttpError(409, 'has_payments', 'This invoice has payments. Refund them first, then void.');
    await repo().invoices.update(i.invoiceId, { status: 'void' });
    await logEvent('invoice.voided', 'invoice', i.invoiceId, actorOf(s), {});
    revalidatePath(`/admin/invoices/${i.invoiceId}`); revalidatePath('/admin/invoices');
    return { message: 'Invoice voided.' };
  });
}

export async function invoicePayLinkAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return run(STAFF, async (s) => {
    const i = parseForm(z.object({ invoiceId: uuid }), fd);
    const b = await loadInvoiceBundle(i.invoiceId);
    if (!b) throw new HttpError(404, 'not_found', 'Invoice not found.');
    if (!(b.math.balance > 0)) throw new HttpError(409, 'nothing_due', 'Nothing is due on this invoice.');
    const h = await headers(); const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
    const origin = `${h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')}://${host}`;
    const link = await createPayLink({ amount: b.math.balance, description: `916 Dent & Detail ${b.invoice.number ?? 'invoice'}`, invoiceId: b.invoice.id, bookingId: b.invoice.booking_id, email: b.customer?.email, origin });
    await logEvent('invoice.pay_link_created', 'invoice', b.invoice.id, actorOf(s), { mock: link.mock });
    return { message: `${link.mock ? 'DEMO link (not a real payment page): ' : 'Send this link to the customer: '}${link.url}` };
  });
}
