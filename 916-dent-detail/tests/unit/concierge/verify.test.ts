import { beforeEach, describe, expect, it } from 'vitest';
import { repo } from '@/lib/db';
import { conciergeConfig } from '@/lib/concierge/config';
import { signSession, verifySession, findOrCreateConversation, loadConversationById, smsExternalId } from '@/lib/concierge/state';
import { confirmVerification, startVerification } from '@/lib/concierge/verify';
import { mockVerifyAllowed, verificationAvailable } from '@/lib/concierge/tools';
import { smsOutbox } from '@/lib/sms';
import { HOUR, NOW, PHONE, freshDb, webId } from '../../bot/harness';

beforeEach(freshDb);
const newWeb = async () => (await findOrCreateConversation(webId())).conv.id;

describe('session tokens', () => {
  it('sign, verify, expire, and reject tampering', () => {
    const t = signSession('11111111-1111-4111-8111-111111111111', NOW);
    expect(verifySession(t, NOW + HOUR)).toBe('11111111-1111-4111-8111-111111111111');
    expect(verifySession(t, NOW + 31 * 24 * HOUR)).toBeNull();
    const [p, s] = t.split('.');
    expect(verifySession(`${p}.${s!.slice(0, -2)}xx`, NOW)).toBeNull();
    expect(verifySession(`${Buffer.from(JSON.stringify({ c: 'other', e: 9999999999 })).toString('base64url')}.${s}`, NOW)).toBeNull();
    expect(verifySession('garbage')).toBeNull();
    expect(verifySession(undefined)).toBeNull();
  });
  it('a booking-link token is not a valid chat session token (domain separation)', async () => {
    const { signBookingToken } = await import('@/lib/booking/tokens');
    expect(verifySession(signBookingToken('11111111-1111-4111-8111-111111111111', NOW + HOUR), NOW)).toBeNull();
  });
});

describe('web phone verification', () => {
  it('demo mode: the mock code verifies, wrong codes do not, and the phone only becomes verified on success', async () => {
    const id = await newWeb();
    const s = await startVerification({ conversationId: id, phone: '(916) 555-0142', now: NOW });
    expect(s).toMatchObject({ ok: true, mock: true, mockCodeHint: conciergeConfig.mockVerifyCode, sentTo: '***0142' });
    expect((await loadConversationById(id))!.state.verifiedPhone).toBeUndefined();
    expect(await confirmVerification({ conversationId: id, code: '000000', now: NOW })).toMatchObject({ ok: false, error: 'bad_code' });
    expect((await loadConversationById(id))!.state.verifiedPhone).toBeUndefined();
    expect(await confirmVerification({ conversationId: id, code: conciergeConfig.mockVerifyCode, now: NOW })).toMatchObject({ ok: true, phoneLast4: '0142' });
    expect((await loadConversationById(id))!.state.verifiedPhone).toBe(PHONE);
    expect(smsOutbox()).toHaveLength(0); // no real text in mock mode
  });
  it('code is bound to the number it was sent to and to the conversation', async () => {
    const a = await newWeb(); const b = await newWeb();
    await startVerification({ conversationId: a, phone: PHONE, now: NOW });
    expect(await confirmVerification({ conversationId: b, code: conciergeConfig.mockVerifyCode, now: NOW })).toMatchObject({ ok: false, error: 'no_pending' });
  });
  it('expires, and locks out after repeated wrong codes', async () => {
    const id = await newWeb();
    await startVerification({ conversationId: id, phone: PHONE, now: NOW });
    expect(await confirmVerification({ conversationId: id, code: conciergeConfig.mockVerifyCode, now: NOW + conciergeConfig.verifyCodeTtlMs + 1 })).toMatchObject({ ok: false, error: 'expired' });
    await startVerification({ conversationId: id, phone: PHONE, now: NOW });
    let last: unknown;
    for (let i = 0; i < conciergeConfig.limits.verifyAttempts; i++) last = await confirmVerification({ conversationId: id, code: '111111', now: NOW });
    expect(last).toMatchObject({ ok: false, error: 'too_many_attempts' });
    expect(await confirmVerification({ conversationId: id, code: conciergeConfig.mockVerifyCode, now: NOW })).toMatchObject({ ok: false, error: 'no_pending' });
  });
  it('rate limits code sends per phone and rejects invalid numbers', async () => {
    const r: string[] = [];
    for (let i = 0; i < 5; i++) { const s = await startVerification({ conversationId: await newWeb(), phone: PHONE, now: NOW }); r.push(s.ok ? 'ok' : s.error); }
    expect(r.slice(0, 3)).toEqual(['ok', 'ok', 'ok']);
    expect(r[3]).toBe('rate_limited');
    expect(await startVerification({ conversationId: await newWeb(), phone: '123', now: NOW })).toMatchObject({ ok: false, error: 'invalid_phone' });
  });
  it('does not text a number that opted out', async () => {
    const { applyOptOut } = await import('@/lib/concierge/optout');
    await applyOptOut('+19165550130', NOW);
    expect(await startVerification({ conversationId: await newWeb(), phone: '+19165550130', now: NOW })).toMatchObject({ ok: false, error: 'opted_out' });
  });
  it('only web conversations can be verified (an SMS conversation already has a channel-proven phone)', async () => {
    const sms = await findOrCreateConversation({ channel: 'sms', externalId: smsExternalId(PHONE), phone: PHONE, phoneVerified: true });
    expect(await startVerification({ conversationId: sms.conv.id, phone: PHONE, now: NOW })).toMatchObject({ ok: false, error: 'not_found' });
  });
});

describe('verification is never mockable when real customer data is live', () => {
  it('Supabase live + no Twilio: unavailable; Supabase live + Twilio: real texts only; offline demo: mock code', () => {
    expect(verificationAvailable()).toBe(true);
    expect(mockVerifyAllowed()).toBe(true);
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
    try {
      expect(mockVerifyAllowed()).toBe(false);
      expect(verificationAvailable()).toBe(false);
      process.env.TWILIO_ACCOUNT_SID = 'AC1'; process.env.TWILIO_AUTH_TOKEN = 't'; process.env.TWILIO_FROM_NUMBER = '+19165550100';
      expect(verificationAvailable()).toBe(true);
      expect(mockVerifyAllowed()).toBe(false);
    } finally {
      for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER']) delete process.env[k];
    }
  });
  it('verification persists on the conversation only (another chat for the same phone is not verified)', async () => {
    const a = await newWeb(); const b = await newWeb();
    await startVerification({ conversationId: a, phone: PHONE, now: NOW });
    await confirmVerification({ conversationId: a, code: conciergeConfig.mockVerifyCode, now: NOW });
    expect((await loadConversationById(b))!.state.verifiedPhone).toBeUndefined();
    expect((await repo().leads.list()).some((l) => l.phone === PHONE)).toBe(true);
  });
});
