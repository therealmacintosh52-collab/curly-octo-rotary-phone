// The live model client against a stubbed SDK client (no network, no key): request shape, caching, usage mapping, and that the
// agent replays a tool-use turn UNCHANGED (thinking blocks included) inside one loop. Live behaviour itself is NOT covered here.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AnthropicModel } from '@/lib/concierge/anthropic-model';
import { handleMessage } from '@/lib/concierge/agent';
import { buildSystemPrompt } from '@/lib/concierge/prompt';
import { toolDefs } from '@/lib/concierge/tools';
import type { ModelClient, ModelRequest, ModelResponse } from '@/lib/concierge/types';
import { NOW, freshDb, smsId } from '../../bot/harness';

const create = vi.fn();
vi.mock('@/lib/ai/client', () => ({ anthropic: () => ({ messages: { create } }), isAnthropicLive: () => true }));

beforeEach(async () => { await freshDb(); create.mockReset(); });
const req = (over: Partial<ModelRequest> = {}): ModelRequest => ({ system: buildSystemPrompt(), tools: toolDefs(), messages: [{ role: 'user', content: 'hi' }], maxTokens: 700, ...over });

describe('AnthropicModel', () => {
  it('sends the model id, a cached system prompt, the tools, low effort, and no sampling params', async () => {
    create.mockResolvedValue({ content: [{ type: 'text', text: 'Hello!' }], stop_reason: 'end_turn', model: 'claude-sonnet-5-5', usage: { input_tokens: 120, output_tokens: 8, cache_read_input_tokens: 3000, cache_creation_input_tokens: 0 } });
    const r = await new AnthropicModel().complete(req());
    const body = create.mock.calls[0]![0];
    expect(body.model).toBe('claude-sonnet-5-5');
    expect(body.max_tokens).toBe(700);
    expect(body.system).toEqual([{ type: 'text', text: buildSystemPrompt(), cache_control: { type: 'ephemeral' } }]);
    expect(body.tools).toHaveLength(11);
    expect(body.output_config).toEqual({ effort: 'low' });
    for (const k of ['temperature', 'top_p', 'top_k', 'thinking', 'tool_choice']) expect(body).not.toHaveProperty(k);
    expect(r).toMatchObject({ text: 'Hello!', stopReason: 'end_turn', mock: false, usage: { input: 120, output: 8, cacheRead: 3000, cacheWrite: 0 } });
  });
  it('honours ANTHROPIC_MODEL', async () => {
    process.env.ANTHROPIC_MODEL = 'claude-haiku-5-5';
    create.mockResolvedValue({ content: [{ type: 'text', text: 'x' }], stop_reason: 'end_turn', model: 'claude-haiku-5-5', usage: { input_tokens: 1, output_tokens: 1 } });
    await new AnthropicModel().complete(req());
    expect(create.mock.calls[0]![0].model).toBe('claude-haiku-5-5');
    delete process.env.ANTHROPIC_MODEL;
  });
  it('maps tool_use blocks, stop reasons (including refusal) and missing cache fields', async () => {
    create.mockResolvedValue({ content: [{ type: 'thinking', thinking: '', signature: 's' }, { type: 'tool_use', id: 'toolu_1', name: 'get_services', input: {} }], stop_reason: 'tool_use', model: 'm', usage: { input_tokens: 5, output_tokens: 6 } });
    const r = await new AnthropicModel().complete(req());
    expect(r.toolUses).toEqual([{ type: 'tool_use', id: 'toolu_1', name: 'get_services', input: {} }]);
    expect(r.stopReason).toBe('tool_use');
    expect(r.raw).toHaveLength(2); // thinking block kept for replay
    expect(r.usage.cacheRead).toBe(0);
    create.mockResolvedValue({ content: [], stop_reason: 'refusal', model: 'm', usage: { input_tokens: 1, output_tokens: 0 } });
    expect((await new AnthropicModel().complete(req())).stopReason).toBe('refusal');
  });
  it('API errors propagate to the agent, which answers gracefully instead of crashing', async () => {
    create.mockRejectedValue(Object.assign(new Error('overloaded'), { name: 'InternalServerError', status: 529 }));
    const r = await handleMessage({ identity: smsId(), text: 'what do you offer?' }, { now: NOW, model: new AnthropicModel() });
    expect(r.status).toBe('error');
    expect(r.reply).toMatch(/snag|try again/i);
  });
});

describe('agent loop with a tool-using model', () => {
  it('replays the assistant turn unchanged, returns every tool_result in ONE user message, and accounts usage across calls', async () => {
    const seen: ModelRequest[] = [];
    const raw1 = [{ type: 'thinking', thinking: '', signature: 'sig' }, { type: 'tool_use', id: 'toolu_a', name: 'get_services', input: {} }, { type: 'tool_use', id: 'toolu_b', name: 'check_service_area', input: { zip: '95624' } }];
    let n = 0;
    const model: ModelClient = {
      complete: async (r): Promise<ModelResponse> => {
        seen.push(structuredClone(r));
        n++;
        if (n === 1) return { raw: raw1, text: '', toolUses: raw1.filter((b) => b.type === 'tool_use') as never, stopReason: 'tool_use', usage: { input: 1000, output: 50, cacheRead: 2000, cacheWrite: 0 }, model: 'claude-sonnet-5-5', mock: false };
        return { raw: [{ type: 'text', text: 'We come to Elk Grove with no travel fee. What does your car need?' }], text: 'We come to Elk Grove with no travel fee. What does your car need?', toolUses: [], stopReason: 'end_turn', usage: { input: 1200, output: 30, cacheRead: 2000, cacheWrite: 0 }, model: 'claude-sonnet-5-5', mock: false };
      },
    };
    const r = await handleMessage({ identity: smsId(), text: 'do you come to 95624?' }, { now: NOW, model });
    expect(r.reply).toMatch(/Elk Grove/);
    const second = seen[1]!.messages;
    const assistant = second.find((m) => m.role === 'assistant')!;
    expect(assistant.content).toEqual(raw1);
    const results = second.filter((m) => m.role === 'user' && Array.isArray(m.content));
    expect(results).toHaveLength(1);
    expect((results[0]!.content as { tool_use_id: string }[]).map((b) => b.tool_use_id)).toEqual(['toolu_a', 'toolu_b']);
    expect(r.usage).toEqual({ input: 2200, output: 80, cacheRead: 4000, cacheWrite: 0 });
    // 2200*$2 + 80*$10 + 4000*$0.2 per million
    expect(r.costUsd).toBeCloseTo((2200 * 2 + 80 * 10 + 4000 * 0.2) / 1_000_000, 8);
    expect(r.mock).toBe(false);
  });
  it('a model refusal hands off to the owners instead of showing nothing', async () => {
    const model: ModelClient = { complete: async () => ({ raw: [], text: '', toolUses: [], stopReason: 'refusal', usage: { input: 10, output: 0, cacheRead: 0, cacheWrite: 0 }, model: 'm', mock: false }) };
    const r = await handleMessage({ identity: smsId(), text: 'hello' }, { now: NOW, model });
    expect(r.status).toBe('refused');
    expect(r.escalated).toBe(true);
  });
});
