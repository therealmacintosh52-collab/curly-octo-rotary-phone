#!/usr/bin/env node
// Environment doctor: for every service, which keys are set, what is missing, and exactly which MOCK fallback is active.
// Never prints a secret value. Reads .env.local and .env (if present) plus the real environment (real env wins).
//   npm run doctor                 report; exit 1 only on dangerous misconfiguration
//   npm run doctor -- --production also fail when a service needed for launch is still in mock mode
//   npm run doctor -- --json       machine-readable
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const production = process.argv.includes('--production');
const asJson = process.argv.includes('--json');

function parseEnvFile(file) {
  const out = {};
  if (!existsSync(file)) return out;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    else v = v.replace(/\s+#.*$/, '');
    out[m[1]] = v;
  }
  return out;
}
const env = { ...parseEnvFile(join(root, '.env')), ...parseEnvFile(join(root, '.env.local')), ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined)) };
const has = (k) => Boolean(env[k] && String(env[k]).trim());
const len = (k) => String(env[k] ?? '').length;

const services = [
  {
    id: 'site', name: 'Site URL', launch: true,
    need: ['NEXT_PUBLIC_SITE_URL'], optional: ['BASE_ZIP'],
    fallback: 'Canonical URLs, sitemap, OG images, Twilio signature URL and the leave-behind QR use http://localhost:3000.',
    extra: () => (has('NEXT_PUBLIC_SITE_URL') && !/^https:\/\//.test(env.NEXT_PUBLIC_SITE_URL) ? ['NEXT_PUBLIC_SITE_URL should be https:// in production'] : []),
  },
  {
    id: 'supabase', name: 'Supabase (database, auth, photo storage)', launch: true,
    need: ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'], optional: ['SUPABASE_PHOTOS_BUCKET'],
    fallback: 'In-memory demo database with seeded data: everything resets on restart and is NOT shared between serverless instances. Photos are kept in memory. Demo logins work.',
  },
  {
    id: 'secrets', name: 'Signing secrets', launch: true,
    need: ['BOOKING_TOKEN_SECRET', 'ADMIN_SESSION_SECRET', 'CRON_SECRET'], optional: ['DEALER_SESSION_SECRET', 'ADMIN_EMAILS'],
    fallback: 'Booking links use a dev-only secret; admin sessions fall back to BOOKING_TOKEN_SECRET; cron routes answer 503 in production without CRON_SECRET.',
    extra: () => {
      const w = [];
      for (const [k, min] of [['BOOKING_TOKEN_SECRET', 32], ['ADMIN_SESSION_SECRET', 32], ['DEALER_SESSION_SECRET', 32], ['CRON_SECRET', 24]]) if (has(k) && len(k) < min) w.push(`${k} is shorter than ${min} characters`);
      if (has('SUPABASE_SERVICE_ROLE_KEY') && !has('ADMIN_EMAILS')) w.push('ADMIN_EMAILS is empty: nobody can create the first owner login (or run npm run setup:admin)');
      return w;
    },
  },
  {
    id: 'stripe', name: 'Stripe (deposits, invoices, memberships, dealer net-terms)', launch: true,
    need: ['STRIPE_SECRET_KEY', 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', 'STRIPE_WEBHOOK_SECRET'], optional: ['STRIPE_WEBHOOK_SECRET_ADMIN', 'STRIPE_DEALER_WEBHOOK_SECRET', 'STRIPE_TERMINAL_LOCATION_ID'],
    fallback: 'Mock payments: the deposit step shows "DEMO MODE: no card is charged" and a confirm button; pay links and dealer invoices are simulated.',
    extra: () => {
      const w = [];
      if (has('STRIPE_SECRET_KEY') && !/^(sk|rk)_(test|live)_/.test(env.STRIPE_SECRET_KEY)) w.push('STRIPE_SECRET_KEY does not look like a Stripe key (sk_test_/sk_live_)');
      if (has('STRIPE_SECRET_KEY') && has('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY') && /_test_/.test(env.STRIPE_SECRET_KEY) !== /_test_/.test(env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY)) w.push('secret and publishable key are from different modes (test vs live)');
      if (has('STRIPE_SECRET_KEY') && !has('STRIPE_WEBHOOK_SECRET_ADMIN')) w.push('STRIPE_WEBHOOK_SECRET_ADMIN not set: /api/admin/stripe/webhook falls back to STRIPE_WEBHOOK_SECRET (works only if that endpoint shares the secret)');
      if (has('STRIPE_SECRET_KEY') && !has('STRIPE_DEALER_WEBHOOK_SECRET')) w.push('STRIPE_DEALER_WEBHOOK_SECRET not set: the dealer webhook falls back to STRIPE_WEBHOOK_SECRET');
      return w;
    },
  },
  {
    id: 'twilio', name: 'Twilio (SMS, missed-call text-back, Concierge by text)', launch: true,
    need: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'], anyOf: [['TWILIO_FROM_NUMBER', 'TWILIO_MESSAGING_SERVICE_SID']], optional: ['OWNER_ALERT_PHONES', 'TWILIO_WEBHOOK_BASE_URL', 'SMS_REPLY_MODE'],
    fallback: 'Texts are logged and kept in an in-memory outbox, nothing is sent. The /api/sms webhook accepts unsigned requests ONLY while Supabase is also unconfigured (refused otherwise).',
    extra: () => (has('TWILIO_ACCOUNT_SID') && !/^AC[0-9a-f]{32}$/i.test(env.TWILIO_ACCOUNT_SID) ? ['TWILIO_ACCOUNT_SID should look like AC + 32 hex characters'] : []),
  },
  {
    id: 'resend', name: 'Resend (transactional email)', launch: true,
    need: ['RESEND_API_KEY', 'EMAIL_FROM'], optional: ['OWNER_ALERT_EMAILS'],
    fallback: 'Emails are logged and kept in an in-memory outbox, nothing is sent.',
    extra: () => (has('EMAIL_FROM') && !/<[^>]+@[^>]+>|^[^<>\s]+@[^<>\s]+$/.test(env.EMAIL_FROM) ? ['EMAIL_FROM should be "Name <address@your-domain>"'] : []),
  },
  {
    id: 'anthropic', name: 'Anthropic (photo quotes + 916 Concierge)', launch: true,
    need: ['ANTHROPIC_API_KEY'], optional: ['ANTHROPIC_MODEL', 'CONCIERGE_MAX_COST_USD', 'CONCIERGE_RETENTION_DAYS'],
    fallback: 'Photo quotes use a labelled DEMO rule-based range; the Concierge runs on a scripted offline policy (proves plumbing, NOT live model behaviour).',
  },
  {
    id: 'analytics', name: 'Analytics and ads', launch: false,
    need: [], anyOf: [['NEXT_PUBLIC_GA4_ID', 'NEXT_PUBLIC_META_PIXEL_ID', 'NEXT_PUBLIC_GOOGLE_ADS_ID', 'NEXT_PUBLIC_GADS_ID']],
    optional: ['GA4_API_SECRET', 'META_CAPI_ACCESS_TOKEN', 'META_TEST_EVENT_CODE', 'NEXT_PUBLIC_PRIVACY_URL', 'NEXT_PUBLIC_VERCEL_ANALYTICS'],
    fallback: 'No trackers load and no consent banner is shown. track() events still go to window.dataLayer for tests.',
  },
  {
    id: 'gcal', name: 'Google Calendar sync (one-way push)', launch: false,
    need: [], anyOf: [['GOOGLE_CALENDAR_CLIENT_EMAIL']], optional: ['GOOGLE_CALENDAR_PRIVATE_KEY', 'GOOGLE_CALENDAR_IDS'],
    fallback: 'No calendar events are written (silent no-op). Availability never reads Google, so blocks must be entered in /admin.',
    extra: () => (has('GOOGLE_CALENDAR_CLIENT_EMAIL') ? [...(has('GOOGLE_CALENDAR_PRIVATE_KEY') ? [] : ['GOOGLE_CALENDAR_PRIVATE_KEY missing: sync stays off']), ...(has('GOOGLE_CALENDAR_IDS') ? [] : ['GOOGLE_CALENDAR_IDS missing: only techs with a calendar_id column set will sync'])] : []),
  },
  {
    id: 'upstash', name: 'Upstash Redis (shared rate limits)', launch: false,
    need: [], anyOf: [['UPSTASH_REDIS_REST_URL']], optional: ['UPSTASH_REDIS_REST_TOKEN'],
    fallback: 'Per-instance in-memory rate limits (fine for one server, weaker on serverless: an attacker can spread requests across instances).',
    extra: () => (has('UPSTASH_REDIS_REST_URL') !== has('UPSTASH_REDIS_REST_TOKEN') ? ['set BOTH UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN'] : []),
  },
];

const report = [];
const dangers = [];
for (const s of services) {
  const missing = s.need.filter((k) => !has(k));
  const anyMissing = (s.anyOf ?? []).filter((g) => !g.some(has));
  const setKeys = [...s.need, ...(s.anyOf ?? []).flat(), ...(s.optional ?? [])].filter(has);
  const configured = missing.length === 0 && anyMissing.length === 0 && (s.need.length > 0 || (s.anyOf ?? []).length > 0);
  const partial = !configured && setKeys.length > 0;
  const warnings = s.extra ? s.extra() : [];
  report.push({
    id: s.id, name: s.name, status: configured ? 'live' : partial ? 'PARTIAL' : 'mock', launch: s.launch,
    missing: [...missing, ...anyMissing.map((g) => g.join(' or '))], set: setKeys, fallback: configured ? null : s.fallback, warnings,
  });
  if (partial) dangers.push(`${s.name}: partially configured (missing ${[...missing, ...anyMissing.map((g) => g.join(' or '))].join(', ')}). Partial setups behave unpredictably.`);
}
// cross-service dangers
const liveDb = has('NEXT_PUBLIC_SUPABASE_URL') && has('SUPABASE_SERVICE_ROLE_KEY');
if (env.ADMIN_DEMO_LOGIN === '1' && production) dangers.push('ADMIN_DEMO_LOGIN=1 must NOT be set on the real site (demo sign-in is email-only).');
if (env.DEALERS_DEMO_LOGIN === '1' && production) dangers.push('DEALERS_DEMO_LOGIN=1 must NOT be set on the real site.');
if (liveDb && !has('BOOKING_TOKEN_SECRET')) dangers.push('Supabase is configured but BOOKING_TOKEN_SECRET is not: booking links cannot be signed safely (the app refuses to start sending them).');
if (has('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY') && !has('STRIPE_SECRET_KEY')) dangers.push('A Stripe publishable key without the secret key: the deposit step would break.');
if (production && !has('VERCEL') && !has('TRUST_PROXY')) dangers.push('TRUST_PROXY is not set and this is not Vercel: client IPs for rate limiting default to the last X-Forwarded-For entry (hops:1). Set TRUST_PROXY=hops:N for your proxy chain, or none (SECURITY.md O-02).');
if (has('TRUST_PROXY') && !/^(vercel|none|hops:\d{1,2})$/i.test(env.TRUST_PROXY)) dangers.push('TRUST_PROXY must be vercel, none or hops:N (for example hops:1).');
if (has('CSP_MODE') && !/^(enforce|report-only|off)$/i.test(env.CSP_MODE)) dangers.push('CSP_MODE must be enforce, report-only or off.');
if (production && /^(report-only|off)$/i.test(env.CSP_MODE ?? '')) dangers.push(`CSP_MODE=${env.CSP_MODE}: the Content-Security-Policy is not enforced.`);
if (production && !has('UPSTASH_REDIS_REST_URL')) console.log('note: no UPSTASH_REDIS_REST_URL: rate limits are per server instance (fine for one instance; use Upstash on serverless).');
if (production && !liveDb) dangers.push('Production launch needs Supabase: the in-memory database loses every booking on restart.');
if (production) for (const r of report) if (r.launch && r.status === 'mock') dangers.push(`${r.name} is still in mock mode (launch needs it): ${r.missing.join(', ')}`);

if (asJson) { console.log(JSON.stringify({ report, dangers, production }, null, 2)); process.exit(dangers.length ? 1 : 0); }

const icon = { live: 'LIVE   ', mock: 'MOCK   ', PARTIAL: 'PARTIAL' };
console.log(`916 Dent & Detail: environment doctor${production ? ' (production check)' : ''}\n`);
for (const r of report) {
  console.log(`${icon[r.status]}  ${r.name}${r.launch ? '' : '  (optional)'}`);
  if (r.status !== 'live') {
    if (r.missing.length) console.log(`           missing: ${r.missing.join(', ')}`);
    console.log(`           fallback active: ${r.fallback}`);
  } else console.log(`           keys set: ${r.set.join(', ')}`);
  for (const w of r.warnings) console.log(`           warning: ${w}`);
}
console.log('');
if (dangers.length) { console.log('PROBLEMS:'); for (const d of dangers) console.log(`  - ${d}`); }
else console.log(production ? 'No blocking problems.' : 'No dangerous misconfiguration. Mock services are fine for local work; run with --production before launch.');
process.exit(dangers.length ? 1 : 0);
