import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { repo } from '@/lib/db';
import { authMode, createLogin, demoLoginEnabled, DEMO_DEALER_EMAIL, ensureDemoLogin, verifyLogin } from '@/lib/dealers/auth';
import { createWholesaleLead } from '@/lib/dealers/leads';
import { dealerMayReadPhoto, readStoredPhoto, saveDealerPhoto } from '@/lib/dealers/photos';
import { signSession, verifySession } from '@/lib/dealers/session-token';
import { winAnsi } from '@/lib/dealers/pdf';
import { signupSchema, singleVehicleSchema } from '@/lib/dealers/schema';
import { SEED_DEALER_ID } from '@/lib/db/seed';

beforeEach(async () => { await repo().reset?.(); });
afterEach(() => { vi.unstubAllEnvs(); });

const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 1)]);

describe('session cookie', () => {
  it('round-trips, rejects tampering, expiry and junk', () => {
    const t = signSession({ profileId: 'p1', dealerId: 'd1' }, 1_000_000, 60);
    expect(verifySession(t, 1_000_000 + 30_000)).toEqual({ profileId: 'p1', dealerId: 'd1', exp: 1_060_000 });
    expect(verifySession(t, 1_000_000 + 61_000)).toBeNull();
    const [payload, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ p: 'p1', d: 'OTHER', e: 9_999_999_999 })).toString('base64url');
    expect(verifySession(`${forged}.${sig}`, 1_000_000)).toBeNull();
    expect(verifySession(`${payload}.${sig}x`, 1_000_000)).toBeNull();
    for (const bad of ['', 'abc', 'a.b.c', undefined, null]) expect(verifySession(bad as string, 1)).toBeNull();
  });
  it('refuses to run with real data and no secret', () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'x'); vi.stubEnv('DEALER_SESSION_SECRET', ''); vi.stubEnv('BOOKING_TOKEN_SECRET', '');
    expect(() => signSession({ profileId: 'p', dealerId: 'd' })).toThrow(/SECRET/);
  });
});

describe('DEMO sign-in is closed in production unless switched on', () => {
  it('enabled outside production; off in production; on with the flag; never with Supabase', () => {
    expect(demoLoginEnabled()).toBe(true);
    vi.stubEnv('NODE_ENV', 'production');
    expect(demoLoginEnabled()).toBe(false); expect(authMode()).toBe('none');
    vi.stubEnv('DEALERS_DEMO_LOGIN', '1');
    expect(demoLoginEnabled()).toBe(true);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co'); vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'k');
    expect(demoLoginEnabled()).toBe(false); expect(authMode()).toBe('supabase');
  });
  it('mode none refuses sign-up and sign-in', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    await expect(createLogin({ email: 'a@b.co', name: 'x' })).rejects.toThrow(/not switched on/);
    expect(await verifyLogin(DEMO_DEALER_EMAIL, '')).toBeNull();
  });
  it('demo mode: seeded demo dealer can sign in by email; unknown email cannot', async () => {
    await ensureDemoLogin();
    const pid = await verifyLogin(DEMO_DEALER_EMAIL, '');
    expect(pid).toBeTruthy();
    expect((await repo().dealer_users.first({ where: { profile_id: pid! } }))?.dealer_id).toBe(SEED_DEALER_ID);
    expect(await verifyLogin('nobody@example.com', '')).toBeNull();
  });
});

describe('photos: access control and content checks', () => {
  it('stores only real images under the dealer prefix; refuses other bytes', async () => {
    const id = randomUUID();
    const ok = await saveDealerPhoto(id, JPEG);
    expect('path' in ok && ok.path.startsWith(`dealers/${id}/`) && ok.path.endsWith('.jpg')).toBe(true);
    expect(await saveDealerPhoto(id, Buffer.from('<script>alert(1)</script>'))).toEqual({ error: 'not_image' });
    expect(await saveDealerPhoto(id, Buffer.concat([JPEG, Buffer.alloc(3_100_000)]))).toEqual({ error: 'too_large' });
    if ('path' in ok) {
      expect((await readStoredPhoto(ok.path))?.type).toBe('image/jpeg');
      expect(await dealerMayReadPhoto(id, ok.path)).toBe(true);
      expect(await dealerMayReadPhoto(randomUUID(), ok.path)).toBe(false);
    }
    expect(await readStoredPhoto('dealers/../../etc/passwd')).toBeNull();
    expect(await dealerMayReadPhoto(id, '../../etc/passwd')).toBe(false);
  });
  it('before/after job photos are visible only to the dealer that owns the job; other kinds never', async () => {
    const db = repo();
    const job = await db.jobs.insert({ stage: 'done', dealer_id: SEED_DEALER_ID });
    await db.dealer_vehicles.insert({ dealer_id: SEED_DEALER_ID, vin: 'X', photo_paths: [], status: 'done', addon_approvals: [], job_id: job.id });
    await db.job_photos.insert({ job_id: job.id, kind: 'after', storage_path: 'jobs/abc.jpg', marketing_consent: false });
    await db.job_photos.insert({ job_id: job.id, kind: 'other', storage_path: 'jobs/internal.jpg', marketing_consent: false });
    expect(await dealerMayReadPhoto(SEED_DEALER_ID, 'jobs/abc.jpg')).toBe(true);
    expect(await dealerMayReadPhoto(randomUUID(), 'jobs/abc.jpg')).toBe(false);
    expect(await dealerMayReadPhoto(SEED_DEALER_ID, 'jobs/internal.jpg')).toBe(false);
  });
});

describe('leads and input schemas', () => {
  it('wholesale sheet request makes a CRM lead with source=dealer even with a different UTM source', async () => {
    const lead = await createWholesaleLead({ name: 'Sam', company: 'Acme Motors', email: 'SAM@Acme.example', phone: '+19165550123', message: 'about 30 cars a month', attribution: { utm_source: 'leave_behind', utm_medium: 'print', landing_page: '/dealers' } });
    expect(lead).toMatchObject({ source: 'dealer', stage: 'new', email: 'sam@acme.example', utm_source: 'leave_behind', landing_page: '/dealers' });
    expect(lead.notes).toContain('Acme Motors');
  });
  it('signup schema: honeypot, lot addresses, emails', () => {
    const base = { businessName: 'Acme', contactName: 'Pat', email: 'p@a.co', lotAddresses: ['1 Main St, Sacramento'], apEmail: 'ap@a.co' };
    expect(signupSchema.safeParse(base).success).toBe(true);
    expect(signupSchema.safeParse({ ...base, website: 'http://spam' }).success).toBe(false);
    expect(signupSchema.safeParse({ ...base, lotAddresses: [] }).success).toBe(false);
    expect(signupSchema.safeParse({ ...base, apEmail: 'nope' }).success).toBe(false);
    expect(signupSchema.safeParse({ ...base, expectedMonthlyVolume: -1 }).success).toBe(false);
    expect(singleVehicleSchema.safeParse({ vin: 'x'.repeat(41) }).success).toBe(false);
  });
  it('PDF text is reduced to what Helvetica can draw', () => {
    expect(winAnsi('It’s “done” — 100… 你')).toBe('It\'s "done" - 100... ?');
  });
});

describe('dealer request guard (same-origin)', () => {
  const r = (method: string, origin?: string) => new Request('http://site.test/api/dealers/vehicles', { method, headers: { host: 'site.test', ...(origin ? { origin } : {}) } });
  it('state-changing requests need a matching Origin; safe methods may omit it', async () => {
    const { sameOrigin } = await import('@/lib/dealers/guard');
    expect(sameOrigin(r('POST', 'http://site.test'))).toBe(true);
    expect(sameOrigin(r('POST', 'https://evil.example'))).toBe(false);
    expect(sameOrigin(r('POST'))).toBe(false); // no Origin on a POST: not from our pages
    expect(sameOrigin(r('PUT'))).toBe(false);
    expect(sameOrigin(r('GET'))).toBe(true);
    expect(sameOrigin(r('HEAD'))).toBe(true);
  });
});
