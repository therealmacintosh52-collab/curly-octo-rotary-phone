// SMS compliance keywords are handled in code, before the model.
import { beforeEach, describe, expect, it } from 'vitest';
import { repo } from '@/lib/db';
import { smsKeyword, applyOptOut, isOptedOut } from '@/lib/concierge/optout';
import { smsOutbox } from '@/lib/sms';
import { Chat, NOW, PHONE, SpyModel, freshDb, smsId } from '../../bot/harness';
import { MockPolicyModel } from '@/lib/concierge/mock-model';

beforeEach(freshDb);
const sms = (phone = PHONE) => { const spy = new SpyModel(new MockPolicyModel()); return { spy, chat: new Chat(smsId(phone), { now: NOW, model: spy }) }; };

describe('keywords', () => {
  it('recognises the carrier keyword set, case and punctuation insensitive', () => {
    for (const k of ['STOP', 'stop', 'Stop.', 'STOPALL', 'unsubscribe', 'CANCEL', 'END', 'quit', ' stop ']) expect(smsKeyword(k), k).toBe('stop');
    for (const k of ['START', 'unstop', 'YES']) expect(smsKeyword(k), k).toBe('start');
    for (const k of ['HELP', 'info']) expect(smsKeyword(k), k).toBe('help');
    for (const k of ['stop texting me please, I want a quote', 'I want to cancel my appointment', 'helpful', 'yes please do it']) expect(smsKeyword(k), k).toBeNull();
  });
});

describe('STOP / START / HELP before the model', () => {
  it('STOP records the opt-out on the customer (creating one if needed), replies once, and never calls the model', async () => {
    const { chat, spy } = sms();
    const r = await chat.say('STOP');
    expect(r).toMatchObject({ optedOut: true, status: 'ok' });
    expect(r.reply).toMatch(/unsubscribed/i);
    expect(r.reply).toMatch(/START/);
    expect(spy.calls).toBe(0);
    expect(await isOptedOut(PHONE)).toBe(true);
    expect((await repo().customers.list({ where: { phone: PHONE } }))[0]).toMatchObject({ sms_opt_in: false });
  });
  it('STOP also flips an existing customer who had opted in', async () => {
    const c = await repo().customers.insert({ name: 'Sam', phone: PHONE, sms_opt_in: true, sms_opt_in_at: new Date().toISOString() });
    await sms().chat.say('stop');
    const after = (await repo().customers.get(c.id))!;
    expect(after.sms_opt_in).toBe(false);
    expect(after.sms_opt_out_at).toBeTruthy();
  });
  it('after STOP every message gets silence (no reply, no model), including normal questions', async () => {
    const { chat, spy } = sms();
    await chat.say('STOP');
    for (const t of ['hello', 'how much for a dent?', 'ok sorry']) { const r = await chat.say(t); expect(r.reply).toBeNull(); expect(r.status).toBe('opted_out'); }
    expect(spy.calls).toBe(0);
  });
  it('STOP works even when the chat is locked or rate limited', async () => {
    const { chat } = sms();
    await chat.say('hello');
    const st = await chat.state();
    await repo().conversations.update(chat.conversationId!, { state: { ...st, lockedUntil: NOW + 3_600_000 } });
    const r = await chat.say('STOP');
    expect(r.optedOut).toBe(true);
  });
  it('START clears the block but does not grant reminder consent; HELP replies without the model', async () => {
    const { chat, spy } = sms();
    await chat.say('STOP');
    const s = await chat.say('START');
    expect(s.optedIn).toBe(true);
    expect(s.reply).toMatch(/subscribed again/i);
    const c = (await repo().customers.list({ where: { phone: PHONE } }))[0]!;
    expect(c.sms_opt_out_at).toBeNull();
    expect(c.sms_opt_in).toBe(false);
    const h = await chat.say('HELP');
    expect(h.help).toBe(true);
    expect(h.reply).toMatch(/STOP/);
    expect(spy.calls).toBe(0);
  });
  it('"yes" is an ordinary answer for a subscribed number, but START for an opted-out one', async () => {
    const { chat, spy } = sms();
    const r = await chat.say('yes');
    expect(r.optedIn).toBeFalsy();
    expect(spy.calls).toBe(1);
    await applyOptOut(PHONE, NOW);
    const back = await chat.say('yes');
    expect(back.optedIn).toBe(true);
  });
  it('the opt-out ledger is per phone number', async () => {
    await sms('+19165550111').chat.say('STOP');
    const other = sms('+19165550112');
    const r = await other.chat.say('hello');
    expect(r.reply).toBeTruthy();
    expect(other.spy.calls).toBe(1);
  });
  it('web chat has no SMS keywords: "stop" is just text there', async () => {
    const spy = new SpyModel(new MockPolicyModel());
    const { webId } = await import('../../bot/harness');
    const chat = new Chat(webId(), { now: NOW, model: spy });
    const r = await chat.say('stop');
    expect(r.optedOut).toBeFalsy();
    expect(spy.calls).toBe(1);
    expect(smsOutbox()).toHaveLength(0);
  });
});
