// Shared helpers for the concierge tests: fixed clock, fresh mock database, fake photos, seeded bookings, and a Chat
// wrapper that records every tool call and every reply. Mock mode only; no network, no keys.
import { localToUtc } from '@/lib/availability/tz';
import { savePhoto } from '@/lib/booking/photos';
import { confirmDeposit, createBooking } from '@/lib/booking/service';
import { repo } from '@/lib/db';
import { mockRepo } from '@/lib/db/mock';
import { smsOutbox } from '@/lib/sms';
import { resetIpAbuse } from '@/lib/concierge/guardrails';
import { handleMessage, type AgentOptions } from '@/lib/concierge/agent';
import { smsExternalId } from '@/lib/concierge/state';
import { AnthropicModel } from '@/lib/concierge/anthropic-model';
import { MockPolicyModel, type MockOptions } from '@/lib/concierge/mock-model';
import type { Attachment, ChannelIdentity, InboundMessage, ModelClient, ModelRequest, ModelResponse, TurnResult } from '@/lib/concierge/types';
import { resetRateLimits } from '@/lib/security/rate-limit';

/** Mon 2026-10-19 10:00 America/Los_Angeles. Slots exist from the following day on (12 h lead time). */
export const NOW = localToUtc('2026-10-19', 10 * 60)!;
export const HOUR = 3_600_000;
export const PHONE = '+19165550142';
export const OTHER_PHONE = '+19165550177';

/** BOT_LIVE=1 + a key runs the scenarios against the real model (tolerant assertions only). Default: offline mock. */
export const LIVE = process.env.BOT_LIVE === '1' && Boolean(process.env.ANTHROPIC_API_KEY);
const LIVE_KEY = process.env.ANTHROPIC_API_KEY;

export function clearEnv() {
  for (const k of ['ANTHROPIC_API_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER', 'TWILIO_MESSAGING_SERVICE_SID', 'OWNER_ALERT_PHONES', 'CONCIERGE_MAX_COST_USD', 'BOOKING_TOKEN_SECRET']) delete process.env[k];
  if (LIVE) process.env.ANTHROPIC_API_KEY = LIVE_KEY;
}

export async function freshDb() {
  clearEnv();
  await mockRepo().reset?.();
  smsOutbox().length = 0;
  resetRateLimits();
  resetIpAbuse();
}

/** Smallest bytes that pass the magic-number check. Mock quotes never decode the image. */
export const FAKE_JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64, 7)]);
export async function uploadPhotos(n: number, caption?: string): Promise<Attachment[]> {
  const out: Attachment[] = [];
  for (let i = 0; i < n; i++) {
    const buf = Buffer.concat([FAKE_JPEG, Buffer.from([i])]);
    const r = await savePhoto(buf);
    if ('error' in r) throw new Error(r.error);
    out.push({ path: r.path, caption: i === 0 ? caption : undefined });
  }
  return out;
}

export const smsId = (phone = PHONE): ChannelIdentity => ({ channel: 'sms', externalId: smsExternalId(phone), phone, phoneVerified: true });
export const webId = (over: Partial<ChannelIdentity> = {}): ChannelIdentity => ({ channel: 'web', externalId: 'web-session', phone: null, phoneVerified: false, ip: '203.0.113.9', ...over });

/** Wraps any model: counts calls and keeps every request, so tests can assert what the model was (not) asked. */
export class SpyModel implements ModelClient {
  requests: ModelRequest[] = [];
  responses: ModelResponse[] = [];
  constructor(public inner: ModelClient) {}
  async complete(req: ModelRequest): Promise<ModelResponse> { this.requests.push(req); const r = await this.inner.complete(req); this.responses.push(r); return r; }
  get calls() { return this.requests.length; }
  /** Everything the model saw in customer-controlled positions (all message text). */
  seen(): string { return JSON.stringify(this.requests.map((r) => r.messages)); }
}

/** The model under test: live Anthropic in BOT_LIVE mode, else the scripted mock policy. */
export const modelUnderTest = (mock: MockOptions = {}): ModelClient => (LIVE ? new AnthropicModel() : new MockPolicyModel(mock));

export class Chat {
  conversationId: string | undefined;
  calls: { name: string; ok: boolean; blocked?: string }[] = [];
  replies: string[] = [];
  last!: TurnResult;
  constructor(public identity: ChannelIdentity, public opts: AgentOptions = {}) {}
  static withMock(identity: ChannelIdentity, mock: MockOptions = {}, opts: AgentOptions = {}) { return new Chat(identity, { now: NOW, model: new MockPolicyModel(mock), ...opts }); }
  async say(text: string, attachments?: Attachment[], extra: Partial<InboundMessage> = {}): Promise<TurnResult> {
    const r = await handleMessage({ identity: this.identity, text, attachments, conversationId: this.conversationId, ...extra }, { now: NOW, ...this.opts });
    this.conversationId = r.conversationId;
    this.calls.push(...r.toolCalls);
    if (r.reply) this.replies.push(r.reply);
    this.last = r;
    return r;
  }
  called(name: string) { return this.calls.filter((c) => c.name === name); }
  /** Conversation record + state, straight from the repo. */
  async rec() { return repo().conversations.get(this.conversationId!); }
  async state() { return (await this.rec())!.state as Record<string, unknown> & { photos: unknown[]; offered: { id: string }[]; verifiedPhone?: string; strikes: number; paused?: boolean; collected: Record<string, unknown> }; }
}

export async function verifyWebChat(chat: Chat, phone = PHONE) {
  const { startVerification, confirmVerification } = await import('@/lib/concierge/verify');
  const s = await startVerification({ conversationId: chat.conversationId!, phone, ip: chat.identity.ip, now: NOW });
  if (!s.ok) throw new Error(`verify start failed: ${s.error}`);
  const c = await confirmVerification({ conversationId: chat.conversationId!, code: '424242', now: NOW });
  if (!c.ok) throw new Error(`verify confirm failed: ${c.error}`);
}

/** A confirmed booking for `phone` starting `inHours` after NOW (deposit paid), made through the real booking service. */
export async function seedBooking(opts: { phone?: string; inHours: number; services?: string[]; name?: string; zip?: string }) {
  const startsAt = new Date(NOW + opts.inHours * HOUR);
  // availability would refuse a start inside the lead time, so seed via the repo for those and via the service otherwise
  const db = repo();
  const customer = (await db.customers.first({ where: { phone: opts.phone ?? PHONE } })) ?? (await db.customers.insert({ name: opts.name ?? 'Sam Rivera', phone: opts.phone ?? PHONE, email: 'sam@example.com', sms_opt_in: false }));
  const tech = (await db.techs.list({ where: { active: true } }))[0]!;
  const booking = await db.bookings.insert({
    customer_id: customer.id, tech_id: tech.id, status: 'confirmed', services: opts.services ?? ['interior'], addons: [], size_class: 'sedan',
    starts_at: startsAt.toISOString(), ends_at: new Date(startsAt.getTime() + 2 * HOUR).toISOString(), duration_min: 120, zip: opts.zip ?? '95624', city: 'Elk Grove',
    travel_fee: 0, price_low: 200, price_high: 230, needs_review: false, deposit_amount: 50, deposit_status: 'paid', reschedule_count: 0, area_status: 'in_area',
  });
  return { booking, customer };
}

export { confirmDeposit, createBooking };
export type { ModelClient };

// ---- direct tool-executor tests (no model): build a ToolContext for a fresh conversation
import { findOrCreateConversation } from '@/lib/concierge/state';
import type { ToolContext } from '@/lib/concierge/tools';
export async function toolCtx(identity: ChannelIdentity = smsId(), over: { turn?: number; now?: number } = {}): Promise<ToolContext> {
  const rec = await findOrCreateConversation(identity);
  return { rec, identity, now: over.now ?? NOW, turn: over.turn ?? 1, turnLog: { urls: new Set(), done: {}, quoted: false } };
}
