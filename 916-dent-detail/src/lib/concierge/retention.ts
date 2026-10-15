// Transcript retention. Chat and SMS transcripts are customer PII: after `retentionDays()` days of silence the messages are
// deleted and the conversation row is scrubbed (summary, bot state incl. verified phone / offered slots / collected name+email),
// and the shared memory row for a number that has gone quiet is deleted. What stays: the conversation shell, the lead and
// customer records (CRM, governed separately), cost totals, and event rows (no PII by rule). Open escalations are never purged
// (a person still has to deal with them).
import { log } from '@/lib/api/log';
import { repo } from '@/lib/db';
import { retentionDays } from './config';
import { emptyState } from './state';

const DAY = 86_400_000;
export type PurgeResult = { cutoff: string; days: number; conversations: number; messages: number; memories: number };

export async function purgeOldTranscripts(now = Date.now(), days = retentionDays(), batch = 500): Promise<PurgeResult> {
  const db = repo();
  const cutoffMs = now - days * DAY;
  const cutoff = new Date(cutoffMs).toISOString();
  let conversations = 0, messages = 0, memories = 0;

  // updated_at < cutoff is a cheap pre-filter; the real age is the last message (or creation when none)
  const candidates = await db.conversations.list({ ranges: [{ col: 'updated_at', lt: cutoff }], orderBy: 'updated_at', limit: batch });
  for (const c of candidates) {
    if (c.needs_human) continue;
    const last = Math.max(Date.parse(c.created_at), c.last_message_at ? Date.parse(c.last_message_at) : 0);
    if (!(last < cutoffMs)) continue;
    const msgs = await db.messages.list({ where: { conversation_id: c.id } });
    for (const m of msgs) { await db.messages.remove(m.id); messages++; }
    // already scrubbed and empty: nothing to do (keeps the job idempotent and the counts honest)
    const st = (c.state ?? {}) as { purged?: boolean };
    if (!msgs.length && !c.summary && st.purged) continue;
    await db.conversations.update(c.id, { summary: null, state: { ...emptyState(), purged: true } as unknown as Record<string, unknown>, status: 'closed' });
    conversations++;
  }

  const mem = await db.customer_memory.list({ ranges: [{ col: 'updated_at', lt: cutoff }], limit: batch });
  for (const m of mem) {
    const seen = Math.max(Date.parse(m.created_at), m.last_seen_at ? Date.parse(m.last_seen_at) : 0);
    if (seen < cutoffMs) { await db.customer_memory.remove(m.id); memories++; }
  }
  log('info', 'concierge.retention', { days, conversations, messages, memories });
  return { cutoff, days, conversations, messages, memories };
}
