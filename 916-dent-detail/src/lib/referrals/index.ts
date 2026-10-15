// Referral codes + credit ledger.
//  * Every customer can have one code (ensureReferralCode). The credit amount comes from config/pricing.ts (referralCredit).
//  * A NEW customer who books with someone's code gets that amount off their first invoice ("referred discount").
//  * When that first job is finished, the REFERRER earns the same amount as an `available` ledger credit; the next invoice
//    for the referrer redeems available credits (whole credits only, never below $0).
//  * The ledger is referral_credits: pending/available -> redeemed (with the booking that used it) | void.
import { referralCredit } from '@/config/pricing';
import { repo, type Customer, type ReferralCode, type ReferralCredit } from '@/lib/db';
import { logEvent } from '@/lib/admin/events';
import { round2 } from '@/lib/admin/format';
import type { LineItem } from '@/lib/admin/invoice';
import { normalizePhone } from '@/lib/sms';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
export const CODE_RE = /^[A-Z0-9]{4,12}$/;
export const normalizeCode = (raw: string | null | undefined): string => (raw ?? '').toUpperCase().replace(/[\s-]/g, '');

export function randomCode(len = 6, rnd: () => number = Math.random): string {
  let s = '';
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(rnd() * ALPHABET.length)];
  return s;
}

export async function ensureReferralCode(customerId: string): Promise<ReferralCode> {
  const db = repo();
  const ex = await db.referral_codes.first({ where: { customer_id: customerId } });
  if (ex) return ex;
  for (let i = 0; i < 8; i++) {
    const code = randomCode();
    if (await db.referral_codes.first({ where: { code } })) continue;
    return db.referral_codes.insert({ code, customer_id: customerId, credit_amount: referralCredit, active: true });
  }
  throw new Error('could not generate a unique referral code');
}

export type ReferralVerdict =
  | { valid: true; code: string; creditAmount: number; referrerCustomerId: string | null }
  | { valid: false; reason: 'invalid_format' | 'unknown' | 'inactive' | 'self' | 'existing_customer' };

export const REASON_TEXT: Record<Exclude<ReferralVerdict, { valid: true }>['reason'], string> = {
  invalid_format: 'That code does not look right. Codes are letters and numbers.',
  unknown: 'We could not find that code.',
  inactive: 'That code is no longer active.',
  self: 'You cannot use your own code.',
  existing_customer: 'Referral credit is for new customers only.',
};

/** Pure decision (unit tested). */
export function evaluateReferral(i: {
  rawCode: string; row: Pick<ReferralCode, 'code' | 'active' | 'credit_amount' | 'customer_id'> | null;
  referredCustomerId?: string | null; referredIsExisting: boolean;
}): ReferralVerdict {
  const code = normalizeCode(i.rawCode);
  if (!CODE_RE.test(code)) return { valid: false, reason: 'invalid_format' };
  if (!i.row) return { valid: false, reason: 'unknown' };
  if (!i.row.active) return { valid: false, reason: 'inactive' };
  if (i.referredCustomerId && i.row.customer_id && i.referredCustomerId === i.row.customer_id) return { valid: false, reason: 'self' };
  if (i.referredIsExisting) return { valid: false, reason: 'existing_customer' };
  return { valid: true, code: i.row.code, creditAmount: i.row.credit_amount, referrerCustomerId: i.row.customer_id ?? null };
}

async function hasCompletedJob(customerId: string): Promise<boolean> {
  return Boolean(await repo().bookings.first({ where: { customer_id: customerId, status: 'completed' } }));
}

/** Validate a code for a (possibly not yet known) customer identified by phone/email/id. No side effects. */
export async function validateReferralCode(rawCode: string, who: { customerId?: string | null; phone?: string | null; email?: string | null } = {}): Promise<ReferralVerdict> {
  const db = repo();
  const code = normalizeCode(rawCode);
  const row = CODE_RE.test(code) ? await db.referral_codes.first({ where: { code } }) : null;
  const phone = normalizePhone(who.phone);
  const email = who.email?.trim().toLowerCase() || null;
  let cust: Customer | null = who.customerId ? await db.customers.get(who.customerId) : null;
  cust ??= phone ? await db.customers.first({ where: { phone } }) : null;
  cust ??= email ? await db.customers.first({ where: { email } }) : null;
  return evaluateReferral({ rawCode, row, referredCustomerId: cust?.id ?? null, referredIsExisting: cust ? await hasCompletedJob(cust.id) : false });
}

/** Remember which code a customer used (first one wins). Used by the public apply API and by admin. */
export async function applyReferralToCustomer(customerId: string, rawCode: string): Promise<ReferralVerdict> {
  const v = await validateReferralCode(rawCode, { customerId });
  if (!v.valid) return v;
  const c = await repo().customers.get(customerId);
  if (!c) return { valid: false, reason: 'unknown' };
  if (!c.referral_code_used) {
    await repo().customers.update(customerId, { referral_code_used: v.code });
    await logEvent('referral.code_applied', 'customer', customerId, 'system', { code: v.code });
  }
  return v;
}

export const creditLineId = (kind: 'refd' | 'refc', id: string) => `${kind}-${id}`;
export const isReferralLine = (l: Pick<LineItem, 'id'>) => l.id.startsWith('refd-') || l.id.startsWith('refc-');

export type CreditPreview = { lines: LineItem[]; redeemCreditIds: string[]; referredDiscount: { code: string; amount: number } | null };

/**
 * Credit lines for a customer's invoice given the subtotal BEFORE credits. Deterministic ids, so recomputing replaces
 * rather than duplicates. Whole credits only; never takes the invoice below $0.
 */
export async function previewCredits(customerId: string, subtotalBeforeCredits: number): Promise<CreditPreview> {
  const db = repo();
  const out: CreditPreview = { lines: [], redeemCreditIds: [], referredDiscount: null };
  let room = round2(subtotalBeforeCredits);
  const cust = await db.customers.get(customerId);
  if (!cust) return out;
  // 1) referred discount: once, on the first job of a new customer who arrived with a valid code
  if (cust.referral_code_used && !(await hasCompletedJob(customerId))) {
    const used = await db.events.first({ where: { type: 'referral.referred_discount_used', entity_id: customerId } });
    const v = used ? null : await validateReferralCode(cust.referral_code_used, { customerId });
    if (v && v.valid && room >= v.creditAmount) {
      out.lines.push({ id: creditLineId('refd', customerId), label: `Referral credit (code ${v.code})`, amount: -v.creditAmount, qty: 1, kind: 'credit' });
      out.referredDiscount = { code: v.code, amount: v.creditAmount };
      room = round2(room - v.creditAmount);
    }
  }
  // 2) the customer's own earned credits
  const code = await db.referral_codes.first({ where: { customer_id: customerId } });
  if (code) {
    const avail = await db.referral_credits.list({ where: { referral_code_id: code.id, status: 'available' }, orderBy: 'created_at' });
    for (const c of avail) {
      if (c.amount > room) break;
      out.lines.push({ id: creditLineId('refc', c.id), label: 'Referral credit earned', amount: -c.amount, qty: 1, kind: 'credit' });
      out.redeemCreditIds.push(c.id);
      room = round2(room - c.amount);
    }
  }
  return out;
}

/** Called once when a job is finished: redeem credits that are on the invoice, record the discount, credit the referrer. */
export async function commitCredits(o: { customerId: string; bookingId: string; invoiceLines: LineItem[] }): Promise<{ redeemed: number; referrerCreditId: string | null }> {
  const db = repo();
  let redeemed = 0;
  for (const l of o.invoiceLines) {
    if (l.id.startsWith('refc-')) {
      const id = l.id.slice(5);
      const r = await db.referral_credits.updateIf(id, { status: 'available' }, { status: 'redeemed', redeemed_booking_id: o.bookingId });
      if (r) redeemed++;
    }
  }
  const cust = await db.customers.get(o.customerId);
  let referrerCreditId: string | null = null;
  if (cust?.referral_code_used) {
    const used = o.invoiceLines.some((l) => l.id === creditLineId('refd', o.customerId));
    if (used) await logEvent('referral.referred_discount_used', 'customer', o.customerId, 'system', { code: cust.referral_code_used });
    const code = await db.referral_codes.first({ where: { code: normalizeCode(cust.referral_code_used) } });
    const first = !(await db.bookings.list({ where: { customer_id: o.customerId, status: 'completed' }, limit: 2 })).some((b) => b.id !== o.bookingId);
    if (code && code.active && code.customer_id !== o.customerId && first) {
      const existing = await db.referral_credits.first({ where: { referral_code_id: code.id, referred_customer_id: o.customerId } });
      if (!existing) {
        const row: ReferralCredit = await db.referral_credits.insert({ referral_code_id: code.id, referred_customer_id: o.customerId, amount: code.credit_amount, status: 'available' });
        referrerCreditId = row.id;
        await logEvent('referral.credit_earned', 'customer', code.customer_id ?? o.customerId, 'system', { amount: code.credit_amount });
      }
    }
  }
  return { redeemed, referrerCreditId };
}
