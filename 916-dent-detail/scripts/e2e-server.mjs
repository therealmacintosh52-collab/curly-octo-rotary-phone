#!/usr/bin/env node
// Starts the PRODUCTION server in MOCK mode for Playwright / Lighthouse: no integration keys (even if the shell has some),
// demo logins on, a fixed port. Builds first when there is no build yet (or with --build).
//   node scripts/e2e-server.mjs [--port=3210] [--build]
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? '').split('=')[1] ?? d;
const port = arg('port', process.env.E2E_PORT || '3210');
const distDir = process.env.NEXT_DIST_DIR || '.next';

const KEYS = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'STRIPE_SECRET_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET', 'STRIPE_WEBHOOK_SECRET_ADMIN', 'STRIPE_DEALER_WEBHOOK_SECRET', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER',
  'TWILIO_MESSAGING_SERVICE_SID', 'RESEND_API_KEY', 'ANTHROPIC_API_KEY', 'CRON_SECRET', 'NEXT_PUBLIC_GA4_ID', 'NEXT_PUBLIC_META_PIXEL_ID', 'NEXT_PUBLIC_GOOGLE_ADS_ID',
  'NEXT_PUBLIC_GADS_ID', 'META_CAPI_ACCESS_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'OWNER_ALERT_PHONES', 'MOCK_DB_FILE', 'NEXT_PUBLIC_SITE_URL'];
const env = { ...process.env, NODE_ENV: 'production', ADMIN_DEMO_LOGIN: '1', NEXT_TELEMETRY_DISABLED: '1', PORT: port };
for (const k of KEYS) delete env[k];

if (process.argv.includes('--build') || !existsSync(join(root, distDir, 'BUILD_ID'))) {
  console.log('[e2e-server] no production build found, building...');
  const r = spawnSync('npm', ['run', 'build'], { cwd: root, stdio: 'inherit', env: { ...env, NODE_ENV: 'production' } });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
const child = spawn('npx', ['next', 'start', '-p', port], { cwd: root, stdio: 'inherit', env });
const stop = () => { child.kill('SIGTERM'); };
process.on('SIGTERM', stop); process.on('SIGINT', stop);
child.on('exit', (c) => process.exit(c ?? 0));
