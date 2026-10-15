// Domain separation: with ONE shared secret (the documented fallback), a token minted for one purpose must not validate as another.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { signSession as signAdmin, verifySession as verifyAdmin } from '@/lib/auth/session';
import { signSession as signDealer, verifySession as verifyDealer } from '@/lib/dealers/session-token';
import { signBookingToken, verifyBookingToken } from '@/lib/booking/tokens';
import { signSession as signChat, verifySession as verifyChat } from '@/lib/concierge/state';

afterEach(() => { vi.unstubAllEnvs(); });
const SECRET = 'one-shared-secret-used-for-everything-0123456789';

describe('token domain separation (all four share BOOKING_TOKEN_SECRET when the specific secrets are unset)', () => {
  it('a token of one kind never validates as another, even when the payload is reshaped to fit', async () => {
    vi.stubEnv('BOOKING_TOKEN_SECRET', SECRET);
    vi.stubEnv('ADMIN_SESSION_SECRET', ''); vi.stubEnv('DEALER_SESSION_SECRET', '');
    const booking = signBookingToken('b1', Date.now() + 60_000);
    const dealer = signDealer({ profileId: 'p1', dealerId: 'd1' });
    const chat = signChat('c1');
    const admin = await signAdmin({ sub: 'u1', role: 'owner', name: 'x', techId: null, mode: 'live' });
    // each verifies as itself
    expect(verifyBookingToken(booking).ok).toBe(true);
    expect(verifyDealer(dealer)).not.toBeNull();
    expect(verifyChat(chat)).toBe('c1');
    expect((await verifyAdmin(admin))?.role).toBe('owner');
    // and as nothing else
    for (const t of [dealer, chat]) expect(verifyBookingToken(t).ok).toBe(false);
    for (const t of [booking, chat, admin]) expect(verifyDealer(t)).toBeNull();
    for (const t of [booking, dealer]) expect(verifyChat(t)).toBeNull();
    for (const t of [booking, dealer, chat]) expect(await verifyAdmin(t)).toBeNull();
  });
  it('re-signing another purpose\'s payload with that purpose\'s own signature fails: an attacker cannot reuse a booking signature as an admin cookie', async () => {
    vi.stubEnv('BOOKING_TOKEN_SECRET', SECRET); vi.stubEnv('ADMIN_SESSION_SECRET', '');
    const [, sig] = signBookingToken('b1', Date.now() + 60_000).split('.');
    const adminPayload = Buffer.from(JSON.stringify({ v: 1, sub: 'u1', role: 'owner', name: 'x', techId: null, mode: 'live', exp: Math.floor(Date.now() / 1000) + 600 })).toString('base64url');
    expect(await verifyAdmin(`${adminPayload}.${sig}`)).toBeNull();
  });
});
