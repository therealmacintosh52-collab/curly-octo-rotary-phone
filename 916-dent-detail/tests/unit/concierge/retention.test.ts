// Transcript retention: old chats are scrubbed, recent and escalated ones are not, memory rows expire, job is idempotent.
import { beforeEach, describe, expect, it } from 'vitest';
import { repo } from '@/lib/db';
import { retentionDays } from '@/lib/concierge/config';
import { purgeOldTranscripts } from '@/lib/concierge/retention';
import { Chat, NOW, PHONE, freshDb, smsId } from '../../bot/harness';
import { GET } from '@/app/api/concierge/retention/route';

beforeEach(freshDb);
const DAY = 86_400_000;

describe('retention config', () => {
  it('defaults to 180 days, env overrides, and never goes below 7', () => {
    delete process.env.CONCIERGE_RETENTION_DAYS;
    expect(retentionDays()).toBe(180);
    process.env.CONCIERGE_RETENTION_DAYS = '30'; expect(retentionDays()).toBe(30);
    process.env.CONCIERGE_RETENTION_DAYS = '1'; expect(retentionDays()).toBe(7);
    process.env.CONCIERGE_RETENTION_DAYS = 'abc'; expect(retentionDays()).toBe(180);
    delete process.env.CONCIERGE_RETENTION_DAYS;
  });
});

describe('purgeOldTranscripts', () => {
  async function oldChat() {
    const c = Chat.withMock(smsId());
    await c.say('how much for an interior detail on my sedan?');
    await repo().conversations.update(c.conversationId!, { last_message_at: new Date(NOW).toISOString() });
    return c;
  }
  // The mock store stamps updated_at with the real clock, so "old" means the job runs far enough in the future.
  const realNow = () => Date.now();

  it('keeps a recent chat untouched', async () => {
    const c = await oldChat();
    const r = await purgeOldTranscripts(realNow(), 180);
    expect(r).toMatchObject({ conversations: 0, messages: 0 });
    expect((await repo().messages.list({ where: { conversation_id: c.conversationId! } })).length).toBeGreaterThan(0);
  });

  it('deletes messages and scrubs summary + bot state of a chat older than the window', async () => {
    const c = await oldChat();
    const st = await c.state();
    await repo().conversations.update(c.conversationId!, { summary: 'Sam, sam@example.com', state: { ...st, verifiedPhone: PHONE, collected: { name: 'Sam', email: 'sam@example.com' } } });
    const r = await purgeOldTranscripts(realNow() + 200 * DAY, 180);
    expect(r.conversations).toBe(1);
    expect(r.messages).toBeGreaterThanOrEqual(2);
    expect(await repo().messages.list({ where: { conversation_id: c.conversationId! } })).toHaveLength(0);
    const after = (await repo().conversations.get(c.conversationId!))!;
    expect(after.summary).toBeNull();
    expect(after.status).toBe('closed');
    expect(JSON.stringify(after.state)).not.toMatch(/sam@example|\+1916|Sam/);
    // the lead (CRM) is governed separately and survives
    expect(after.lead_id).toBeTruthy();
    expect(await repo().leads.get(after.lead_id!)).toBeTruthy();
  });

  it('is idempotent', async () => {
    await oldChat();
    await purgeOldTranscripts(realNow() + 200 * DAY, 180);
    expect(await purgeOldTranscripts(realNow() + 200 * DAY, 180)).toMatchObject({ conversations: 0, messages: 0 });
  });

  it('never purges an open escalation', async () => {
    const c = Chat.withMock(smsId());
    await c.say('Your guys ruined my paint and I am furious');
    const r = await purgeOldTranscripts(realNow() + 400 * DAY, 180);
    expect(r.conversations).toBe(0);
    expect((await repo().messages.list({ where: { conversation_id: c.conversationId! } })).length).toBeGreaterThan(0);
  });

  it('a conversation with a recent last message survives even when its row is old', async () => {
    const c = await oldChat();
    await repo().conversations.update(c.conversationId!, { last_message_at: new Date(realNow() + 195 * DAY).toISOString() });
    expect((await purgeOldTranscripts(realNow() + 200 * DAY, 180)).conversations).toBe(0);
  });

  it('expires stale shared-memory rows only', async () => {
    const fresh = await repo().customer_memory.insert({ customer_key: 'p:+19165550101', summary: 's', facts: {}, conversation_count: 1, last_seen_at: new Date(realNow() + 199 * DAY).toISOString() });
    const stale = await repo().customer_memory.insert({ customer_key: 'p:+19165550102', summary: 's', facts: {}, conversation_count: 1, last_seen_at: new Date(realNow() - 300 * DAY).toISOString() });
    const r = await purgeOldTranscripts(realNow() + 200 * DAY, 180);
    expect(r.memories).toBe(1);
    expect(await repo().customer_memory.get(stale.id)).toBeNull();
    expect(await repo().customer_memory.get(fresh.id)).toBeTruthy();
  });
});

describe('cron route', () => {
  const req = (auth?: string) => new Request('http://x/api/concierge/retention', { headers: auth ? { authorization: auth } : {} });
  it('requires the bearer secret when configured and answers JSON', async () => {
    process.env.CRON_SECRET = 'cron-secret-value';
    expect((await GET(req())).status).toBe(401);
    expect((await GET(req('Bearer wrong'))).status).toBe(401);
    const ok = await GET(req('Bearer cron-secret-value'));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({ days: 180 });
    delete process.env.CRON_SECRET;
  });
  it('refuses in production when CRON_SECRET is not set', async () => {
    const env = process.env as Record<string, string | undefined>;
    const prev = env.NODE_ENV; env.NODE_ENV = 'production';
    expect((await GET(req())).status).toBe(503);
    env.NODE_ENV = prev;
  });
});
