// SMS opt-out / opt-in / help, done in code BEFORE any model call (TCPA). Mirrors the keywords Twilio handles by itself so
// our database agrees with the carrier-side block: STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT / START, UNSTOP, YES / HELP.
import { repo } from '@/lib/db';
import { isStartKeyword, isStopKeyword } from '@/lib/sms';

export const isHelpKeyword = (body: string) => /^\s*(help|info)\s*[.!]?\s*$/i.test(body);
export type SmsKeyword = 'stop' | 'start' | 'help' | null;
export const smsKeyword = (body: string): SmsKeyword => (isStopKeyword(body) ? 'stop' : isStartKeyword(body) ? 'start' : isHelpKeyword(body) ? 'help' : null);

export async function applyOptOut(phone: string, now = Date.now()): Promise<void> {
  const db = repo();
  const at = new Date(now).toISOString();
  const rows = await db.customers.list({ where: { phone } });
  if (rows.length === 0) { await db.customers.insert({ name: 'SMS contact', phone, sms_opt_in: false, sms_opt_out_at: at }); return; }
  for (const c of rows) await db.customers.update(c.id, { sms_opt_in: false, sms_opt_out_at: at });
}

export async function applyOptIn(phone: string): Promise<void> {
  // START clears the block. It does NOT grant marketing/reminder consent: that is only recorded at booking.
  for (const c of await repo().customers.list({ where: { phone } })) await repo().customers.update(c.id, { sms_opt_out_at: null });
}

export async function isOptedOut(phone: string | null | undefined): Promise<boolean> {
  if (!phone) return false;
  return (await repo().customers.list({ where: { phone } })).some((c) => Boolean(c.sms_opt_out_at));
}
