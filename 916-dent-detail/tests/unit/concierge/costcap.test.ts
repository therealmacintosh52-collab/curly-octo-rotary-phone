import { beforeEach, describe, expect, it } from 'vitest';
import { repo } from '@/lib/db';
import { conciergeConfig, rateFor } from '@/lib/concierge/config';
import { usageCostUsd } from '@/lib/concierge/models';
import { Chat, NOW, SpyModel, freshDb, smsId, webId } from '../../bot/harness';
import { MockPolicyModel } from '@/lib/concierge/mock-model';

beforeEach(freshDb);

describe('usage accounting', () => {
  it('prices uncached input, output, cache reads (0.1x) and cache writes (1.25x) from response.usage', () => {
    const r = rateFor('claude-sonnet-5-5');
    expect(r).toEqual({ input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 });
    expect(usageCostUsd('claude-sonnet-5-5', { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 })).toBeCloseTo(2);
    expect(usageCostUsd('claude-sonnet-5-5', { input: 0, output: 1_000_000, cacheRead: 0, cacheWrite: 0 })).toBeCloseTo(10);
    expect(usageCostUsd('claude-sonnet-5-5', { input: 0, output: 0, cacheRead: 1_000_000, cacheWrite: 0 })).toBeCloseTo(0.2);
    expect(usageCostUsd('claude-sonnet-5-5', { input: 0, output: 0, cacheRead: 0, cacheWrite: 1_000_000 })).toBeCloseTo(2.5);
    // a cache hit on a 3k-token prompt is ~10x cheaper than sending it uncached
    expect(usageCostUsd('x', { input: 0, output: 0, cacheRead: 3000, cacheWrite: 0 })).toBeLessThan(usageCostUsd('x', { input: 3000, output: 0, cacheRead: 0, cacheWrite: 0 }) / 9);
  });
  it('unknown models fall back to the default rates instead of costing zero', () => {
    expect(usageCostUsd('some-new-model', { input: 1_000_000, output: 0, cacheRead: 0, cacheWrite: 0 })).toBeGreaterThan(0);
  });
  it('is recorded per turn on the conversation and as a usage event (no message content)', async () => {
    const chat = Chat.withMock(smsId('+19165550177'));
    const r = await chat.say('what services do you offer?');
    expect(r.costUsd).toBeGreaterThan(0);
    const conv = (await chat.rec())!;
    expect(Number(conv.cost_usd)).toBeGreaterThan(0);
    expect((conv.tokens_in ?? 0) + (conv.tokens_out ?? 0)).toBeGreaterThan(0);
    const ev = (await repo().events.list({ where: { type: 'concierge.usage' } }))[0]!;
    expect(ev.data.cost_usd).toBeGreaterThan(0);
    expect(JSON.stringify(ev.data)).not.toMatch(/services|offer/);
  });
});

describe('per-conversation cost cap', () => {
  it('stops spending at the cap, hands off gracefully, escalates once, and makes no further model calls', async () => {
    const spy = new SpyModel(new MockPolicyModel({ tokensPerCall: { input: 30_000, output: 1_000 } }));
    const chat = new Chat(webId(), { now: NOW, model: spy, costCapUsd: 0.05 });
    const seen: string[] = [];
    for (const t of ['hello', 'what do you do?', 'and prices?']) seen.push((await chat.say(t)).status);
    expect(seen).toContain('cost_cap');
    const calls = spy.calls;
    const after = await chat.say('anyone?');
    expect(after.status).toBe('paused');
    expect(spy.calls).toBe(calls);
    const conv = (await chat.rec())!;
    expect(conv).toMatchObject({ status: 'escalated', needs_human: true, escalation_reason: 'cost_cap' });
  });
  it('a conversation already over the cap never reaches the model', async () => {
    const spy = new SpyModel(new MockPolicyModel());
    const chat = new Chat(webId(), { now: NOW, model: spy, costCapUsd: 0.01 });
    await chat.say('hello');
    const rec = (await chat.rec())!;
    await repo().conversations.update(rec.id, { cost_usd: 0.02, status: 'open', needs_human: false });
    const st = (await chat.state()) as Record<string, unknown>;
    st.paused = false;
    await repo().conversations.update(rec.id, { state: st });
    const before = spy.calls;
    const r = await chat.say('one more question');
    expect(r.status).toBe('cost_cap');
    expect(spy.calls).toBe(before);
  });
  it('the token cap works independently of dollars', async () => {
    const spy = new SpyModel(new MockPolicyModel({ tokensPerCall: { input: 90_000, output: 40_000 } }));
    const chat = new Chat(webId(), { now: NOW, model: spy, costCapUsd: 100, maxTokens: 120_000 });
    const r = await chat.say('hello');
    expect(r.status).toBe('cost_cap');
  });
  it('default cap comes from config/env', () => {
    expect(conciergeConfig.maxCostUsd()).toBe(0.5);
    process.env.CONCIERGE_MAX_COST_USD = '1.25';
    expect(conciergeConfig.maxCostUsd()).toBe(1.25);
    delete process.env.CONCIERGE_MAX_COST_USD;
  });
});
