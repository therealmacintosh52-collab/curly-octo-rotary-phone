// Staff side of the needs-human inbox: reply by SMS (mock), transcript recording, opt-out refusal, resolve.
import { beforeEach, describe, expect, it } from 'vitest';
import { repo } from '@/lib/db';
import { inboxPhone, resolveConversation, staffReply } from '@/lib/concierge/inbox';
import { conversationTranscript, listNeedsHuman } from '@/lib/concierge/state';
import { smsOutbox } from '@/lib/sms';
import { Chat, PHONE, freshDb, smsId, webId } from '../../bot/harness';

beforeEach(freshDb);

async function escalatedSms() {
  const c = Chat.withMock(smsId());
  await c.say('Your guys ruined my paint and I am furious');
  smsOutbox().length = 0;
  return c;
}

describe('staffReply', () => {
  it('texts the customer through the SMS channel, records it in the transcript, keeps the chat open until resolved', async () => {
    const c = await escalatedSms();
    expect(await inboxPhone(c.conversationId!)).toBe(PHONE);
    const r = await staffReply(c.conversationId!, 'Hi, this is Alex. I am sorry about that, can I call you at 5?', 'owner:u1');
    expect(r).toEqual({ ok: true, mock: true });
    expect(smsOutbox()).toEqual([expect.objectContaining({ to: PHONE, body: expect.stringContaining('this is Alex') })]);
    const t = await conversationTranscript(c.conversationId!);
    expect(t.at(-1)).toMatchObject({ role: 'assistant', content: expect.stringContaining('this is Alex') });
    expect(await listNeedsHuman()).toHaveLength(1);
    expect((await repo().events.list({ where: { type: 'concierge.staff_reply' } }))).toHaveLength(1);
  });
  it('validates: empty, too long, unknown conversation', async () => {
    const c = await escalatedSms();
    expect(await staffReply(c.conversationId!, '   ', 'x')).toEqual({ ok: false, error: 'empty' });
    expect(await staffReply(c.conversationId!, 'x'.repeat(601), 'x')).toEqual({ ok: false, error: 'too_long' });
    expect(await staffReply('00000000-0000-4000-8000-000000000000', 'hi', 'x')).toEqual({ ok: false, error: 'not_found' });
    expect(smsOutbox()).toHaveLength(0);
  });
  it('refuses when the customer said STOP, and when a web chat never verified a phone', async () => {
    const c = await escalatedSms();
    await repo().customers.insert({ name: 'x', phone: PHONE, sms_opt_in: false, sms_opt_out_at: new Date().toISOString() });
    expect(await staffReply(c.conversationId!, 'hello', 'x')).toEqual({ ok: false, error: 'opted_out' });
    const w = Chat.withMock(webId());
    await w.say('I want to speak to a manager about my invoice');
    expect(await staffReply(w.conversationId!, 'hello', 'x')).toEqual({ ok: false, error: 'no_phone' });
    expect(smsOutbox().every((m) => m.to === 'owner:unconfigured')).toBe(true); // only the owner alert; nothing to a customer
  });
  it('resolve hands the chat back to the bot and empties the inbox', async () => {
    const c = await escalatedSms();
    expect(await resolveConversation(c.conversationId!, 'owner:u1')).toBe(true);
    expect(await listNeedsHuman()).toHaveLength(0);
    expect((await c.say('thanks, one more question about interior details')).status).toBe('ok');
    expect(await resolveConversation('00000000-0000-4000-8000-000000000000', 'x')).toBe(false);
  });
});
