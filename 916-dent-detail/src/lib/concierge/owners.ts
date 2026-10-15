// Escalation: mark the conversation "needs human", pause the bot, text the owners a summary. Owner phones come from
// OWNER_ALERT_PHONES; with none configured the alert is logged (mock) and the admin inbox is the only signal.
import { log, maskPhone } from '@/lib/api/log';
import { repo } from '@/lib/db';
import { isSmsLive, sendSms } from '@/lib/sms';
import { ownerAlertPhones } from './config';
import { sanitizeUntrusted } from './guardrails';
import { saveState, reasonLabel, type ConvRecord } from './state';
import type { ChannelIdentity, EscalationReason } from './types';
import { verifiedPhoneOf } from './authz';

const clean = (s: string, n: number) => sanitizeUntrusted(s, n).text.replace(/https?:\/\/\S+|www\.\S+/gi, '[link removed]').replace(/\s+/g, ' ').trim().slice(0, n);

export async function notifyOwners(text: string): Promise<{ sent: number }> {
  const phones = ownerAlertPhones();
  if (phones.length === 0) {
    log('warn', 'concierge.owner_alert_unconfigured', { chars: text.length });
    // Mock mode keeps the alert in the in-memory outbox so it is visible in dev/tests. Live mode never texts a made-up number.
    if (!isSmsLive()) await sendSms('owner:unconfigured', text);
    return { sent: 0 };
  }
  let sent = 0;
  for (const p of phones) if ((await sendSms(p, text)).ok) sent++;
  return { sent };
}

/**
 * Hand the conversation to a person. Idempotent per conversation for 30 minutes (no owner-text spam). The summary is model
 * written from customer text, so it is sanitised, link-stripped and clipped before it goes into an SMS.
 */
export async function escalate(rec: ConvRecord, identity: ChannelIdentity, reason: EscalationReason, summary: string, now = Date.now()): Promise<{ texted: boolean }> {
  const phone = verifiedPhoneOf(identity, rec.state);
  const recent = rec.state.ownerTextedAt && now - rec.state.ownerTextedAt < 30 * 60_000;
  rec.state.paused = true;
  let texted = false;
  if (!recent) {
    const who = phone ? `Customer ${phone}` : 'Customer (no verified phone yet; see inbox)';
    const body = `916 Concierge needs you: ${reasonLabel[reason]} via ${identity.channel}. ${who}. Said (unverified): "${clean(summary, 240)}" Conv ${rec.conv.id.slice(0, 8)}.`;
    await notifyOwners(body);
    rec.state.ownerTextedAt = now;
    texted = true;
  }
  const lastUserNote = clean(summary, 300);
  await saveState(rec, { status: 'escalated', needs_human: true, escalation_reason: reason, escalated_at: rec.conv.escalated_at ?? new Date(now).toISOString(), summary: lastUserNote });
  await repo().events.insert({ type: 'concierge.escalated', entity_type: 'conversation', entity_id: rec.conv.id, actor: 'system', data: { reason, channel: identity.channel, texted } });
  log('info', 'concierge.escalated', { conversation: rec.conv.id, reason, channel: identity.channel, phone: maskPhone(phone) });
  return { texted };
}
