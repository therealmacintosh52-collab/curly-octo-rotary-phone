// Shared memory per customer, keyed by verified phone (or email). The same row serves web chat and SMS (and later IG/FB),
// so a customer who texts after chatting on the site is recognised. Stored in customer_memory via repo().
//
// Safety rules:
//   * Only loaded/written for a VERIFIED key (SMS From number, or a web phone that passed the code step). An
//     unverified web visitor can never pull someone else's memory by typing their number.
//   * The summary is derived from customer text, so it is UNTRUSTED when it is fed back to the model: it is sanitised,
//     bounded and delivered inside the fenced state block, never in the system prompt.
//   * Long histories are folded into short topic lines (deterministic extractive summary; no extra model spend).
import { repo, type CustomerMemory } from '@/lib/db';
import { sanitizeUntrusted } from './guardrails';
import type { ConvState } from './state';
import type { Channel } from './types';

export const phoneKey = (e164: string) => `p:${e164}`;
export const emailKey = (email: string) => `e:${email.trim().toLowerCase()}`;

export type MemoryFacts = {
  name?: string; email?: string; zip?: string; sizeClass?: string; services?: string[];
  vehicle?: { year?: number; make?: string; model?: string };
  topics?: string[];
};

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const MAX_TOPICS = 8;

export async function loadMemory(key: string | null): Promise<CustomerMemory | null> {
  if (!key) return null;
  return repo().customer_memory.first({ where: { customer_key: key } });
}

/** First sentence of each customer message, shortened. Used to fold old turns into the stored summary. */
export function summarizeTurns(turns: { role: 'user' | 'assistant'; content: string }[]): string[] {
  return turns
    .filter((t) => t.role === 'user')
    .map((t) => sanitizeUntrusted(t.content, 160).text.split(/(?<=[.!?])\s/)[0] ?? '')
    .map((s) => clip(s.replace(/\s+/g, ' ').trim(), 110))
    .filter((s) => s.length > 3);
}

export function renderSummary(f: MemoryFacts): string {
  const parts: string[] = [];
  if (f.name) parts.push(`Name: ${f.name}.`);
  if (f.vehicle && (f.vehicle.make || f.vehicle.model)) parts.push(`Vehicle: ${[f.vehicle.year, f.vehicle.make, f.vehicle.model].filter(Boolean).join(' ')}${f.sizeClass ? ` (${f.sizeClass})` : ''}.`);
  if (f.zip) parts.push(`ZIP: ${f.zip}.`);
  if (f.services?.length) parts.push(`Asked about: ${f.services.join(', ')}.`);
  if (f.topics?.length) parts.push(`Earlier topics: ${f.topics.join(' | ')}.`);
  return clip(parts.join(' '), 900);
}

/** Merge what this conversation learned into the customer's memory. Safe to call every turn. */
export async function rememberTurn(opts: { key: string; channel: Channel; state: ConvState; newTopics: string[]; customerId?: string | null; newConversation?: boolean; now?: number }): Promise<void> {
  const db = repo();
  const existing = await loadMemory(opts.key);
  const old = (existing?.facts ?? {}) as MemoryFacts;
  const c = opts.state.collected;
  const merged: MemoryFacts = {
    ...old,
    ...(c.name ? { name: clip(sanitizeUntrusted(c.name, 60).text, 60) } : {}),
    ...(c.email ? { email: c.email } : {}),
    ...(c.zip ? { zip: c.zip } : {}),
    ...(c.sizeClass ? { sizeClass: c.sizeClass } : {}),
    ...(c.services?.length ? { services: [...new Set([...(old.services ?? []), ...c.services])].slice(-4) } : {}),
    ...(c.vehicle?.make ? { vehicle: { ...old.vehicle, ...c.vehicle } } : {}),
    topics: [...(old.topics ?? []), ...opts.newTopics].slice(-MAX_TOPICS),
  };
  const row = {
    summary: renderSummary(merged), facts: merged as unknown as Record<string, unknown>, last_channel: opts.channel,
    last_seen_at: new Date(opts.now ?? Date.now()).toISOString(), customer_id: opts.customerId ?? existing?.customer_id ?? null,
    conversation_count: (existing?.conversation_count ?? 0) + (opts.newConversation || !existing ? 1 : 0),
  };
  if (existing) await db.customer_memory.update(existing.id, row);
  else await db.customer_memory.insert({ customer_key: opts.key, ...row });
}

/** What the model sees. Sanitised, bounded, clearly labelled as notes from earlier chats (data, not instructions). */
export function memoryForModel(m: CustomerMemory | null): string | null {
  if (!m || !m.summary) return null;
  return sanitizeUntrusted(m.summary, 900).text;
}
