// Missed-call text-back. A caller who reaches nobody gets a friendly text within 60 seconds that starts the bot
// conversation (their reply lands on /api/sms and continues the same SMS conversation).
//
// Rules, all enforced here in code:
//   * dedupe: one text-back per number per `dedupeHours`, and none while a chat with that number is already active
//   * quiet hours (9pm-8am local): do not text now; the opener is queued on the conversation and sent by
//     /api/concierge/cron at the next window
//   * opt-outs: a number that said STOP is never texted
//   * caller id: blocked/invalid numbers and our own owner phones are skipped
//   * the opener says it is an AI assistant and carries the STOP line (first message of a conversation)
// No PII in events: the dedupe ledger is keyed by a keyed hash of the number.
import { log, maskPhone } from '@/lib/api/log';
import { notifyConfig } from '@/config/booking';
import { site } from '@/config/site';
import { repo } from '@/lib/db';
import { isQuietHour, nextSmsWindow } from '@/lib/notify/schedule';
import { normalizePhone, sendSms } from '@/lib/sms';
import { conciergeConfig, ownerAlertPhones } from './config';
import { hashKey } from './guardrails';
import { isOptedOut } from './optout';
import { ensureLead, findOrCreateConversation, recordMessage, saveState, smsExternalId } from './state';
import type { ChannelIdentity } from './types';

export const MISSED_CALL_OPENER = `Hi, this is ${site.name}. Sorry we missed your call! I'm the 916 Concierge, an AI assistant. What can I help with? You can text a photo of the dent for a quick price range. Reply STOP to opt out.`;

export type MissedCallOutcome =
  | { action: 'sent'; withinSec: number }
  | { action: 'deferred'; sendAt: string }
  | { action: 'skipped'; reason: 'invalid_number' | 'owner_number' | 'opted_out' | 'deduped' | 'active_conversation' | 'send_failed' };

/** Twilio <Dial action> / status callback: did the caller reach a person? */
export function wasMissed(p: Record<string, string>): boolean {
  const dial = (p.DialCallStatus ?? '').toLowerCase();
  const call = (p.CallStatus ?? '').toLowerCase();
  if (dial) return ['no-answer', 'busy', 'failed', 'canceled'].includes(dial);
  return ['no-answer', 'busy', 'failed'].includes(call);
}

export async function handleMissedCall(p: { from: string; callSid?: string; now?: number; receivedAtMs?: number }): Promise<MissedCallOutcome> {
  const now = p.now ?? Date.now();
  const db = repo();
  const phone = normalizePhone(p.from);
  if (!phone) return { action: 'skipped', reason: 'invalid_number' };
  if (ownerAlertPhones().includes(phone)) return { action: 'skipped', reason: 'owner_number' };
  if (await isOptedOut(phone)) return { action: 'skipped', reason: 'opted_out' };

  const key = hashKey(`missed:${phone}`);
  const windowMs = conciergeConfig.missedCall.dedupeHours * 3_600_000;
  const prior = await db.events.list({ where: { type: 'concierge.missed_call', entity_id: key }, orderBy: 'created_at', desc: true, limit: 5 });
  if (prior.some((e) => now - Number((e.data as { at?: number }).at ?? 0) < windowMs)) return { action: 'skipped', reason: 'deduped' };

  const identity: ChannelIdentity = { channel: 'sms', externalId: smsExternalId(phone), phone, phoneVerified: true };
  const rec = await findOrCreateConversation(identity);
  const lastMs = rec.conv.last_message_at ? Date.parse(rec.conv.last_message_at) : 0;
  if (lastMs && now - lastMs < conciergeConfig.missedCall.dedupeHours * 3_600_000) return { action: 'skipped', reason: 'active_conversation' };

  await db.events.insert({ type: 'concierge.missed_call', entity_type: 'phone', entity_id: key, actor: 'system', data: { at: now, call: (p.callSid ?? '').slice(0, 40) } });
  await ensureLead(rec, 'sms', { phone, notes: 'Missed call; text-back started.' });

  if (isQuietHour(now, notifyConfig.quiet)) {
    const sendAt = nextSmsWindow(now, notifyConfig.quiet);
    rec.state.pendingOpener = { sendAfter: sendAt };
    await saveState(rec);
    log('info', 'concierge.missed_call_deferred', { phone: maskPhone(phone) });
    return { action: 'deferred', sendAt: new Date(sendAt).toISOString() };
  }
  return sendOpener(rec, phone, now, p.receivedAtMs);
}

async function sendOpener(rec: Awaited<ReturnType<typeof findOrCreateConversation>>, phone: string, now: number, receivedAtMs?: number): Promise<MissedCallOutcome> {
  const r = await sendSms(phone, MISSED_CALL_OPENER);
  if (!r.ok) { log('warn', 'concierge.missed_call_send_failed', { phone: maskPhone(phone) }); return { action: 'skipped', reason: 'send_failed' }; }
  await recordMessage(rec.conv.id, 'assistant', MISSED_CALL_OPENER, { kind: 'missed_call_opener' });
  rec.state.pendingOpener = undefined;
  await saveState(rec, { last_message_at: new Date(now).toISOString() });
  log('info', 'concierge.missed_call_sent', { phone: maskPhone(phone) });
  return { action: 'sent', withinSec: receivedAtMs ? Math.max(0, Math.round((Date.now() - receivedAtMs) / 1000)) : 0 };
}

/** Cron: send openers that were held for quiet hours. Safe to call every few minutes. */
export async function flushDeferredOpeners(now = Date.now()): Promise<{ sent: number; skipped: number }> {
  const db = repo();
  const convs = await db.conversations.list({ where: { channel: 'sms' }, orderBy: 'created_at', desc: true, limit: 200 });
  let sent = 0; let skipped = 0;
  for (const c of convs) {
    const st = (c.state ?? {}) as { pendingOpener?: { sendAfter: number } };
    if (!st.pendingOpener || st.pendingOpener.sendAfter > now) continue;
    if (isQuietHour(now, notifyConfig.quiet)) continue;
    const lead = c.lead_id ? await db.leads.get(c.lead_id) : null;
    const phone = normalizePhone(lead?.phone);
    const rec = (await findOrCreateConversation({ channel: 'sms', externalId: c.external_id ?? '', phone, phoneVerified: true }));
    if (!phone || (await isOptedOut(phone))) { rec.state.pendingOpener = undefined; await saveState(rec); skipped++; continue; }
    const o = await sendOpener(rec, phone, now);
    if (o.action === 'sent') sent++; else skipped++;
  }
  return { sent, skipped };
}
