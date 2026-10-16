import { afterEach, describe, expect, it, vi } from 'vitest';
import { SESSION_COOKIE, sessionDays, signSession, verifySession } from '@/lib/auth/session';
import { homeFor, isPublicAdminPath, roleMayOpen, safeNext } from '@/lib/auth/roles';
import { demoLoginEnabled } from '@/lib/auth/config';

afterEach(() => { vi.unstubAllEnvs(); });
const base = { sub: 'u1', role: 'owner' as const, name: 'Owner', techId: null, mode: 'demo' as const };

describe('session cookie', () => {
  it('round-trips and rejects tampering, expiry, wrong secret', async () => {
    vi.stubEnv('ADMIN_SESSION_SECRET', 'a-secret-that-is-long-enough');
    const t = await signSession(base);
    expect((await verifySession(t))?.role).toBe('owner');
    const [b, s] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ v: 1, sub: 'u1', role: 'owner', name: 'x', techId: null, mode: 'demo', exp: 9999999999 })).toString('base64url');
    expect(await verifySession(`${forged}.${s}`)).toBeNull();
    expect(await verifySession(`${b}.${s}x`)).toBeNull();
    expect(await verifySession('garbage')).toBeNull();
    expect(await verifySession(t, Date.now() + 8 * 86_400_000)).toBeNull();
    vi.stubEnv('ADMIN_SESSION_SECRET', 'another-secret-also-long-enough');
    expect(await verifySession(t)).toBeNull();
  });
  it('cannot promote a tech cookie to owner', async () => {
    vi.stubEnv('ADMIN_SESSION_SECRET', 'a-secret-that-is-long-enough');
    const t = await signSession({ ...base, role: 'tech', techId: 't1' });
    const [b, s] = t.split('.');
    const p = JSON.parse(Buffer.from(b!, 'base64url').toString());
    p.role = 'owner';
    expect(await verifySession(`${Buffer.from(JSON.stringify(p)).toString('base64url')}.${s}`)).toBeNull();
    expect(SESSION_COOKIE).toBe('d916_admin');
  });
  it('production without a secret and without the demo flag has no valid sessions', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ADMIN_SESSION_SECRET', '');
    vi.stubEnv('BOOKING_TOKEN_SECRET', '');
    await expect(signSession(base)).rejects.toThrow();
  });
});

describe('demo login gate', () => {
  it('is on in dev, off in production unless flagged, never with a live database', () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', '');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', '');
    vi.stubEnv('NODE_ENV', 'development');
    expect(demoLoginEnabled()).toBe(true);
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('ADMIN_DEMO_LOGIN', '');
    expect(demoLoginEnabled()).toBe(false);
    vi.stubEnv('ADMIN_DEMO_LOGIN', '1');
    expect(demoLoginEnabled()).toBe(true);
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://x.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'k');
    expect(demoLoginEnabled()).toBe(false);
  });
});

describe('route permissions', () => {
  it('confines techs to the tech view', () => {
    expect(roleMayOpen('tech', '/admin/today')).toBe(true);
    expect(roleMayOpen('tech', '/admin/jobs/abc')).toBe(true);
    expect(roleMayOpen('tech', '/api/admin/tech/start')).toBe(true);
    for (const p of ['/admin', '/admin/customers', '/admin/reports', '/api/admin/customers', '/api/admin/reports/csv', '/admin/todayx', '/admin/today/../customers', '/admin/moreover']) {
      expect(roleMayOpen('tech', p)).toBe(false);
    }
    expect(roleMayOpen('owner', '/admin/reports')).toBe(true);
    expect(roleMayOpen('admin', '/admin/customers')).toBe(true);
  });
  it('public paths', () => {
    expect(isPublicAdminPath('/admin/login')).toBe(true);
    expect(isPublicAdminPath('/api/admin/auth/demo')).toBe(true);
    expect(isPublicAdminPath('/admin/customers')).toBe(false);
    expect(isPublicAdminPath('/admin/loginx')).toBe(false);
    expect(isPublicAdminPath('/api/admin/customers')).toBe(false);
  });
  it('safeNext blocks open redirects and role escapes', () => {
    expect(safeNext('/admin/pipeline', 'owner')).toBe('/admin/pipeline');
    expect(safeNext('//evil.com', 'owner')).toBe('/admin');
    expect(safeNext('https://evil.com', 'owner')).toBe('/admin');
    expect(safeNext('/admin/../x', 'owner')).toBe('/admin');
    expect(safeNext('/admin/customers', 'tech')).toBe('/admin/today');
    expect(safeNext('/admin/login', 'owner')).toBe('/admin');
    expect(safeNext(null, 'tech')).toBe(homeFor('tech'));
  });
});

describe('session lifetime (SECURITY O-05)', () => {
  it('owner/admin sessions last 3 days, technicians 7, ADMIN_SESSION_DAYS overrides staff only and is clamped to 1-14', () => {
    expect(sessionDays('owner', {})).toBe(3);
    expect(sessionDays('admin', {})).toBe(3);
    expect(sessionDays('tech', {})).toBe(7);
    expect(sessionDays('owner', { ADMIN_SESSION_DAYS: '1' })).toBe(1);
    expect(sessionDays('owner', { ADMIN_SESSION_DAYS: '99' })).toBe(14);
    expect(sessionDays('owner', { ADMIN_SESSION_DAYS: '0' })).toBe(3);
    expect(sessionDays('owner', { ADMIN_SESSION_DAYS: 'x' })).toBe(3);
    expect(sessionDays('tech', { ADMIN_SESSION_DAYS: '1' })).toBe(7);
  });
  it('the signed expiry follows the role: an owner token is dead after 3 days, a tech token after 7', async () => {
    vi.stubEnv('ADMIN_SESSION_SECRET', 'a-secret-that-is-long-enough');
    const owner = await signSession(base);
    const tech = await signSession({ ...base, role: 'tech' as never, techId: 't1' });
    const day = 86_400_000;
    expect(await verifySession(owner, Date.now() + 2.9 * day)).not.toBeNull();
    expect(await verifySession(owner, Date.now() + 3.1 * day)).toBeNull();
    expect(await verifySession(tech, Date.now() + 6.9 * day)).not.toBeNull();
    expect(await verifySession(tech, Date.now() + 7.1 * day)).toBeNull();
  });
});
