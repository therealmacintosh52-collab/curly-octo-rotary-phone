// Dealer accounts: signup -> pending -> owner approval. All data through repo(); login creation through auth.ts.
import { dealerNetTerms } from '@/config/pricing';
import { log } from '@/lib/api/log';
import { repo } from '@/lib/db';
import type { Customer, Dealer } from '@/lib/db/types';
import { audit } from './audit';
import { AuthError, authMode, createLogin } from './auth';
import { isDealerServiceId } from './catalog';
import { notifyDealer, notifyOwner, portalUrl } from './notify';

export type SignupInput = {
  businessName: string; licenseNumber?: string | null; contactName: string; email: string; phone?: string | null;
  lotAddresses: string[]; apEmail: string; expectedMonthlyVolume?: number | null; netTermsRequested?: boolean; password?: string;
};

export class AccountError extends Error {
  constructor(public code: 'exists' | 'invalid' | 'not_found', message: string) { super(message); this.name = 'AccountError'; }
}

const zipOf = (addr: string | undefined) => /\b(9\d{4})\b/.exec(addr ?? '')?.[1] ?? null;

export async function signUpDealer(input: SignupInput): Promise<{ dealer: Dealer; profileId: string }> {
  const db = repo();
  const email = input.email.trim().toLowerCase();
  if (await db.dealers.first({ where: { email } })) throw new AccountError('exists', 'An account with that email already exists. Sign in instead.');
  let profileId: string;
  try { profileId = await createLogin({ email, password: input.password, name: input.contactName }); }
  catch (e) { if (e instanceof AuthError && e.code === 'exists') throw new AccountError('exists', e.message); throw e; }

  const dealer = await db.dealers.insert({
    name: input.businessName.trim(), contact_name: input.contactName.trim(), email, phone: input.phone?.trim() || null,
    address_zip: zipOf(input.lotAddresses[0]), net_terms_days: dealerNetTerms.defaultDays, wholesale_pricing: {}, status: 'pending',
    license_number: input.licenseNumber?.trim() || null, lot_addresses: input.lotAddresses.map((a) => a.trim()).filter(Boolean),
    ap_email: input.apEmail.trim().toLowerCase(), expected_monthly_volume: input.expectedMonthlyVolume ?? null,
    net_terms_requested: Boolean(input.netTermsRequested), net_terms_approved: false,
  });
  // Supabase may already have created the profile row from an auth trigger: reuse it rather than fail on a duplicate id.
  const existing = authMode() === 'supabase' ? await db.profiles.get(profileId) : null;
  if (existing) await db.profiles.update(profileId, { role: 'dealer', full_name: input.contactName.trim() });
  else await db.profiles.insert({ id: profileId, role: 'dealer', full_name: input.contactName.trim(), phone: input.phone?.trim() || null });
  await db.dealer_users.insert({ dealer_id: dealer.id, profile_id: profileId, role: 'admin' });
  await audit('dealer.signup', 'dealer', dealer.id, `dealer:${profileId}`, { net_terms_requested: dealer.net_terms_requested, volume: dealer.expected_monthly_volume ?? null });

  await notifyOwner('New dealer account waiting for approval', `${dealer.name} signed up. Review: ${portalUrl('/admin/dealers')}`);
  await notifyDealer(dealer, 'We received your dealer account request', `Thanks for signing up ${dealer.name}. We review every dealer account by hand and will email you when it is approved. After that you can submit vehicles, track them and see statements at ${portalUrl('/dealers/signin')}.`);
  log('info', 'dealer.signup', { dealer: dealer.id });
  return { dealer, profileId };
}

async function must(id: string): Promise<Dealer> {
  const d = await repo().dealers.get(id);
  if (!d) throw new AccountError('not_found', 'Dealer not found.');
  return d;
}

export async function approveDealer(id: string, opts: { netTermsApproved?: boolean; netTermsDays?: number; note?: string | null } = {}): Promise<Dealer> {
  const d = await must(id);
  const days = opts.netTermsDays ?? d.net_terms_days;
  if (!dealerNetTerms.options.includes(days) && days !== 0) throw new AccountError('invalid', `Net terms must be one of ${dealerNetTerms.options.join(', ')} days.`);
  const next = await repo().dealers.update(id, {
    status: 'active', approved_at: d.approved_at ?? new Date().toISOString(), approval_note: opts.note ?? d.approval_note ?? null,
    net_terms_approved: opts.netTermsApproved ?? d.net_terms_approved ?? false, net_terms_days: days,
  });
  await audit('dealer.approved', 'dealer', id, 'owner', { net_terms_approved: next.net_terms_approved, net_terms_days: next.net_terms_days });
  if (d.status !== 'active') await notifyDealer(next, 'Your dealer account is approved', `Your account is active. Sign in to submit vehicles, one at a time or in bulk with a CSV: ${portalUrl('/dealers/signin')}`);
  return next;
}

export async function setDealerStatus(id: string, status: 'paused' | 'rejected' | 'active' | 'pending', note?: string | null): Promise<Dealer> {
  await must(id);
  const next = await repo().dealers.update(id, { status, approval_note: note ?? null });
  await audit(`dealer.${status}`, 'dealer', id, 'owner', {});
  return next;
}

export async function setNetTerms(id: string, o: { approved: boolean; days: number }): Promise<Dealer> {
  if (!dealerNetTerms.options.includes(o.days) && o.days !== 0) throw new AccountError('invalid', `Net terms must be one of ${dealerNetTerms.options.join(', ')} days.`);
  await must(id);
  const next = await repo().dealers.update(id, { net_terms_approved: o.approved, net_terms_days: o.days });
  await audit('dealer.net_terms', 'dealer', id, 'owner', { approved: o.approved, days: o.days });
  return next;
}

/** Owner-entered per-dealer wholesale rates (whole dollars). Unknown service ids and negatives are rejected; blank clears. */
export async function setWholesaleRates(id: string, rates: Record<string, number | null>): Promise<Dealer> {
  const d = await must(id);
  const next: Record<string, unknown> = { ...(d.wholesale_pricing ?? {}) };
  for (const [k, v] of Object.entries(rates)) {
    if (!isDealerServiceId(k)) throw new AccountError('invalid', `Unknown service "${k}".`);
    if (v === null) delete next[k];
    else if (!Number.isFinite(v) || v < 0 || v > 100_000) throw new AccountError('invalid', `Rate for ${k} must be between 0 and 100000.`);
    else next[k] = Math.round(v * 100) / 100;
  }
  const out = await repo().dealers.update(id, { wholesale_pricing: next });
  await audit('dealer.rates', 'dealer', id, 'owner', { services: Object.keys(rates) });
  return out;
}

/** One customers row per dealer so jobs and vehicles show up under a real customer in the CRM. */
export async function ensureDealerCustomer(dealer: Dealer): Promise<Customer> {
  const db = repo();
  const ex = await db.customers.first({ where: { dealer_id: dealer.id } });
  if (ex) return ex;
  return db.customers.insert({ name: dealer.name, email: dealer.email ?? null, phone: dealer.phone ?? null, sms_opt_in: false, dealer_id: dealer.id });
}
