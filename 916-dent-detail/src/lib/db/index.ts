// Repository selection by env. No keys -> in-memory mock (seeded). Keys -> Supabase.
import type { Repo } from './repo';
import { mockRepo } from './mock';
import { createSupabaseRepo } from './supabase';

export * from './types';
export * from './repo';

const G = globalThis as unknown as { __liveRepo?: Repo };

export function isSupabaseLive(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function repo(): Repo {
  if (isSupabaseLive()) {
    return (G.__liveRepo ??= createSupabaseRepo(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!));
  }
  return mockRepo();
}
