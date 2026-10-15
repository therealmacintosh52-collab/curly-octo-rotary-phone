// Live model client: Anthropic Messages API, tool use, prompt caching, usage accounting.
//  * model: ANTHROPIC_MODEL or claude-sonnet-5-5
//  * caching: one ephemeral breakpoint at the END of the system prompt. Render order is tools -> system -> messages, so the
//    breakpoint caches the tool definitions AND the system prompt as one stable prefix. Everything that varies per
//    customer lives in the messages, after the breakpoint. Verify with usage.cache_read_input_tokens once live.
//  * effort "low": short chat replies do not need deep reasoning; no sampling params (Sonnet 5.5 rejects non-defaults)
//  * the assistant turn is replayed UNCHANGED inside one tool loop (raw content, thinking blocks included); across
//    customer turns only plain text is replayed, so no stored thinking block is ever edited
//  * refusal stop reason is surfaced to the agent, which hands off to a human
import type Anthropic from '@anthropic-ai/sdk';
import { anthropic } from '@/lib/ai/client';
import { MODEL_ID } from './config';
import type { ModelClient, ModelRequest, ModelResponse, ToolUseBlock } from './types';

export class AnthropicModel implements ModelClient {
  async complete(req: ModelRequest): Promise<ModelResponse> {
    const client = anthropic();
    if (!client) throw new Error('ANTHROPIC_API_KEY is not set');
    const model = MODEL_ID();
    const res = await client.messages.create(
      {
        model,
        max_tokens: req.maxTokens,
        system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
        tools: req.tools as unknown as Anthropic.Tool[],
        messages: req.messages as unknown as Anthropic.MessageParam[],
        output_config: { effort: 'low' },
      },
      { signal: req.signal },
    );
    const toolUses: ToolUseBlock[] = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use').map((b) => ({ type: 'tool_use', id: b.id, name: b.name, input: b.input }));
    const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === 'text').map((b) => b.text).join('\n').trim();
    const stopReason = res.stop_reason === 'tool_use' || res.stop_reason === 'end_turn' || res.stop_reason === 'max_tokens' || res.stop_reason === 'refusal' ? res.stop_reason : 'other';
    return {
      raw: res.content as unknown[], text, toolUses, stopReason, model: res.model, mock: false,
      usage: {
        input: res.usage.input_tokens ?? 0, output: res.usage.output_tokens ?? 0,
        cacheRead: res.usage.cache_read_input_tokens ?? 0, cacheWrite: res.usage.cache_creation_input_tokens ?? 0,
      },
    };
  }
}
