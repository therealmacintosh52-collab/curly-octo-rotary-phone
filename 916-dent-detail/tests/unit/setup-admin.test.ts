// `npm run setup:admin` core: argument parsing, validation, mock-mode output, and the live path against a fake Supabase admin client.
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain .mjs script module (no types)
import { demoInstructions, parseArgs, runSetup, validate } from '../../scripts/lib/setup-admin-core.mjs';

const LIVE = { NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-key' };
type Call = [string, unknown];
function fakeClient(existing: { id: string; email: string }[] = [], over: { createError?: string; profileError?: string } = {}) {
  const calls: Call[] = [];
  const client = {
    auth: { admin: {
      listUsers: async (p: unknown) => { calls.push(['listUsers', p]); return { data: { users: existing }, error: null }; },
      createUser: async (p: unknown) => { calls.push(['createUser', p]); return over.createError ? { data: null, error: { message: over.createError } } : { data: { user: { id: 'new-id', email: (p as { email: string }).email } }, error: null }; },
      updateUserById: async (id: string, p: unknown) => { calls.push(['updateUserById', { id, p }]); return { error: null }; },
    } },
    from: (t: string) => ({ upsert: async (row: unknown, o: unknown) => { calls.push([`upsert:${t}`, { row, o }]); return { error: over.profileError ? { message: over.profileError } : null }; } }),
  };
  return { client, calls };
}

describe('args and validation', () => {
  it('parses both --flag value and --flag=value, lowercases the email', () => {
    expect(parseArgs(['--email', 'Alex@Example.COM', '--name=Alex R', '--role', 'admin', '--dry-run'])).toMatchObject({ email: 'alex@example.com', name: 'Alex R', role: 'admin', dryRun: true });
  });
  it('rejects a missing/bad email, a bad role and a short password', () => {
    expect(validate(parseArgs([])).join()).toMatch(/email/);
    expect(validate(parseArgs(['--email', 'nope'])).join()).toMatch(/email/);
    expect(validate(parseArgs(['--email', 'a@b.co', '--role', 'god'])).join()).toMatch(/role/);
    expect(validate(parseArgs(['--email', 'a@b.co', '--password', 'short'])).join()).toMatch(/12 characters/);
    expect(validate(parseArgs(['--email', 'a@b.co']))).toEqual([]);
  });
});

describe('runSetup', () => {
  it('mock mode: prints the demo credentials and touches nothing', async () => {
    const r = await runSetup(parseArgs(['--email', 'a@b.co']), { client: null, env: {} });
    expect(r).toMatchObject({ ok: true, mode: 'mock' });
    expect(r.log.join('\n')).toMatch(/DEMO/);
    expect(r.log).toEqual(demoInstructions());
  });
  it('dry run in live mode changes nothing', async () => {
    const { client, calls } = fakeClient();
    const r = await runSetup(parseArgs(['--email', 'a@b.co', '--dry-run']), { client, env: LIVE });
    expect(r).toMatchObject({ ok: true, mode: 'dry-run' });
    expect(calls).toEqual([]);
  });
  it('live: creates a confirmed user with NO invented password and an owner profile', async () => {
    const { client, calls } = fakeClient();
    const r = await runSetup(parseArgs(['--email', 'Owner@Example.com', '--name', 'Alex']), { client, env: LIVE });
    expect(r).toMatchObject({ ok: true, mode: 'live', userId: 'new-id' });
    expect(calls.find((c) => c[0] === 'createUser')![1]).toEqual({ email: 'owner@example.com', email_confirm: true });
    expect(calls.find((c) => c[0] === 'upsert:profiles')![1]).toEqual({ row: { id: 'new-id', role: 'owner', full_name: 'Alex' }, o: { onConflict: 'id' } });
    expect(r.log.join('\n')).toMatch(/\/admin\/auth\/callback/);
    expect(JSON.stringify(r)).not.toMatch(/service-key/);
  });
  it('live: an existing user is promoted, not duplicated; --password updates it', async () => {
    const { client, calls } = fakeClient([{ id: 'u-1', email: 'Owner@Example.com' }]);
    const r = await runSetup(parseArgs(['--email', 'owner@example.com', '--role', 'admin', '--password', 'a-long-enough-pass']), { client, env: LIVE });
    expect(r.ok).toBe(true);
    expect(calls.some((c) => c[0] === 'createUser')).toBe(false);
    expect(calls.find((c) => c[0] === 'updateUserById')![1]).toEqual({ id: 'u-1', p: { password: 'a-long-enough-pass' } });
    expect((calls.find((c) => c[0] === 'upsert:profiles')![1] as { row: { role: string } }).row.role).toBe('admin');
    expect(JSON.stringify(r.log)).not.toContain('a-long-enough-pass'); // never echoed
  });
  it('live: failures are reported with a hint, not thrown', async () => {
    const a = await runSetup(parseArgs(['--email', 'a@b.co']), { client: fakeClient([], { createError: 'boom' }).client, env: LIVE });
    expect(a.ok).toBe(false); expect(a.log.join()).toMatch(/boom/);
    const b = await runSetup(parseArgs(['--email', 'a@b.co']), { client: fakeClient([], { profileError: 'relation "profiles" does not exist' }).client, env: LIVE });
    expect(b.ok).toBe(false); expect(b.log.join()).toMatch(/0001_init\.sql/);
  });
});
