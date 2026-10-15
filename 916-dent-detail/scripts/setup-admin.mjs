#!/usr/bin/env node
// Create (or promote) an owner login.
//   npm run setup:admin -- --email you@example.com [--name "Alex"] [--role owner|admin] [--password "12+ chars"] [--dry-run]
// Live (Supabase keys in .env.local / the environment): creates the auth user with the Supabase admin API using the SERVICE ROLE key
//   (never sent anywhere but your Supabase project) and writes the profiles row with role owner. No password is invented or printed:
//   without --password you sign in with the magic link. Mock mode: prints the demo credentials. Re-running is safe.
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, runSetup, isLive } from './lib/setup-admin-core.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
function envFile(f) {
  const o = {};
  if (!existsSync(f)) return o;
  for (const l of readFileSync(f, 'utf8').split('\n')) { const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(l); if (m) o[m[1]] = m[2].replace(/^["']|["']$/g, ''); }
  return o;
}
const env = { ...envFile(join(root, '.env')), ...envFile(join(root, '.env.local')), ...process.env };
const opts = parseArgs(process.argv.slice(2));

let client = null;
if (isLive(env) && !opts.dryRun && opts.email) {
  const { createClient } = await import('@supabase/supabase-js');
  client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
const r = await runSetup(opts, { client, env });
for (const l of r.log) console.log(l);
process.exit(r.ok ? 0 : 1);
