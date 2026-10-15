// Twilio webhook plumbing without the SDK: signature validation (HMAC-SHA1 over URL + sorted params), TwiML helpers,
// and a hardened MMS media fetch. Signature validation is REQUIRED whenever Twilio is configured, and also whenever
// real customer data is (Supabase live): an unsigned webhook would let anyone impersonate any phone number.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { savePhoto } from '@/lib/booking/photos';
import { isSupabaseLive } from '@/lib/db';
import { isSmsLive } from '@/lib/sms';
import { site } from '@/config/site';
import type { Attachment } from './types';

export function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join('');
  return createHmac('sha1', authToken).update(data, 'utf8').digest('base64');
}

export function validateTwilioSignature(authToken: string, signature: string | null, url: string, params: Record<string, string>): boolean {
  if (!signature) return false;
  const a = Buffer.from(signature);
  const b = Buffer.from(twilioSignature(authToken, url, params));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** The URL Twilio actually requested. Behind a proxy `req.url` can be internal, so the public base is configurable. */
export function publicWebhookUrl(req: Request): string {
  const u = new URL(req.url);
  const base = (process.env.TWILIO_WEBHOOK_BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
  return base ? `${base}${u.pathname}${u.search}` : u.toString();
}

export type WebhookAuth = 'ok' | 'bad_signature' | 'unconfigured';
export function authenticateWebhook(req: Request, params: Record<string, string>): WebhookAuth {
  const live = isSmsLive();
  if (!live) return isSupabaseLive() ? 'unconfigured' : 'ok'; // fully offline demo: no real data, no real sends
  const ok = validateTwilioSignature(process.env.TWILIO_AUTH_TOKEN!, req.headers.get('x-twilio-signature'), publicWebhookUrl(req), params);
  return ok ? 'ok' : 'bad_signature';
}

export const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
export const twiml = (inner = '') => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, { status: 200, headers: { 'Content-Type': 'text/xml; charset=utf-8', 'Cache-Control': 'no-store' } });
export const twimlMessage = (text: string) => twiml(`<Message>${escapeXml(text)}</Message>`);

export async function formParams(req: Request): Promise<Record<string, string>> {
  const text = await req.text();
  if (text.length > 64_000) throw new Error('too_large');
  const out: Record<string, string> = {};
  for (const [k, v] of new URLSearchParams(text)) out[k] = v;
  return out;
}

/** MMS photos from a signed inbound message. Only Twilio's own API host is fetched (no SSRF), only images are kept. */
export async function mediaToAttachments(p: Record<string, string>): Promise<Attachment[]> {
  const n = Math.min(Number(p.NumMedia ?? 0) || 0, 3);
  if (!n || !isSmsLive()) return [];
  const out: Attachment[] = [];
  const auth = `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`;
  for (let i = 0; i < n; i++) {
    const url = p[`MediaUrl${i}`];
    const type = p[`MediaContentType${i}`] ?? '';
    if (!url || !/^image\/(jpeg|png|webp)$/.test(type)) continue;
    try {
      const u = new URL(url);
      if (u.protocol !== 'https:' || u.hostname !== 'api.twilio.com') continue;
      const res = await fetch(u, { headers: { Authorization: auth }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const saved = await savePhoto(buf); // magic-byte check + size cap
      if (!('error' in saved)) out.push({ path: saved.path });
    } catch { /* skip that image */ }
  }
  return out;
}

export const businessName = site.name;
