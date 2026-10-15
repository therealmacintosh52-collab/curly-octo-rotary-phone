// Which login is active. Live = Supabase Auth (needs URL + anon key + service role). Demo = clearly labelled seeded
// users, OFF in production unless ADMIN_DEMO_LOGIN=1, and never available when a real database is configured.
import { isSupabaseLive } from '@/lib/db';
import { SEED_OWNER_PROFILE_ID, SEED_TECH_IDS, SEED_TECH_PROFILE_IDS } from '@/lib/db/seed';
import type { AdminRole } from './roles';

export const liveAuthConfigured = (): boolean => Boolean(isSupabaseLive() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function demoLoginEnabled(): boolean {
  if (isSupabaseLive()) return false;
  return process.env.NODE_ENV !== 'production' || process.env.ADMIN_DEMO_LOGIN === '1';
}

export type DemoUser = { id: string; label: string; role: AdminRole; name: string; techId: string | null };
export const demoUsers: DemoUser[] = [
  { id: SEED_OWNER_PROFILE_ID, label: 'DEMO Owner', role: 'owner', name: '[DEMO] Owner', techId: null },
  { id: SEED_TECH_PROFILE_IDS[0], label: 'DEMO Tech One', role: 'tech', name: '[OWNER] Tech One', techId: SEED_TECH_IDS[0] },
  { id: SEED_TECH_PROFILE_IDS[1], label: 'DEMO Tech Two', role: 'tech', name: '[OWNER] Tech Two', techId: SEED_TECH_IDS[1] },
];

export type AuthMode = 'live' | 'demo' | 'none';
export const authMode = (): AuthMode => (liveAuthConfigured() ? 'live' : demoLoginEnabled() ? 'demo' : 'none');

export const adminEmails = (): string[] => (process.env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
