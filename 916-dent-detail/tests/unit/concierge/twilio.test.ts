import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import twilio from 'twilio';
import { repo } from '@/lib/db';
import { twilioSignature, validateTwilioSignature, publicWebhookUrl, authenticateWebhook, mediaToAttachments, escapeXml } from '@/lib/concierge/twilio';
import { POST as smsPost } from '@/app/api/sms/route';
import { POST as voicePost } from '@/app/api/voice/missed/route';
import { POST as incomingPost } from '@/app/api/voice/incoming/route';
import { smsOutbox } from '@/lib/sms';
import { NOW, PHONE, freshDb } from '../../bot/harness';

const TOKEN = 'test_auth_token_123';
const URL_ = 'https://916dentdetail.com/api/sms';
const form = (p: Record<string, string>) => new URLSearchParams(p).toString();
const req = (url: string, params: Record<string, string>, sig?: string) =>
  new Request(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', ...(sig ? { 'x-twilio-signature': sig } : {}) }, body: form(params) });
const liveEnv = () => { process.env.TWILIO_ACCOUNT_SID = 'AC123'; process.env.TWILIO_AUTH_TOKEN = TOKEN; process.env.TWILIO_FROM_NUMBER = '+19165550100'; process.env.NEXT_PUBLIC_SITE_URL = 'https://916dentdetail.com'; };

beforeEach(async () => { await freshDb(); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); delete process.env.NEXT_PUBLIC_SITE_URL; delete process.env.SMS_REPLY_MODE; });

describe('signature validation', () => {
  it("matches Twilio's own implementation byte for byte", () => {
    const params = { From: '+19165550142', Body: 'Hello there', MessageSid: 'SM123', To: '+19165550100', NumMedia: '0' };
    expect(twilioSignature(TOKEN, URL_, params)).toBe(twilio.getExpectedTwilioSignature(TOKEN, URL_, params));
    expect(validateTwilioSignature(TOKEN, twilio.getExpectedTwilioSignature(TOKEN, URL_, params), URL_, params)).toBe(true);
    expect(twilio.validateRequest(TOKEN, twilioSignature(TOKEN, URL_, params), URL_, params)).toBe(true);
  });
  it('rejects a wrong token, wrong URL, tampered body, missing header', () => {
    const params = { From: '+19165550142', Body: 'Hi' };
    const sig = twilioSignature(TOKEN, URL_, params);
    expect(validateTwilioSignature('other', sig, URL_, params)).toBe(false);
    expect(validateTwilioSignature(TOKEN, sig, `${URL_}?x=1`, params)).toBe(false);
    expect(validateTwilioSignature(TOKEN, sig, URL_, { ...params, Body: 'Hi!' })).toBe(false);
    expect(validateTwilioSignature(TOKEN, null, URL_, params)).toBe(false);
  });
  it('uses the configured public base URL (proxies rewrite req.url) and keeps the query string', () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://916dentdetail.com/';
    expect(publicWebhookUrl(new Request('http://internal:3000/api/sms?a=1'))).toBe('https://916dentdetail.com/api/sms?a=1');
    process.env.TWILIO_WEBHOOK_BASE_URL = 'https://hooks.example.com';
    expect(publicWebhookUrl(new Request('http://internal:3000/api/sms'))).toBe('https://hooks.example.com/api/sms');
    delete process.env.TWILIO_WEBHOOK_BASE_URL;
  });
  it('auth matrix: offline demo = ok; Supabase live without Twilio = refuse; Twilio live = signature required', () => {
    const r = new Request(URL_, { method: 'POST' });
    expect(authenticateWebhook(r, {})).toBe('ok');
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
    expect(authenticateWebhook(r, {})).toBe('unconfigured');
    liveEnv();
    expect(authenticateWebhook(r, {})).toBe('bad_signature');
    for (const k of ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER']) delete process.env[k];
  });
  it('escapes XML in TwiML', () => { expect(escapeXml(`a<b>&"c'`)).toBe('a&lt;b&gt;&amp;&quot;c&apos;'); });
});

describe('POST /api/sms', () => {
  it('offline demo: replies as TwiML, creates the lead as source sms', async () => {
    const res = await smsPost(req('http://localhost:3000/api/sms', { From: PHONE, Body: 'hi, what do you offer?', MessageSid: 'SM1' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/xml');
    const xml = await res.text();
    expect(xml).toMatch(/<Response><Message>.+<\/Message><\/Response>/);
    expect((await repo().leads.list())[0]).toMatchObject({ source: 'sms', phone: PHONE });
  });
  it('duplicate MessageSid (Twilio retry) is processed once', async () => {
    const p = { From: PHONE, Body: 'hello', MessageSid: 'SMdup' };
    const a = await (await smsPost(req('http://localhost:3000/api/sms', p))).text();
    const b = await (await smsPost(req('http://localhost:3000/api/sms', p))).text();
    expect(a).toContain('<Message>');
    expect(b).not.toContain('<Message>');
    expect((await repo().messages.list({ where: { role: 'user' } }))).toHaveLength(1);
  });
  it('STOP via the webhook records the opt-out and answers with the confirmation', async () => {
    const xml = await (await smsPost(req('http://localhost:3000/api/sms', { From: PHONE, Body: 'STOP', MessageSid: 'SMs' }))).text();
    expect(xml).toMatch(/unsubscribed/i);
    expect((await repo().customers.list({ where: { phone: PHONE } }))[0]!.sms_opt_out_at).toBeTruthy();
  });
  it('Supabase live but Twilio unconfigured: 503, no processing (nobody can impersonate a phone)', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'k';
    try {
      const res = await smsPost(req('http://localhost:3000/api/sms', { From: PHONE, Body: 'hi', MessageSid: 'SMx' }));
      expect(res.status).toBe(503);
    } finally { delete process.env.NEXT_PUBLIC_SUPABASE_URL; delete process.env.SUPABASE_SERVICE_ROLE_KEY; }
  });
  it('live: unsigned or badly signed requests are 403 and touch nothing', async () => {
    liveEnv();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ sid: 'SMout' }), { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const p = { From: PHONE, Body: 'hi', MessageSid: 'SMlive1' };
    expect((await smsPost(req(URL_, p))).status).toBe(403);
    expect((await smsPost(req(URL_, p, 'AAAA'))).status).toBe(403);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await repo().conversations.list()).toHaveLength(0);
  });
  it('live: a correctly signed request is answered with empty TwiML and the reply goes out through the sms lib', async () => {
    liveEnv();
    const sent: { To: string; Body: string }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_u: unknown, init?: RequestInit) => { const f = new URLSearchParams(String(init?.body)); sent.push({ To: f.get('To')!, Body: f.get('Body')! }); return new Response(JSON.stringify({ sid: 'SMout' }), { status: 201 }); }));
    const p = { From: PHONE, Body: 'what services do you offer?', MessageSid: 'SMlive2' };
    const res = await smsPost(req(URL_, p, twilioSignature(TOKEN, URL_, p)));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('<?xml version="1.0" encoding="UTF-8"?><Response></Response>');
    expect(sent).toHaveLength(1);
    expect(sent[0]!.To).toBe(PHONE);
    expect(sent[0]!.Body.length).toBeGreaterThan(10);
  });
  it('live: STOP is recorded but we do not send a second confirmation (Twilio already did)', async () => {
    liveEnv();
    const fetchMock = vi.fn(async () => new Response('{}', { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    const p = { From: PHONE, Body: 'STOP', MessageSid: 'SMlive3' };
    await smsPost(req(URL_, p, twilioSignature(TOKEN, URL_, p)));
    expect(fetchMock).not.toHaveBeenCalled();
    expect((await repo().customers.list({ where: { phone: PHONE } }))[0]!.sms_opt_out_at).toBeTruthy();
  });
  it('MMS: only Twilio-hosted images are fetched; other hosts and non-images are ignored', async () => {
    liveEnv();
    const fetchMock = vi.fn(async () => new Response(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40)]), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const out = await mediaToAttachments({ NumMedia: '3', MediaUrl0: 'https://api.twilio.com/2010-04-01/Accounts/AC/Messages/MM/Media/ME1', MediaContentType0: 'image/jpeg', MediaUrl1: 'https://evil.example.com/x.jpg', MediaContentType1: 'image/jpeg', MediaUrl2: 'https://api.twilio.com/x', MediaContentType2: 'application/pdf' });
    expect(out).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(out[0]!.path).toMatch(/^quotes\/.+\.jpg$/);
  });
});

describe('POST /api/voice/missed', () => {
  const vurl = 'http://localhost:3000/api/voice/missed';
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(NOW); }); // Mon 10:00 Pacific: not quiet hours
  it('no-answer: texts the caller back (AI disclosure + STOP line) and hangs up politely', async () => {
    const res = await voicePost(req(vurl, { From: PHONE, CallSid: 'CA1', DialCallStatus: 'no-answer' }));
    expect(res.status).toBe(200);
    expect(await res.text()).toMatch(/<Say>.*text.*<\/Say><Hangup\/>/);
    const out = smsOutbox().filter((m) => m.to === PHONE);
    expect(out).toHaveLength(1);
    expect(out[0]!.body).toMatch(/AI assistant/);
    expect(out[0]!.body).toMatch(/Reply STOP/);
  });
  it('?mode=forwarded: every call that reaches the number counts (carrier forwards only unanswered calls)', async () => {
    await voicePost(req(`${vurl}?mode=forwarded`, { From: '+19165550143', CallSid: 'CA9', CallStatus: 'ringing' }));
    expect(smsOutbox().filter((m) => m.to === '+19165550143')).toHaveLength(1);
  });
  it('answered calls trigger nothing', async () => {
    await voicePost(req(vurl, { From: PHONE, CallSid: 'CA2', DialCallStatus: 'completed' }));
    expect(smsOutbox()).toHaveLength(0);
  });
  it('rejects unsigned requests when Twilio is live', async () => {
    liveEnv();
    vi.stubGlobal('fetch', vi.fn());
    expect((await voicePost(req('https://916dentdetail.com/api/voice/missed', { From: PHONE, DialCallStatus: 'no-answer' }))).status).toBe(403);
  });
  it('incoming: forwards to the owners then reports back to /missed', async () => {
    process.env.OWNER_ALERT_PHONES = '+19165550101'; process.env.NEXT_PUBLIC_SITE_URL = 'https://916dentdetail.com';
    const xml = await (await incomingPost(req('http://localhost:3000/api/voice/incoming', { From: PHONE, CallSid: 'CA3' }))).text();
    expect(xml).toContain('<Number>+19165550101</Number>');
    expect(xml).toContain('action="https://916dentdetail.com/api/voice/missed"');
  });
});
