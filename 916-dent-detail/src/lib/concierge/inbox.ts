// Staff side of the needs-human inbox: who a conversation can be texted at, send a reply on the SMS channel (mock or live),
// record it in the transcript, and mark the conversation resolved (hands it back to the bot).
// Reads/lists live in state.ts (listNeedsHuman, conversationTranscript, resumeConversation).
import { repo } from '@/lib/db';
import { log, maskPhone } from '@/lib/api/log';
import { normalizePhone, sendSms } from '@/lib/sms';
import { isOptedOut } from './optout';
import { loadConversationById, recordMessage, resumeConversation, saveState } from './state';

export const STAFF_REPLY_MAX = 600;

/** The number we may text for this conversation: the channel-verified phone, else the lead's phone (set only from a verified number). */
export async function inboxPhone(conversationId: string): Promise<string | null> {
  const rec = await loadConversationById(conversationId);
  if (!rec) return null;
  const db = repo();
  const lead = rec.conv.lead_id ? await db.leads.get(rec.conv.lead_id) : null;
  const customer = rec.conv.customer_id ? await db.customers.get(rec.conv.customer_id) : null;
  return normalizePhone(rec.state.verifiedPhone ?? lead?.phone ?? customer?.phone ?? null);
}

export type StaffReplyResult = { ok: true; mock: boolean } | { ok: false; error: 'not_found' | 'empty' | 'too_long' | 'no_phone' | 'opted_out' | 'send_failed' };

/** Text the customer from the inbox. Refuses with no verified number or after STOP. The bot stays paused until someone resolves. */
export async function staffReply(conversationId: string, text: string, actor: string, now = Date.now()): Promise<StaffReplyResult> {
  const body = String(text ?? '').trim();
  if (!body) return { ok: false, error: 'empty' };
  if (body.length > STAFF_REPLY_MAX) return { ok: false, error: 'too_long' };
  const rec = await loadConversationById(conversationId);
  if (!rec) return { ok: false, error: 'not_found' };
  const phone = await inboxPhone(conversationId);
  if (!phone) return { ok: false, error: 'no_phone' };
  if (await isOptedOut(phone)) return { ok: false, error: 'opted_out' };
  const sent = await sendSms(phone, body);
  if (!sent.ok) { log('warn', 'inbox.reply_failed', { conversation: conversationId, to: maskPhone(phone), error: sent.error }); return { ok: false, error: 'send_failed' }; }
  await recordMessage(conversationId, 'assistant', body, { by: 'staff', actor, channel: 'sms' });
  await saveState(rec, { last_message_at: new Date(now).toISOString() });
  await repo().events.insert({ type: 'concierge.staff_reply', entity_type: 'conversation', entity_id: conversationId, actor, data: { chars: body.length, mock: sent.mock } });
  return { ok: true, mock: sent.mock };
}

export async function resolveConversation(conversationId: string, actor: string): Promise<boolean> {
  const rec = await loadConversationById(conversationId);
  if (!rec) return false;
  await resumeConversation(conversationId);
  await repo().events.insert({ type: 'concierge.resolved', entity_type: 'conversation', entity_id: conversationId, actor, data: {} });
  return true;
}
