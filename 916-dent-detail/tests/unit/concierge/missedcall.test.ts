import { beforeEach, describe, expect, it } from 'vitest';
import { localToUtc } from '@/lib/availability/tz';
import { repo } from '@/lib/db';
import { MISSED_CALL_OPENER, flushDeferredOpeners, handleMissedCall, wasMissed } from '@/lib/concierge/missedcall';
import { applyOptOut } from '@/lib/concierge/optout';
import { handleMessage } from '@/lib/concierge/agent';
import { smsOutbox } from '@/lib/sms';
import { NOW, PHONE, freshDb, smsId } from '../../bot/harness';

beforeEach(freshDb);
const at = (date: string, hh: number, mm = 0) => localToUtc(date, hh * 60 + mm)!;
const sentTo = (p = PHONE) => smsOutbox().filter((m) => m.to === p);

describe('what counts as missed', () => {
  it('dial results and call status', () => {
    for (const s of ['no-answer', 'busy', 'failed', 'canceled']) expect(wasMissed({ DialCallStatus: s })).toBe(true);
    for (const s of ['completed', 'answered']) expect(wasMissed({ DialCallStatus: s })).toBe(false);
    expect(wasMissed({ CallStatus: 'no-answer' })).toBe(true);
    expect(wasMissed({ CallStatus: 'completed' })).toBe(false);
    expect(wasMissed({})).toBe(false);
  });
});

describe('text-back', () => {
  it('sends the opener right away in business hours (inside the 60 s budget), starting an SMS conversation and a lead', async () => {
    const t0 = Date.now();
    const out = await handleMissedCall({ from: '(916) 555-0142', callSid: 'CA1', now: NOW, receivedAtMs: t0 });
    expect(out).toMatchObject({ action: 'sent' });
    expect((out as { withinSec: number }).withinSec).toBeLessThan(60);
    expect(sentTo()).toHaveLength(1);
    expect(sentTo()[0]!.body).toBe(MISSED_CALL_OPENER);
    expect(MISSED_CALL_OPENER).toMatch(/AI assistant/);
    expect(MISSED_CALL_OPENER).toMatch(/Reply STOP/);
    expect(MISSED_CALL_OPENER.length).toBeLessThan(320);
    const lead = (await repo().leads.list())[0]!;
    expect(lead).toMatchObject({ phone: PHONE, source: 'sms' });
    const conv = (await repo().conversations.list({ where: { channel: 'sms' } }))[0]!;
    const msgs = await repo().messages.list({ where: { conversation_id: conv.id } });
    expect(msgs[0]).toMatchObject({ role: 'assistant', content: MISSED_CALL_OPENER });
  });
  it("the customer's reply continues the same conversation (opener is in the history)", async () => {
    await handleMissedCall({ from: PHONE, now: NOW });
    const r = await handleMessage({ identity: smsId(), text: 'hi, how much for a dent on my door?' }, { now: NOW + 60_000 });
    expect(r.reply).toBeTruthy();
    expect(await repo().conversations.list({ where: { channel: 'sms' } })).toHaveLength(1);
  });
  it('dedupes per number for the dedupe window, then allows again', async () => {
    expect((await handleMissedCall({ from: PHONE, now: NOW })).action).toBe('sent');
    expect(await handleMissedCall({ from: PHONE, now: NOW + 5 * 60_000 })).toEqual({ action: 'skipped', reason: 'deduped' });
    expect(sentTo()).toHaveLength(1);
    expect((await handleMissedCall({ from: '+19165550143', now: NOW })).action).toBe('sent'); // other numbers unaffected
    expect((await handleMissedCall({ from: PHONE, now: NOW + 7 * 3_600_000 })).action).toBe('sent');
  });
  it('skips numbers that opted out, invalid / blocked caller ids, and the owners', async () => {
    await applyOptOut(PHONE, NOW);
    expect(await handleMissedCall({ from: PHONE, now: NOW })).toEqual({ action: 'skipped', reason: 'opted_out' });
    for (const bad of ['', 'anonymous', '+266696687', '555']) expect(await handleMissedCall({ from: bad, now: NOW })).toEqual({ action: 'skipped', reason: 'invalid_number' });
    process.env.OWNER_ALERT_PHONES = '+19165550101';
    expect(await handleMissedCall({ from: '+19165550101', now: NOW })).toEqual({ action: 'skipped', reason: 'owner_number' });
    expect(smsOutbox()).toHaveLength(0);
  });
  it('does not interrupt a conversation that is already active', async () => {
    await handleMessage({ identity: smsId(), text: 'hello' }, { now: NOW });
    expect(await handleMissedCall({ from: PHONE, now: NOW + 60_000 })).toEqual({ action: 'skipped', reason: 'active_conversation' });
  });
});

describe('quiet hours (9pm-8am Pacific)', () => {
  it('a 10:30pm missed call is held, then sent at the next window by the cron', async () => {
    const night = at('2026-10-19', 22, 30);
    const out = await handleMissedCall({ from: PHONE, now: night });
    expect(out.action).toBe('deferred');
    expect(sentTo()).toHaveLength(0);
    expect(Date.parse((out as { sendAt: string }).sendAt)).toBe(at('2026-10-20', 8));
    expect(await flushDeferredOpeners(at('2026-10-20', 6))).toEqual({ sent: 0, skipped: 0 });
    expect(sentTo()).toHaveLength(0);
    expect(await flushDeferredOpeners(at('2026-10-20', 8, 5))).toEqual({ sent: 1, skipped: 0 });
    expect(sentTo()).toHaveLength(1);
    expect(await flushDeferredOpeners(at('2026-10-20', 8, 10))).toEqual({ sent: 0, skipped: 0 }); // once only
    expect(sentTo()).toHaveLength(1);
  });
  it('a 7am call is held until 8am; a number that opts out while held is never texted', async () => {
    const early = at('2026-10-19', 7, 15);
    expect((await handleMissedCall({ from: PHONE, now: early })).action).toBe('deferred');
    await applyOptOut(PHONE, early + 60_000);
    expect(await flushDeferredOpeners(at('2026-10-19', 8, 5))).toEqual({ sent: 0, skipped: 1 });
    expect(sentTo()).toHaveLength(0);
  });
});
