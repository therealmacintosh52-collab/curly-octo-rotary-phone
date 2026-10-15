// Web phone verification: the step that turns an anonymous chat session into "this person controls phone X".
// Live: a 6-digit code is texted to the number and checked here (deterministic code, never the model). Demo mode (no
// Supabase = no real customer data): the code is the fixed mock code. When Supabase is live but Twilio is not, verification
// is UNAVAILABLE rather than mockable, otherwise anyone could "verify" a stranger's number and read their bookings.
import { randomInt, timingSafeEqual } from 'node:crypto';
import { site } from '@/config/site';
import { rateLimit } from '@/lib/api/http';
import { isSmsLive, normalizePhone, sendSms } from '@/lib/sms';
import { conciergeConfig } from './config';
import { hashKey } from './guardrails';
import { isOptedOut } from './optout';
import { ensureLead, loadConversationById, saveState, withConversationLock } from './state';
import { mockVerifyAllowed, verificationAvailable } from './tools';

export type StartResult = { ok: true; mock: boolean; mockCodeHint?: string; sentTo: string } | { ok: false; error: 'invalid_phone' | 'unavailable' | 'rate_limited' | 'not_found' | 'opted_out' | 'send_failed' };
export type ConfirmResult = { ok: true; phoneLast4: string } | { ok: false; error: 'no_pending' | 'expired' | 'bad_code' | 'too_many_attempts' | 'not_found' };

const codeHash = (conversationId: string, phone: string, code: string) => hashKey(`verify:${conversationId}:${phone}:${code}`);
const mask = (p: string) => `***${p.slice(-4)}`;

export async function startVerification(p: { conversationId: string; phone: string; ip?: string; now?: number }): Promise<StartResult> {
  const now = p.now ?? Date.now();
  const phone = normalizePhone(p.phone);
  if (!phone) return { ok: false, error: 'invalid_phone' };
  if (!verificationAvailable()) return { ok: false, error: 'unavailable' };
  const L = conciergeConfig.limits;
  const checks = await Promise.all([
    rateLimit(`cc:vsend:${hashKey(phone)}`, L.verifySendsPerPhonePerHour, 3600),
    rateLimit(`cc:vconv:${p.conversationId}`, 5, 3600),
    p.ip && p.ip !== 'unknown' ? rateLimit(`cc:vip:${hashKey(p.ip)}`, 10, 3600) : Promise.resolve({ ok: true, retryAfter: 0 }),
  ]);
  if (checks.some((c) => !c.ok)) return { ok: false, error: 'rate_limited' };
  return withConversationLock(p.conversationId, async () => {
    const rec = await loadConversationById(p.conversationId);
    if (!rec || rec.conv.channel !== 'web') return { ok: false, error: 'not_found' } as const;
    if (await isOptedOut(phone)) return { ok: false, error: 'opted_out' } as const;
    const live = isSmsLive();
    const code = live ? String(randomInt(100000, 1000000)) : conciergeConfig.mockVerifyCode;
    rec.state.verify = { phone, codeHash: codeHash(rec.conv.id, phone, code), expiresAt: now + conciergeConfig.verifyCodeTtlMs, attempts: 0, sentAt: now };
    if (live) {
      const r = await sendSms(phone, `${site.name}: your verification code is ${code}. It expires in 10 minutes. If you didn't ask for it, ignore this text.`);
      if (!r.ok) { rec.state.verify = undefined; await saveState(rec); return { ok: false, error: 'send_failed' } as const; }
    }
    await saveState(rec);
    return { ok: true, mock: !live, mockCodeHint: !live && mockVerifyAllowed() ? conciergeConfig.mockVerifyCode : undefined, sentTo: mask(phone) } as const;
  });
}

export async function confirmVerification(p: { conversationId: string; code: string; now?: number }): Promise<ConfirmResult> {
  const now = p.now ?? Date.now();
  return withConversationLock(p.conversationId, async () => {
    const rec = await loadConversationById(p.conversationId);
    if (!rec) return { ok: false, error: 'not_found' } as const;
    const v = rec.state.verify;
    if (!v) return { ok: false, error: 'no_pending' } as const;
    if (v.expiresAt <= now) { rec.state.verify = undefined; await saveState(rec); return { ok: false, error: 'expired' } as const; }
    if (v.attempts >= conciergeConfig.limits.verifyAttempts) { rec.state.verify = undefined; await saveState(rec); return { ok: false, error: 'too_many_attempts' } as const; }
    const given = Buffer.from(codeHash(rec.conv.id, v.phone, String(p.code ?? '').trim()));
    const want = Buffer.from(v.codeHash);
    if (given.length !== want.length || !timingSafeEqual(given, want)) {
      v.attempts += 1;
      if (v.attempts >= conciergeConfig.limits.verifyAttempts) rec.state.verify = undefined;
      await saveState(rec);
      return { ok: false, error: v.attempts >= conciergeConfig.limits.verifyAttempts ? 'too_many_attempts' : 'bad_code' } as const;
    }
    rec.state.verifiedPhone = v.phone;
    rec.state.verifiedAt = now;
    rec.state.verify = undefined;
    await saveState(rec);
    await ensureLead(rec, 'web', { phone: rec.state.verifiedPhone });
    return { ok: true, phoneLast4: rec.state.verifiedPhone.slice(-4) } as const;
  });
}
