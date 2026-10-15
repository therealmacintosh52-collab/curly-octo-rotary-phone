'use server';
// Thin server actions for the owner dealer screens. Each one authorizes through requireOwner(), validates, and calls src/lib/dealers.
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { log } from '@/lib/api/log';
import { AccountError, approveDealer, setDealerStatus, setNetTerms, setWholesaleRates } from '@/lib/dealers/accounts';
import { AddonError, priceAddon, proposeAddon, withdrawAddon } from '@/lib/dealers/addons';
import { dealerServiceIds } from '@/config/pricing';
import { previousMonth } from '@/lib/dealers/billing';
import { requireOwner } from '@/lib/dealers/owner-guard';
import { BillingError, generateStatement, issueInvoice, markInvoicePaid, runMonthlyStatements, voidInvoice } from '@/lib/dealers/statements';
import { StatusError, type VehicleStatus } from '@/lib/dealers/status';
import { setVehiclePrice, setVehicleStatus, VehicleError } from '@/lib/dealers/vehicles';
import type { ActionResult } from '../_ui/forms';

const isRedirect = (e: unknown) => String((e as { digest?: unknown })?.digest ?? '').startsWith('NEXT_');

async function run(path: string, fn: () => Promise<string | void>): Promise<ActionResult> {
  try {
    await requireOwner();
    const message = await fn();
    revalidatePath('/admin/dealers'); revalidatePath(path);
    return { ok: true, message: message ?? 'Saved.' };
  } catch (e) {
    if (isRedirect(e)) throw e;
    if (e instanceof AccountError || e instanceof AddonError || e instanceof BillingError || e instanceof VehicleError || e instanceof StatusError) return { error: e.message };
    if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? 'Some fields are invalid.' };
    const err = e as Error;
    log('error', 'admin.dealers.action_failed', { error: err.name, detail: err.message?.slice(0, 160) });
    return { error: err.message && /Stripe/.test(err.message) ? err.message : 'Something went wrong. Nothing was changed, or try again.' };
  }
}

const id = z.string().uuid('Bad id.');
const money = z.string().trim().transform((v) => (v === '' ? null : Number(v))).pipe(z.number().finite().nullable());
const fd2o = (fd: FormData) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === 'string')) as Record<string, string>;
const P = (dealerId: string) => `/admin/dealers/${dealerId}`;

export async function approveAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const i = z.object({ id, terms: z.enum(['0', '15', '30']), note: z.string().trim().max(300).optional() }).parse(fd2o(fd));
  return run(P(i.id), async () => { await approveDealer(i.id, { netTermsApproved: i.terms !== '0', netTermsDays: i.terms === '0' ? 30 : Number(i.terms), note: i.note || null }); return 'Approved. The dealer was emailed.'; });
}
export async function statusAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const i = z.object({ id, status: z.enum(['paused', 'rejected', 'active', 'pending']) }).parse(fd2o(fd));
  return run(P(i.id), async () => { await setDealerStatus(i.id, i.status); return `Account is now ${i.status}.`; });
}
export async function termsAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const i = z.object({ id, terms: z.enum(['0', '15', '30']) }).parse(fd2o(fd));
  return run(P(i.id), async () => { await setNetTerms(i.id, { approved: i.terms !== '0', days: i.terms === '0' ? 30 : Number(i.terms) }); });
}
export async function ratesAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const o = fd2o(fd);
  const dealerId = id.parse(o.id);
  const rates: Record<string, number | null> = {};
  for (const k of dealerServiceIds) rates[k] = money.parse(o[k] ?? '');
  return run(P(dealerId), async () => { await setWholesaleRates(dealerId, rates); return 'Rates saved for this dealer.'; });
}
export async function vehicleStatusAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const i = z.object({ id, dealerId: id, to: z.enum(['submitted', 'scheduled', 'in_progress', 'done', 'cancelled']), when: z.string().optional() }).parse(fd2o(fd));
  return run(P(i.dealerId), async () => { await setVehicleStatus(i.id, i.to as VehicleStatus, 'owner', { scheduledAt: i.when ? new Date(i.when).toISOString() : null }); });
}
export async function vehiclePriceAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const i = z.object({ id, dealerId: id, price: money }).parse(fd2o(fd));
  return run(P(i.dealerId), async () => { await setVehiclePrice(i.id, i.price); });
}
export async function proposeAddonAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const i = z.object({ id, dealerId: id, label: z.string().trim().min(1, 'Describe the add-on.').max(80), description: z.string().trim().max(300).optional(), price: money }).parse(fd2o(fd));
  return run(P(i.dealerId), async () => { const a = await proposeAddon(i.id, { label: i.label, description: i.description, price: i.price, by: 'owner' }, 'owner'); return a.status === 'proposed' ? 'Sent to the dealer for approval.' : 'Saved as a draft: add a price to send it.'; });
}
export async function priceAddonAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const i = z.object({ id, dealerId: id, addonId: z.string().min(1), price: money.pipe(z.number('Enter a price.')) }).parse(fd2o(fd));
  return run(P(i.dealerId), async () => { await priceAddon(i.id, i.addonId, i.price as number); return 'Priced and sent to the dealer.'; });
}
export async function withdrawAddonAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const i = z.object({ id, dealerId: id, addonId: z.string().min(1) }).parse(fd2o(fd));
  return run(P(i.dealerId), async () => { await withdrawAddon(i.id, i.addonId); });
}
export async function generateStatementAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const i = z.object({ dealerId: id, month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must be YYYY-MM.') }).parse(fd2o(fd));
  return run(P(i.dealerId), async () => {
    const r = await generateStatement(i.dealerId, i.month);
    if (!r.statement) return `Nothing to bill for ${i.month}.${r.unpriced ? ` ${r.unpriced} finished vehicle(s) need a price first.` : ''}`;
    return `${r.created ? 'Statement created' : 'Statement updated'}: ${r.added} vehicle(s) added.${r.unpriced ? ` ${r.unpriced} still need a price.` : ''}`;
  });
}
export async function issueInvoiceAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const i = z.object({ dealerId: id, statementId: id }).parse(fd2o(fd));
  return run(P(i.dealerId), async () => { const inv = await issueInvoice(i.statementId); return `Invoice ${inv.number} issued${inv.mock ? ' (demo: no Stripe call)' : ''}. The dealer's AP contact was emailed.`; });
}
export async function markPaidAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const i = z.object({ dealerId: id, invoiceId: id, method: z.string().trim().max(30).optional(), reference: z.string().trim().max(60).optional() }).parse(fd2o(fd));
  return run(P(i.dealerId), async () => { await markInvoicePaid(i.invoiceId, { method: i.method || 'manual', reference: i.reference || undefined }); return 'Marked paid.'; });
}
export async function voidInvoiceAction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  const i = z.object({ dealerId: id, invoiceId: id }).parse(fd2o(fd));
  return run(P(i.dealerId), async () => { await voidInvoice(i.invoiceId); return 'Invoice voided. Its statement is open again.'; });
}
export async function runMonthlyAction(): Promise<ActionResult> {
  return run('/admin/dealers', async () => { const r = await runMonthlyStatements({ month: previousMonth() }); return `${r.month}: ${r.created} statement(s) created, ${r.updated} updated, ${r.unpricedVehicles} vehicle(s) waiting for a price, ${r.overdueMarked} invoice(s) marked overdue.`; });
}
