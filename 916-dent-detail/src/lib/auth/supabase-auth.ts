// Live login via Supabase Auth (email + password, or email magic link). The browser never receives the service-role
// key; this module uses the ANON key only to verify credentials / tokens, then maps the user to a profiles row.
// Magic links use the implicit flow (token in the URL hash) so no PKCE verifier has to survive in a cookie: the
// callback page POSTs the access token to /api/admin/auth/session, which verifies it with auth.getUser().
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { repo, type Profile } from '@/lib/db';
import { adminEmails } from './config';
import { isAdminRole, type AdminRole } from './roles';

function anon(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, flowType: 'implicit' },
  });
}

export type AuthedUser = { id: string; email: string | null };

export async function passwordSignIn(email: string, password: string): Promise<AuthedUser | null> {
  const { data, error } = await anon().auth.signInWithPassword({ email, password });
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

/** Always resolves (never reveals whether the email exists). shouldCreateUser:false keeps strangers out. */
export async function sendMagicLink(email: string, redirectTo: string): Promise<void> {
  await anon().auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo, shouldCreateUser: false } });
}

export async function userFromAccessToken(token: string): Promise<AuthedUser | null> {
  const { data, error } = await anon().auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export type ResolvedProfile = { id: string; role: AdminRole; name: string; techId: string | null };

/**
 * profiles row -> admin identity. First sign-in by an email listed in ADMIN_EMAILS bootstraps an owner profile
 * (so the very first owner needs no SQL). Dealers, customers and unknown users get null = no admin access.
 */
export async function resolveProfile(user: AuthedUser): Promise<ResolvedProfile | null> {
  const db = repo();
  let p: Profile | null = await db.profiles.get(user.id);
  if (!p && user.email && adminEmails().includes(user.email.toLowerCase())) {
    p = await db.profiles.insert({ id: user.id, role: 'owner', full_name: user.email.split('@')[0] ?? 'Owner' });
  }
  if (!p || !isAdminRole(p.role)) return null;
  if (p.role === 'tech' && !p.tech_id) return null; // a tech without a tech record cannot do anything useful (or safely)
  return { id: p.id, role: p.role, name: p.full_name || user.email || 'Team', techId: p.tech_id ?? null };
}
