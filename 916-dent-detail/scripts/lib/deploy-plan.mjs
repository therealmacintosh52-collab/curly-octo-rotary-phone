// Pure plan builder for `npm run deploy` (unit tested). Nothing here runs a command.
export function buildPlan({ env = {}, yes = false, preflightOnly = false, hasVercelCli = false } = {}) {
  const steps = [];
  const siteUrl = String(env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (siteUrl) steps.push({ id: 'leave-behind', why: `NEXT_PUBLIC_SITE_URL is set (${siteUrl}): regenerate the dealer leave-behind PDF so its QR code points at the real domain`, cmd: 'npm', args: ['run', 'leave-behind'] });
  else steps.push({ id: 'leave-behind', skipped: true, why: 'NEXT_PUBLIC_SITE_URL is not set: the committed leave-behind PDF keeps its localhost QR, so do NOT print it yet (set the domain first)' });
  steps.push({ id: 'doctor', why: 'production environment check: no demo logins, no half-configured service, launch services not in mock mode', cmd: 'node', args: ['scripts/doctor.mjs', '--production'] });
  steps.push({ id: 'verify', why: 'typecheck, lint, unit + bot tests, production build, SEO gate, owner placeholders (strict), e2e, axe', cmd: 'npm', args: ['run', 'verify', '--', '--strict-owner'] });
  if (!preflightOnly) {
    steps.push({ id: 'vercel', why: 'deploy the current directory to production on Vercel (requires `vercel login` and a linked project)', cmd: hasVercelCli ? 'vercel' : 'npx', args: [...(hasVercelCli ? [] : ['vercel']), 'deploy', '--prod'], deploy: true });
  }
  return { steps, mode: yes ? 'execute' : 'dry-run' };
}

export const afterDeploy = [
  'Open the deployment URL and run the day-1 smoke test in LAUNCH.md (book with a Stripe TEST card first if still on test keys).',
  'Stripe: confirm all THREE webhook endpoints show recent successful deliveries.',
  'Twilio: text the number, then reply STOP and START from a real phone.',
  'Keep ADMIN_DEMO_LOGIN and DEALERS_DEMO_LOGIN unset.',
];
