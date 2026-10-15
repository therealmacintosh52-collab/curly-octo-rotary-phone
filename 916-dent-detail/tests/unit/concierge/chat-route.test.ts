import { beforeEach, describe, expect, it } from 'vitest';
import { POST as chat, GET as chatGet } from '@/app/api/chat/route';
import { POST as verify } from '@/app/api/concierge/verify/route';
import { GET as history } from '@/app/api/concierge/history/route';
import { GET as cron } from '@/app/api/concierge/cron/route';
import { signSession } from '@/lib/concierge/state';
import { repo } from '@/lib/db';
import { freshDb, uploadPhotos } from '../../bot/harness';

beforeEach(freshDb);
const post = (body: unknown, headers: Record<string, string> = {}) => new Request('http://localhost:3000/api/chat', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.5', ...headers }, body: JSON.stringify(body) });
async function sse(res: Response) {
  const text = await res.text();
  return text.split('\n\n').filter(Boolean).map((f) => ({ event: /^event: (.*)$/m.exec(f)![1]!, data: JSON.parse(/^data: (.*)$/m.exec(f)![1]!) as Record<string, any> })); // eslint-disable-line @typescript-eslint/no-explicit-any
}

describe('POST /api/chat', () => {
  it('streams status, delta chunks and a done event with the session token', async () => {
    const res = await chat(post({ message: 'what services do you offer?' }));
    expect(res.headers.get('content-type')).toContain('text/event-stream');
    const ev = await sse(res);
    expect(ev.some((e) => e.event === 'status')).toBe(true);
    const deltas = ev.filter((e) => e.event === 'delta').map((e) => e.data.text).join('');
    const done = ev.find((e) => e.event === 'done')!.data;
    expect(deltas.trim()).toBe(String(done.reply).trim());
    expect(done.sessionToken).toBeTruthy();
    expect(done.conversationId).toMatch(/^[0-9a-f-]{36}$/);
    expect(done.mock).toBe(true);
  });
  it('JSON mode returns one body; a follow-up needs the matching session token', async () => {
    const a = await (await chat(post({ message: 'hi' }, { accept: 'application/json' }))).json();
    expect(a.reply).toBeTruthy();
    const noToken = await chat(post({ message: 'again', conversationId: a.conversationId }, { accept: 'application/json' }));
    expect(noToken.status).toBe(401);
    const wrong = await chat(post({ message: 'again', conversationId: a.conversationId, sessionToken: signSession('11111111-1111-4111-8111-111111111111') }, { accept: 'application/json' }));
    expect(wrong.status).toBe(401);
    const ok = await chat(post({ message: 'again', conversationId: a.conversationId, sessionToken: a.sessionToken }, { accept: 'application/json' }));
    expect(ok.status).toBe(200);
    expect(await repo().conversations.list()).toHaveLength(1);
  });
  it('rejects malformed bodies and bad attachment paths', async () => {
    expect((await chat(post({ nope: 1 }))).status).toBe(400);
    expect((await chat(post({ message: 'x', attachments: [{ path: '../../etc/passwd' }] }))).status).toBe(400);
    expect((await chat(new Request('http://localhost:3000/api/chat', { method: 'POST', body: 'not json' }))).status).toBe(400);
  });
  it('attaches uploaded photos by path; a path that was never uploaded is silently ignored', async () => {
    const [p] = await uploadPhotos(1);
    const a = await (await chat(post({ message: 'photo', attachments: [{ path: p!.path }, { path: 'quotes/00000000-0000-4000-8000-000000000000.jpg' }] }, { accept: 'application/json' }))).json();
    const conv = (await repo().conversations.get(a.conversationId))!;
    expect((conv.state as { photos: unknown[] }).photos).toHaveLength(1);
  });
  it('limits how many new conversations one IP can open', async () => {
    let last = 200;
    for (let i = 0; i < 14; i++) last = (await chat(post({ message: 'hi' }, { accept: 'application/json', 'x-forwarded-for': '198.51.100.99' }))).status;
    expect(last).toBe(429);
  });
  it('GET returns static first-paint data without touching the model', async () => {
    const j = await (await chatGet()).json();
    expect(j.suggestions).toHaveLength(4);
    expect(await repo().conversations.list()).toHaveLength(0);
  });
});

describe('verify + history routes', () => {
  const vreq = (body: unknown) => new Request('http://localhost:3000/api/concierge/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  it('verify start/confirm round trip in demo mode, then history reflects it; wrong session is refused', async () => {
    const a = await (await chat(post({ message: 'hello' }, { accept: 'application/json' }))).json();
    const base = { conversationId: a.conversationId, sessionToken: a.sessionToken };
    expect((await verify(vreq({ action: 'start', phone: '(916) 555-0142', ...base, sessionToken: 'bad' }))).status).toBe(401);
    const s = await verify(vreq({ action: 'start', phone: '(916) 555-0142', ...base }));
    expect(await s.json()).toMatchObject({ sent: true, mock: true, mockCodeHint: '424242' });
    expect((await verify(vreq({ action: 'confirm', code: '111111', ...base }))).status).toBe(400);
    expect(await (await verify(vreq({ action: 'confirm', code: '424242', ...base }))).json()).toMatchObject({ verified: true, phoneLast4: '0142' });
    const h = await history(new Request(`http://localhost:3000/api/concierge/history?c=${a.conversationId}`, { headers: { 'x-concierge-session': a.sessionToken } }));
    const hj = await h.json();
    expect(hj).toMatchObject({ verified: true, paused: false });
    expect(hj.messages.map((m: { role: string }) => m.role)).toEqual(['user', 'assistant']);
    const bad = await history(new Request(`http://localhost:3000/api/concierge/history?c=${a.conversationId}`, { headers: { 'x-concierge-session': 'nope' } }));
    expect(bad.status).toBe(401);
  });
});

describe('GET /api/concierge/cron', () => {
  it('requires CRON_SECRET in production, accepts the bearer token', async () => {
    const env = process.env as Record<string, string | undefined>;
    const prev = env.NODE_ENV;
    env.NODE_ENV = 'production';
    try {
      expect((await cron(new Request('http://localhost/api/concierge/cron'))).status).toBe(503);
      env.CRON_SECRET = 's3cret';
      expect((await cron(new Request('http://localhost/api/concierge/cron'))).status).toBe(401);
      expect((await cron(new Request('http://localhost/api/concierge/cron', { headers: { authorization: 'Bearer s3cret' } }))).status).toBe(200);
    } finally { env.NODE_ENV = prev; delete env.CRON_SECRET; }
  });
});
