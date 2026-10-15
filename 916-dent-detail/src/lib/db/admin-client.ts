// Service-role Supabase client for Storage (server only). Null when Supabase keys are absent.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const G = globalThis as unknown as { __sbAdmin?: SupabaseClient };
export function supabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return (G.__sbAdmin ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }));
}
export const photosBucket = (): string => process.env.SUPABASE_PHOTOS_BUCKET || 'photos';
