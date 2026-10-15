// SMS reminder consent for customers who book through the 916 Concierge (chat or text).
//
// Rule (TCPA-style, deterministic, server-enforced): a chat is never treated as consent to reminder texts. After a deposit
// link goes out, THE SERVER (not the model) appends one fixed question. Only an explicit "REMIND ME" reply, from the
// verified phone of that conversation, records consent (customers.sms_opt_in + timestamp + the exact wording shown).
// "YES" is deliberately NOT accepted: it is also the START keyword and a normal answer to other questions. "NO" records a decline.
// Reminder dispatch (src/lib/notify/dispatch.ts) already requires customers.sms_opt_in && !sms_opt_out_at, so without this
// step a Concierge-booked customer gets email only. A STOP always wins: consent is never re-granted over an opt-out.
import { repo } from '@/lib/db';
import { site } from '@/config/site';
import { verifiedPhoneOf } from './authz';
import type { ConvRecord } from './state';
import type { ChannelIdentity } from './types';

/** Shown to the customer verbatim and stored with the consent record. [OWNER] counsel should review. */
export const CONCIERGE_SMS_CONSENT_QUESTION =
  `Want text reminders for this appointment? Reply REMIND ME to get texts from ${site.name} about it (reminders the day before and 2 hours before, on-the-way alert, receipt, review request). Msg frequency varies, msg & data rates may apply. Reply STOP any time to opt out, HELP for help. Not a condition of purchase. Reply NO THANKS to skip; you'll still get email.`;

export const CONSENT_GRANTED_REPLY = `Done. You'll get appointment texts from ${site.name}. Reply STOP any time to opt out, HELP for help.`;
export const CONSENT_DECLINED_REPLY = "No problem, no texts. You'll get your confirmation and reminders by email.";
export const CONSENT_BLOCKED_REPLY = "You previously replied STOP, so I can't text you until you reply START. Your confirmation and reminders will go by email.";

const YES = /^\s*(yes[,.!\s]+)?(please[,.!\s]+)?(remind(?:\s+me)?|text\s+me|send\s+(?:me\s+)?reminders?)\W*$/i;
const NO = /^\s*(no\b[\s\S]{0,20}|nope|skip)\W*$/i;

export type ConsentAnswer = 'yes' | 'no' | null;
export function parseConsentAnswer(text: string): ConsentAnswer {
  const t = String(text ?? '').trim();
  if (t.length > 40) return null;
  if (YES.test(t)) return 'yes';
  if (NO.test(t) && !/\bremind/i.test(t)) return 'no';
  return null;
}

export type ConsentState = { status: 'asked' | 'granted' | 'declined' | 'blocked'; askedAt: number; answeredAt?: number; wording: string };

/** Should this turn end with the consent question? Called after the model loop, with what the server saw happen. */
export async function consentQuestionDue(rec: ConvRecord, identity: ChannelIdentity, done: { send_deposit_link?: boolean; create_booking?: string }): Promise<boolean> {
  if (rec.state.smsConsent) return false; // asked once per conversation
  if (!done.send_deposit_link && done.create_booking !== 'confirmed') return false;
  const phone = verifiedPhoneOf(identity, rec.state);
  if (!phone) return false;
  const customers = await repo().customers.list({ where: { phone } });
  if (customers.some((c) => c.sms_opt_out_at)) return false; // they said STOP: never prompt again
  if (customers.some((c) => c.sms_opt_in)) return false; // already consented (e.g. on the booking form)
  return true;
}

export function markAsked(rec: ConvRecord, now: number): string {
  rec.state.smsConsent = { status: 'asked', askedAt: now, wording: CONCIERGE_SMS_CONSENT_QUESTION };
  return CONCIERGE_SMS_CONSENT_QUESTION;
}

/** Handle the customer's answer. Returns the reply to send, or null when this message is not an answer (go on to the model). */
export async function handleConsentAnswer(rec: ConvRecord, identity: ChannelIdentity, text: string, now: number): Promise<string | null> {
  const c = rec.state.smsConsent;
  if (!c || c.status !== 'asked') return null;
  const answer = parseConsentAnswer(text);
  if (!answer) return null;
  const phone = verifiedPhoneOf(identity, rec.state);
  if (!phone) return null; // consent is only ever recorded for a verified phone
  const db = repo();
  const customers = await db.customers.list({ where: { phone } });
  const at = new Date(now).toISOString();
  if (answer === 'no') {
    rec.state.smsConsent = { ...c, status: 'declined', answeredAt: now };
    await db.events.insert({ type: 'concierge.sms_consent', entity_type: 'conversation', entity_id: rec.conv.id, actor: 'customer', data: { answer: 'declined' } });
    return CONSENT_DECLINED_REPLY;
  }
  if (customers.some((x) => x.sms_opt_out_at) || customers.length === 0) {
    rec.state.smsConsent = { ...c, status: 'blocked', answeredAt: now };
    return CONSENT_BLOCKED_REPLY;
  }
  for (const x of customers) await db.customers.update(x.id, { sms_opt_in: true, sms_opt_in_at: at, sms_opt_in_text: c.wording });
  rec.state.smsConsent = { ...c, status: 'granted', answeredAt: now };
  await db.events.insert({ type: 'concierge.sms_consent', entity_type: 'conversation', entity_id: rec.conv.id, actor: 'customer', data: { answer: 'granted', channel: identity.channel, at } });
  return CONSENT_GRANTED_REPLY;
}
