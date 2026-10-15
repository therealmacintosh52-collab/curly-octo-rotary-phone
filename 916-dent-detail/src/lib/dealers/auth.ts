// Small dealer auth adapter. Two modes behind one interface so it can later unify with the owner auth (Phase 3):
//   demo      no Supabase keys: NO password. Sign in with the contact email a dealer signed up with, or the seeded demo dealer.
//             Clearly labelled DEMO in the UI. Holds only mock data.
//   supabase  live: Supabase Auth email + password (admin API creates the user, signInWithPassword verifies).
// Either way a successful login yields { profileId, dealerId }; session.ts turns that into the signed cookie.
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { isSupabaseLive, repo } from '@/lib/db';
import { supabaseAdmin } from '@/lib/db/admin-client';
import { SEED_DEALER_ID } from '@/lib/db/seed';

export type AuthMode = 'demo' | 'supabase' | 'none';
/** DEMO sign-in is open to anyone who knows an email, so (like the admin demo login) it is OFF in production unless explicitly enabled. */
export const demoLoginEnabled = (): boolean => !isSupabaseLive() && (process.env.NODE_ENV !== 'production' || process.env.DEALERS_DEMO_LOGIN === '1' || process.env.ADMIN_DEMO_LOGIN === '1');
export const authMode = (): AuthMode => (isSupabaseLive() ? 'supabase' : demoLoginEnabled() ? 'demo' : 'none');

export const DEMO_DEALER_EMAIL = 'demo.dealer@example.com';
const normEmail = (e: string) => e.trim().toLowerCase();

export class AuthError extends Error {
  constructor(public code: 'exists' | 'invalid' | 'weak_password' | 'unavailable', message: string) { super(message); this.name = 'AuthError'; }
}

/** Create the login for a new dealer user and return the profile id (the auth user id in live mode). */
export async function createLogin(input: { email: string; password?: string; name: string }): Promise<string> {
  if (authMode() === 'none') throw new AuthError('unavailable', 'Dealer sign-up is not switched on yet.');
  if (authMode() === 'demo') return randomUUID();
  const sb = supabaseAdmin();
  if (!sb) throw new AuthError('unavailable', 'Sign-up is unavailable right now.');
  const pw = input.password ?? '';
  if (pw.length < 10) throw new AuthError('weak_password', 'Use a password of at least 10 characters.');
  const { data, error } = await sb.auth.admin.createUser({ email: normEmail(input.email), password: pw, email_confirm: true, user_metadata: { full_name: input.name, role: 'dealer' } });
  if (error || !data.user) {
    if (error && /already|registered|exists/i.test(error.message)) throw new AuthError('exists', 'An account with that email already exists. Sign in instead.');
    throw new AuthError('unavailable', 'Could not create the account. Try again or contact us.');
  }
  return data.user.id;
}

/** Verify credentials. Returns the auth user id (live) or the matching dealer-user profile id (demo); null = invalid. */
export async function verifyLogin(email: string, password: string): Promise<string | null> {
  const e = normEmail(email);
  if (authMode() === 'none') return null;
  if (authMode() === 'demo') {
    await ensureDemoLogin();
    const dealer = await repo().dealers.first({ where: { email: e } });
    const dealerId = dealer?.id ?? (e === DEMO_DEALER_EMAIL ? SEED_DEALER_ID : null);
    if (!dealerId) return null;
    const du = await repo().dealer_users.first({ where: { dealer_id: dealerId } });
    return du?.profile_id ?? null;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email: e, password });
  if (error || !data.user) return null;
  return data.user.id;
}

/** Make sure the seeded demo dealer has a login row so DEMO sign-in works (idempotent, mock mode only). */
export async function ensureDemoLogin(): Promise<void> {
  if (authMode() !== 'demo') return;
  const db = repo();
  const d = await db.dealers.get(SEED_DEALER_ID);
  if (!d) return;
  if (!d.email) await db.dealers.update(d.id, { email: DEMO_DEALER_EMAIL, ap_email: DEMO_DEALER_EMAIL, lot_addresses: ['[DEMO] 100 Example Auto Mall Dr, Sacramento, CA'], net_terms_approved: true });
  if (!(await db.dealer_users.first({ where: { dealer_id: d.id } }))) {
    const profile = await db.profiles.insert({ role: 'dealer', full_name: 'Demo Manager' });
    await db.dealer_users.insert({ dealer_id: d.id, profile_id: profile.id, role: 'admin' });
  }
}
