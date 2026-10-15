// SMS sender. Live = Twilio REST (no SDK needed). Mock = logged + kept in an in-memory outbox.
import { log, maskPhone } from '@/lib/api/log';

export type SendResult = { ok: boolean; id?: string; mock: boolean; error?: string };
export type OutboxItem = { to: string; body: string; at: string };

const G = globalThis as unknown as { __smsOutbox?: OutboxItem[] };
export const smsOutbox = (): OutboxItem[] => (G.__smsOutbox ??= []);

export const isSmsLive = (): boolean =>
  Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID));

/** US numbers to E.164. Returns null if it cannot be a valid NANP number. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = raw.replace(/[^\d]/g, '');
  const ten = d.length === 11 && d.startsWith('1') ? d.slice(1) : d.length === 10 ? d : null;
  if (!ten || !/^[2-9]\d{2}[2-9]\d{6}$/.test(ten)) return null;
  return `+1${ten}`;
}

const STOP = /^\s*(stop|stopall|unsubscribe|cancel|end|quit)\s*[.!]?\s*$/i;
const START = /^\s*(start|unstop|yes)\s*[.!]?\s*$/i;
export const isStopKeyword = (body: string) => STOP.test(body);
export const isStartKeyword = (body: string) => START.test(body);

export async function sendSms(to: string, body: string): Promise<SendResult> {
  if (!isSmsLive()) {
    smsOutbox().push({ to, body, at: new Date().toISOString() });
    if (smsOutbox().length > 200) smsOutbox().shift();
    log('info', 'sms.mock', { to: maskPhone(to), chars: body.length });
    return { ok: true, id: `SMmock${Date.now()}`, mock: true };
  }
  try {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const form = new URLSearchParams({ To: to, Body: body });
    if (process.env.TWILIO_MESSAGING_SERVICE_SID) form.set('MessagingServiceSid', process.env.TWILIO_MESSAGING_SERVICE_SID);
    else form.set('From', process.env.TWILIO_FROM_NUMBER!);
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    const j = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
    if (!res.ok) { log('warn', 'sms.failed', { status: res.status, code: j.code }); return { ok: false, mock: false, error: `twilio_${res.status}${j.code ? `_${j.code}` : ''}` }; }
    log('info', 'sms.sent', { to: maskPhone(to) });
    return { ok: true, id: j.sid, mock: false };
  } catch (e) {
    log('warn', 'sms.error', { error: (e as Error).name });
    return { ok: false, mock: false, error: 'network' };
  }
}
