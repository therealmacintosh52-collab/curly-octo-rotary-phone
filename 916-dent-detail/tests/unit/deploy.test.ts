// `npm run deploy`: dry-run by default, preflight order, leave-behind only with a domain, vercel last. Nothing is executed here.
import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs module
import { buildPlan } from '../../scripts/lib/deploy-plan.mjs';

describe('deploy plan', () => {
  it('orders: leave-behind (domain only) -> doctor --production -> verify --strict-owner -> vercel deploy --prod last', () => {
    const p = buildPlan({ env: { NEXT_PUBLIC_SITE_URL: 'https://916dentdetail.com' }, yes: true, hasVercelCli: true });
    expect(p.mode).toBe('execute');
    expect(p.steps.map((s: { id: string }) => s.id)).toEqual(['leave-behind', 'doctor', 'verify', 'vercel']);
    expect(p.steps[0].skipped).toBeUndefined();
    expect(p.steps[1].args).toEqual(['scripts/doctor.mjs', '--production']);
    expect(p.steps[2].args).toEqual(['run', 'verify', '--', '--strict-owner']);
    expect(p.steps.at(-1)).toMatchObject({ cmd: 'vercel', args: ['deploy', '--prod'], deploy: true });
  });
  it('without NEXT_PUBLIC_SITE_URL the PDF step is skipped and says why; npx is used when the CLI is not installed', () => {
    const p = buildPlan({ env: {}, hasVercelCli: false });
    expect(p.mode).toBe('dry-run');
    expect(p.steps[0]).toMatchObject({ id: 'leave-behind', skipped: true });
    expect(p.steps[0].why).toMatch(/do NOT print/i);
    expect(p.steps.at(-1)).toMatchObject({ cmd: 'npx', args: ['vercel', 'deploy', '--prod'] });
  });
  it('--preflight-only never includes the deploy step', () => {
    expect(buildPlan({ env: {}, yes: true, preflightOnly: true }).steps.some((s: { deploy?: boolean }) => s.deploy)).toBe(false);
  });
  it('the CLI is a dry run by default: prints the plan, exits 0, runs nothing (no vercel, no builds)', () => {
    const out = execFileSync('node', ['scripts/deploy.mjs'], { encoding: 'utf8', env: { ...process.env, NEXT_PUBLIC_SITE_URL: '' }, timeout: 60_000 });
    expect(out).toMatch(/DRY-RUN/);
    expect(out).toMatch(/Dry run: nothing was executed/);
    expect(out).toMatch(/deploy --prod/);
    expect(out).not.toMatch(/==== /); // no step banner = nothing ran
  });
});
