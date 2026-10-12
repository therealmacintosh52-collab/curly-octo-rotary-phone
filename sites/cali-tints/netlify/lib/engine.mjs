/**
 * One assistant turn with Claude: system prompt + tools from knowledge.mjs,
 * a manual tool loop (at most four tool rounds), and a plain {reply, actions}
 * result that both the website widget and the social webhook can render.
 *
 * Needs ANTHROPIC_API_KEY in the function environment. Model defaults to
 * Claude Opus 5.5; override with ASSISTANT_MODEL.
 */
import Anthropic from '@anthropic-ai/sdk';
import { SYSTEM, TOOLS, runTool } from './knowledge.mjs';

export const MODEL = process.env.ASSISTANT_MODEL || 'claude-opus-5-5';
export const LLM_ENABLED = Boolean(process.env.ANTHROPIC_API_KEY);

let client;
function getClient() {
  if (!client) client = new Anthropic({ timeout: 45_000, maxRetries: 1 });
  return client;
}

/**
 * @param {Array<{role:'user'|'assistant', content:string}>} history prior turns, oldest first
 * @param {string} userText the new customer message
 * @param {{channel?: string}} opts
 * @returns {Promise<{reply:string, actions:Array<{label:string,href:string}>}>}
 */
export async function runTurn(history, userText, opts = {}) {
  const messages = [
    ...history.slice(-16).map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userText },
  ];
  if (opts.channel) {
    // Operator note for the channel, kept out of the cached system prompt.
    messages.push({ role: 'system', content: `Channel: ${opts.channel}. Links must be written out in full as plain URLs.` });
  }
  const actions = [];
  const c = getClient();

  for (let round = 0; round < 4; round++) {
    const res = await c.beta.messages.create({
      model: MODEL,
      max_tokens: 1024,                                   // chat replies are deliberately short
      system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
      tools: TOOLS,
      messages,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
    });

    if (res.stop_reason === 'refusal') {
      return { reply: `I can't help with that one. For anything about the car, call the shop on ${process.env.SHOP_PHONE || 'the number on the site'}.`, actions };
    }
    const text = res.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n').trim();
    const uses = res.content.filter((b) => b.type === 'tool_use');
    if (res.stop_reason !== 'tool_use' || uses.length === 0) {
      return { reply: text || 'Tell me the car and what you want done and I will point you the right way.', actions: dedupe(actions) };
    }
    messages.push({ role: 'assistant', content: res.content });
    const results = uses.map((u) => {
      const [out, action] = runTool(u.name, u.input);
      if (action) actions.push(action);
      return { type: 'tool_result', tool_use_id: u.id, content: out };
    });
    messages.push({ role: 'user', content: results });
  }
  return { reply: 'Let me hand you to a person: call the shop or use the booking page.', actions: dedupe(actions) };
}

function dedupe(actions) {
  const seen = new Set();
  return actions.filter((a) => (seen.has(a.href) ? false : (seen.add(a.href), true))).slice(0, 3);
}
