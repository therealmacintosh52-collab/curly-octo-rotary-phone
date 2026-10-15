// SMS reminder consent for Concierge-booked customers: asked by the server, recorded only on an explicit REMIND ME.
import { beforeEach, describe, expect, it } from 'vitest';
import { repo } from '@/lib/db';
import { CONCIERGE_SMS_CONSENT_QUESTION, parseConsentAnswer } from '@/lib/concierge/consent';
import type { ModelClient, ModelRequest, ModelResponse } from '@/lib/concierge/types';
import { Chat, NOW, PHONE, freshDb, smsId } from '../../bot/harness';
import { smsOutbox } from '@/lib/sms';

beforeEach(freshDb);

const usage = { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 };
const toolStep = (name: string, input: unknown, id: string): ModelResponse => ({ raw: [{ type: 'tool_use', id, name, input }], text: '', toolUses: [{ type: 'tool_use', id, name, input }], stopReason: 'tool_use', usage, model: 'scripted', mock: true });
const textStep = (text: string): ModelResponse => ({ raw: [{ type: 'text', text }], text, toolUses: [], stopReason: 'end_turn', usage, model: 'scripted', mock: true });

/** A model that books the first offered slot: check_availability -> create_booking -> send_deposit_link -> text. */
class BookingModel implements ModelClient {
  step = 0;
  slot = '';
  bookingId = '';
  async complete(req: ModelRequest): Promise<ModelResponse> {
    const last = req.messages[req.messages.length - 1];
    const results = Array.isArray(last?.content) ? (last!.content as { type: string; content?: string }[]).filter((b) => b.type === 'tool_result') : [];
    const data = results[0]?.content ? JSON.parse(results[0].content) : null;
    const s = this.step++;
    if (s === 0) return toolStep('check_availability', { services: ['interior'], size_class: 'compact', zip: '95624' }, 't1');
    if (s === 1) { this.slot = data.slots[0].slot_id; return toolStep('create_booking', { slot_id: this.slot, name: 'Sam Lee', email: 'sam@example.com', address_line: '12 Oak St Elk Grove', vehicle: { year: 2021, make: 'Honda', model: 'Civic' } }, 't2'); }
    if (s === 2) { this.bookingId = data.booking_id; return toolStep('send_deposit_link', { booking_id: this.bookingId }, 't3'); }
    return textStep('Your time is held. Pay the deposit with the link to lock it in.');
  }
}
/** Any later turn: plain text, so we can prove the model was not asked about consent. */
const plain: ModelClient = { complete: async () => textStep('Anything else I can help with?') };

describe('parseConsentAnswer', () => {
  it('only an explicit REMIND ME is a yes; bare YES / OK / sure are not', () => {
    for (const t of ['REMIND ME', 'remind me', 'Yes, remind me', 'remind me.', 'text me', 'please remind me']) expect(parseConsentAnswer(t), t).toBe('yes');
    for (const t of ['yes', 'YES', 'ok', 'sure', 'y', 'what is this?', 'remind me never', 'do not remind me', 'I will remind you of my address 12 Oak']) expect(parseConsentAnswer(t), t).not.toBe('yes');
  });
  it('NO THANKS and NO are a decline; mixed messages are neither', () => {
    for (const t of ['NO THANKS', 'no', 'No thank you', 'nope']) expect(parseConsentAnswer(t), t).toBe('no');
    expect(parseConsentAnswer('no remind me')).toBeNull();
    expect(parseConsentAnswer('no wait, can I move the time?')).toBeNull();
  });
});

describe('consent step in the bot flow', () => {
  async function bookOverSms(model: ModelClient = new BookingModel()) {
    const chat = new Chat(smsId(), { now: NOW, model });
    const r = await chat.say('Book me the first interior slot please');
    return { chat, r };
  }

  it('after the deposit link, the SERVER appends the consent question; nothing is recorded yet', async () => {
    const { chat, r } = await bookOverSms();
    expect(chat.called('send_deposit_link')[0]).toMatchObject({ ok: true });
    expect(r.reply).toContain(CONCIERGE_SMS_CONSENT_QUESTION);
    expect(r.reply).toMatch(/STOP/); expect(r.reply).toMatch(/HELP/); expect(r.reply).toMatch(/not a condition of purchase/i); expect(r.reply).toMatch(/rates may apply/i);
    expect(r.suggestions).toEqual(['Remind me', 'No thanks']);
    const c = (await repo().customers.list({ where: { phone: PHONE } }))[0]!;
    expect(c.sms_opt_in).toBe(false);
    expect(c.sms_opt_in_at ?? null).toBeNull();
    expect((await chat.state()).smsConsent).toMatchObject({ status: 'asked' });
  });

  it('REMIND ME records consent with timestamp and the exact wording shown, without calling the model', async () => {
    const { chat } = await bookOverSms();
    const spy = { n: 0 };
    chat.opts.model = { complete: async (q) => { spy.n++; return plain.complete(q); } };
    const r = await chat.say('REMIND ME');
    expect(spy.n).toBe(0);
    expect(r.reply).toMatch(/You'll get appointment texts/);
    const c = (await repo().customers.list({ where: { phone: PHONE } }))[0]!;
    expect(c).toMatchObject({ sms_opt_in: true, sms_opt_in_text: CONCIERGE_SMS_CONSENT_QUESTION });
    expect(Date.parse(c.sms_opt_in_at!)).toBe(NOW);
    expect((await chat.state()).smsConsent).toMatchObject({ status: 'granted' });
    expect((await repo().events.list({ where: { type: 'concierge.sms_consent' } }))).toHaveLength(1);
  });

  it('a bare YES is not consent (it is also the START keyword)', async () => {
    const { chat } = await bookOverSms();
    chat.opts.model = plain;
    await chat.say('yes');
    expect((await repo().customers.list({ where: { phone: PHONE } }))[0]!.sms_opt_in).toBe(false);
    expect((await chat.state()).smsConsent).toMatchObject({ status: 'asked' });
  });

  it('NO THANKS declines: no consent, email-only reply', async () => {
    const { chat } = await bookOverSms();
    const r = await chat.say('NO THANKS');
    expect(r.reply).toMatch(/by email/i);
    expect((await repo().customers.list({ where: { phone: PHONE } }))[0]!.sms_opt_in).toBe(false);
    expect((await chat.state()).smsConsent).toMatchObject({ status: 'declined' });
  });

  it('the question is asked once per conversation', async () => {
    const { chat } = await bookOverSms();
    chat.opts.model = plain;
    await chat.say('NO THANKS');
    const r = await chat.say('thanks');
    expect(r.reply).not.toContain('REMIND ME');
  });

  it('REMIND ME with no question outstanding does nothing special (goes to the model like any text)', async () => {
    const chat = new Chat(smsId(), { now: NOW, model: plain });
    const r = await chat.say('REMIND ME');
    expect(r.reply).toBe('Anything else I can help with?');
    expect((await repo().customers.list({ where: { phone: PHONE } })).every((c) => !c.sms_opt_in)).toBe(true);
  });

  it('a customer who already consented (booking form) or who sent STOP is never asked', async () => {
    await repo().customers.insert({ name: 'Sam', phone: PHONE, sms_opt_in: true, sms_opt_in_at: new Date(NOW).toISOString() });
    const a = await bookOverSms();
    expect(a.r.reply).not.toContain('REMIND ME');
    await freshDb();
    await repo().customers.insert({ name: 'Sam', phone: PHONE, sms_opt_in: false, sms_opt_out_at: new Date(NOW).toISOString() });
    // opted-out numbers get silence from the agent entirely (STOP wins); nothing is asked or sent
    const b = new Chat(smsId(), { now: NOW, model: new BookingModel() });
    expect((await b.say('book me')).reply).toBeNull();
  });

  it('consent is never re-granted over a STOP that arrived after the question', async () => {
    const { chat } = await bookOverSms();
    await chat.say('STOP');
    const r = await chat.say('REMIND ME');
    expect(r.reply).toBeNull();
    const c = (await repo().customers.list({ where: { phone: PHONE } }))[0]!;
    expect(c.sms_opt_in).toBe(false);
    expect(c.sms_opt_out_at).toBeTruthy();
  });

  it('web chat: consent only counts for the verified phone; an unverified web chat is never asked', async () => {
    const outboxBefore = smsOutbox().length;
    const chat = new Chat({ channel: 'web', externalId: 'w1', phone: null, phoneVerified: false, ip: '203.0.113.9' }, { now: NOW, model: plain });
    await chat.say('hello');
    // force an asked state without verification: the answer must not be recorded
    const st = await chat.state();
    await repo().conversations.update(chat.conversationId!, { state: { ...st, smsConsent: { status: 'asked', askedAt: NOW, wording: CONCIERGE_SMS_CONSENT_QUESTION } } });
    await chat.say('REMIND ME');
    expect((await repo().customers.list()).every((c) => !c.sms_opt_in)).toBe(true);
    expect(smsOutbox().length).toBe(outboxBefore);
  });
});
