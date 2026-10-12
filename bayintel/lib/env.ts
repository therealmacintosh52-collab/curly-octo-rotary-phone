/** The variables without which no page can render (the Supabase client throws on an empty URL). */
export const REQUIRED_ENV = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const;

export function missingConfig(env: Record<string, string | undefined> = process.env): string[] {
  return REQUIRED_ENV.filter((k) => !(env[k] ?? "").trim());
}

export function isConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return missingConfig(env).length === 0;
}
