// Transactional email. Live = Resend REST. Mock = logged + in-memory outbox.
import { log } from '@/lib/api/log';

export type EmailResult = { ok: boolean; id?: string; mock: boolean; error?: string };
export type EmailItem = { to: string; subject: string; text: string; at: string };
const G = globalThis as unknown as { __emailOutbox?: EmailItem[] };
export const emailOutbox = (): EmailItem[] => (G.__emailOutbox ??= []);

export const isEmailLive = (): boolean => Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);

export async function sendEmail(msg: { to: string; subject: string; text: string; html?: string }): Promise<EmailResult> {
  if (!isEmailLive()) {
    emailOutbox().push({ to: msg.to, subject: msg.subject, text: msg.text, at: new Date().toISOString() });
    if (emailOutbox().length > 200) emailOutbox().shift();
    log('info', 'email.mock', { subject: msg.subject });
    return { ok: true, id: `emailmock${Date.now()}`, mock: true };
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html }),
    });
    const j = (await res.json().catch(() => ({}))) as { id?: string };
    if (!res.ok) { log('warn', 'email.failed', { status: res.status }); return { ok: false, mock: false, error: `resend_${res.status}` }; }
    return { ok: true, id: j.id, mock: false };
  } catch (e) {
    log('warn', 'email.error', { error: (e as Error).name });
    return { ok: false, mock: false, error: 'network' };
  }
}
