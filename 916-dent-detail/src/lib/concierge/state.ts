// Conversation persistence. All data goes through repo(): conversations (+ state jsonb), messages, leads.
// `ConvState` is the server-side truth about a chat: which slots were actually offered, which photos were attached,
// whether the phone is verified. The model can read a summary of it but can never write to it directly.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { deriveSource } from '@/lib/attribution';
import { repo, type Conversation, type Lead } from '@/lib/db';
import { hashKey } from './guardrails';
import type { Attribution, Channel, ChannelIdentity, EscalationReason } from './types';

export type OfferedSlot = {
  id: string; startsAt: string; endsAt: string; techId: string; label: string;
  services: string[]; addons: string[]; sizeClass: string; zip: string; panels?: number;
  offeredAt: number; /** set when offered for rescheduling an existing booking */ forBookingId?: string;
};
export type ConvPhoto = { id: string; path: string; at: number; caption?: string };
export type ConvQuote = { id: string | null; low: number; high: number; totalLow: number | null; totalHigh: number | null; travelFee: number; services: string[]; sizeClass: string; panels: number; at: number };

export type ConvState = {
  v: 1;
  turn: number;
  verifiedPhone?: string;
  verifiedAt?: number;
  verify?: { phone: string; codeHash: string; expiresAt: number; attempts: number; sentAt: number };
  photos: ConvPhoto[];
  offered: OfferedSlot[];
  quote?: ConvQuote;
  zip?: { zip: string; status: string; city?: string; fee: number | null; at: number };
  bookingIds: string[];
  pendingConfirm?: { action: 'cancel'; bookingId: string; turn: number };
  collected: { services?: string[]; sizeClass?: string; zip?: string; vehicle?: { year?: number; make?: string; model?: string }; name?: string; email?: string };
  strikes: number;
  lockedUntil?: number;
  paused?: boolean;
  ownerTextedAt?: number;
  attribution?: { first?: Attribution; last?: Attribution };
  /** Short facts for the model about what happened earlier (set by the agent, not by the customer). */
  injectionAttempts: number;
  /** gibberish / repeated-message counter for the spam lockout */
  spam: number;
  lastUserHash?: string;
  /** missed-call opener held for quiet hours; sent by /api/concierge/cron */
  pendingOpener?: { sendAfter: number };
  /** this conversation has been counted in the customer's memory row */
  memoryLinked?: boolean;
  /** SMS reminder consent step (src/lib/concierge/consent.ts): asked once, answered only by an explicit REMIND ME / NO THANKS */
  smsConsent?: { status: 'asked' | 'granted' | 'declined' | 'blocked'; askedAt: number; answeredAt?: number; wording: string };
};

export const emptyState = (): ConvState => ({ v: 1, turn: 0, photos: [], offered: [], bookingIds: [], collected: {}, strikes: 0, injectionAttempts: 0, spam: 0 });

export type ConvRecord = { conv: Conversation; state: ConvState };

const parseState = (raw: unknown): ConvState => {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  const s = structuredClone(raw) as Partial<ConvState>;
  return { ...base, ...s, photos: s.photos ?? [], offered: s.offered ?? [], bookingIds: s.bookingIds ?? [], collected: s.collected ?? {}, v: 1 };
};

// ---- per-conversation mutex (in-process; cross-instance races are documented in THREAT_MODEL.md)
const locks = new Map<string, Promise<unknown>>();
export async function withConversationLock<T>(id: string, fn: () => Promise<T>): Promise<T> {
  const prev = locks.get(id) ?? Promise.resolve();
  let release!: () => void;
  const next = new Promise<void>((r) => { release = r; });
  const chained = prev.then(() => next);
  locks.set(id, chained);
  try { await prev; return await fn(); }
  finally { release(); if (locks.get(id) === chained) locks.delete(id); }
}

// ---- session tokens (web): HMAC-signed conversation id so a guessed/leaked id alone grants nothing
const secret = () => {
  const s = process.env.BOOKING_TOKEN_SECRET;
  if (s) return s;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) throw new Error('BOOKING_TOKEN_SECRET must be set when Supabase is configured');
  return 'dev-only-booking-token-secret-change-me';
};
const sig = (p: string) => createHmac('sha256', secret()).update(`concierge-session:${p}`).digest('base64url');
export const signSession = (conversationId: string, now = Date.now(), ttlMs = 30 * 86_400_000): string => {
  const payload = Buffer.from(JSON.stringify({ c: conversationId, e: Math.floor((now + ttlMs) / 1000) })).toString('base64url');
  return `${payload}.${sig(payload)}`;
};
export function verifySession(token: string | null | undefined, now = Date.now()): string | null {
  const [payload, s, extra] = String(token ?? '').split('.');
  if (!payload || !s || extra !== undefined) return null;
  const a = Buffer.from(s); const b = Buffer.from(sig(payload));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const { c, e } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { c: string; e: number };
    return typeof c === 'string' && typeof e === 'number' && e * 1000 > now ? c : null;
  } catch { return null; }
}

// ---- load / create
export const smsExternalId = (phone: string) => hashKey(`sms:${phone}`);

export async function loadConversationById(id: string): Promise<ConvRecord | null> {
  const conv = await repo().conversations.get(id);
  return conv ? { conv, state: parseState(conv.state) } : null;
}

export async function findOrCreateConversation(identity: ChannelIdentity, existingId?: string): Promise<ConvRecord> {
  const db = repo();
  if (existingId) {
    const found = await loadConversationById(existingId);
    if (found && found.conv.channel === identity.channel) return found;
  }
  if (identity.channel !== 'web') {
    const conv = await db.conversations.first({ where: { channel: identity.channel, external_id: identity.externalId } });
    if (conv) return { conv, state: parseState(conv.state) };
  }
  try {
    const conv = await db.conversations.insert({ channel: identity.channel, external_id: identity.externalId, status: 'open', cost_usd: 0, state: emptyState() as unknown as Record<string, unknown>, needs_human: false, tokens_in: 0, tokens_out: 0 });
    return { conv, state: emptyState() };
  } catch (e) {
    // unique(channel, external_id) race: someone else created it first
    const conv = await db.conversations.first({ where: { channel: identity.channel, external_id: identity.externalId } });
    if (conv) return { conv, state: parseState(conv.state) };
    throw e;
  }
}

export async function saveState(rec: ConvRecord, patch: Partial<Conversation> = {}): Promise<void> {
  const next = await repo().conversations.update(rec.conv.id, { ...patch, state: rec.state as unknown as Record<string, unknown> });
  rec.conv = next;
}

// ---- messages
// created_at has millisecond resolution in the mock store, so two messages written in the same tick would tie;
// a process-wide monotonic sequence number breaks ties deterministically (created_at stays the primary order).
let seq = 0;
export async function recordMessage(conversationId: string, role: 'user' | 'assistant' | 'tool' | 'system', content: string, meta: Record<string, unknown> = {}): Promise<void> {
  await repo().messages.insert({ conversation_id: conversationId, role, content: content.slice(0, 4000), meta: { ...meta, seq: ++seq } });
}
const byTime = (a: { created_at: string; meta?: Record<string, unknown> }, b: { created_at: string; meta?: Record<string, unknown> }) =>
  Date.parse(a.created_at) - Date.parse(b.created_at) || Number(a.meta?.seq ?? 0) - Number(b.meta?.seq ?? 0);

export async function recentTurns(conversationId: string, limit: number): Promise<{ role: 'user' | 'assistant'; content: string; at: string }[]> {
  const rows = await repo().messages.list({ where: { conversation_id: conversationId }, orderBy: 'created_at', desc: true, limit: limit * 3 });
  return rows.filter((m) => m.role === 'user' || m.role === 'assistant').sort(byTime).slice(-limit).map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content, at: m.created_at }));
}
export async function countTurns(conversationId: string): Promise<number> {
  return (await repo().messages.list({ where: { conversation_id: conversationId } })).filter((m) => m.role === 'user' || m.role === 'assistant').length;
}

// ---- CRM lead: every conversation is a lead
export type LeadPatch = { name?: string | null; phone?: string | null; email?: string | null; zip?: string | null; notes?: string | null; area_status?: string | null; stage?: Lead['stage']; customer_id?: string | null };

export async function ensureLead(rec: ConvRecord, channel: Channel, patch: LeadPatch = {}): Promise<Lead> {
  const db = repo();
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined && v !== null && v !== '')) as LeadPatch;
  if (rec.conv.lead_id) {
    const existing = await db.leads.get(rec.conv.lead_id);
    if (existing) {
      const notes = clean.notes ? [existing.notes, clean.notes].filter(Boolean).join('\n').slice(-1500) : undefined;
      // a lead only moves forward in the funnel from here (booking/cancel flows own the later stages)
      const order = ['new', 'quoted', 'booked', 'in_progress', 'done', 'reviewed'];
      const { stage: wanted, ...rest } = clean;
      const stage = wanted && order.indexOf(wanted) > order.indexOf(existing.stage) ? wanted : undefined;
      if (!Object.keys(clean).length) return existing;
      const upd: Partial<Lead> = { ...rest, ...(notes ? { notes } : {}), ...(stage ? { stage } : {}) };
      if (!Object.keys(upd).length) return existing;
      return db.leads.update(existing.id, upd);
    }
  }
  const a = rec.state.attribution?.last ?? {};
  const first = rec.state.attribution?.first ?? a;
  const lead = await db.leads.insert({
    name: clean.name ?? null, phone: clean.phone ?? null, email: clean.email ?? null, zip: clean.zip ?? null,
    stage: clean.stage ?? 'new', source: channel === 'sms' ? 'sms' : 'chat',
    utm_source: a.utm_source ?? null, utm_medium: a.utm_medium ?? null, utm_campaign: a.utm_campaign ?? null, utm_term: a.utm_term ?? null, utm_content: a.utm_content ?? null,
    gclid: a.gclid ?? null, fbclid: a.fbclid ?? null, referrer: a.referrer ?? null, landing_page: a.landing_page ?? null,
    // first touch keeps what the visitor originally came from, even though `source` says chat/sms
    first_touch: { ...first, derived_source: deriveSource(first), channel } as unknown as Record<string, unknown>,
    notes: clean.notes ?? null, area_status: clean.area_status ?? null, customer_id: clean.customer_id ?? null,
  });
  rec.conv = await db.conversations.update(rec.conv.id, { lead_id: lead.id });
  return lead;
}

// ---- escalation inbox contract (Phase 3 reads these)
export type InboxItem = { conversationId: string; channel: Channel; reason: string | null; escalatedAt: string | null; leadId: string | null; customerId: string | null; summary: string | null; lastMessageAt: string | null; costUsd: number };

export async function listNeedsHuman(limit = 50): Promise<InboxItem[]> {
  const rows = await repo().conversations.list({ where: { needs_human: true }, orderBy: 'escalated_at', limit });
  return rows.map((c) => ({ conversationId: c.id, channel: c.channel, reason: c.escalation_reason ?? null, escalatedAt: c.escalated_at ?? null, leadId: c.lead_id ?? null, customerId: c.customer_id ?? null, summary: c.summary ?? null, lastMessageAt: c.last_message_at ?? null, costUsd: Number(c.cost_usd) }));
}

export async function conversationTranscript(conversationId: string, limit = 200) {
  const rows = await repo().messages.list({ where: { conversation_id: conversationId }, orderBy: 'created_at', limit });
  return rows.filter((m) => m.role === 'user' || m.role === 'assistant').sort(byTime).map((m) => ({ role: m.role, content: m.content, at: m.created_at }));
}

/** Staff action (Phase 3 inbox button): hand the chat back to the bot. */
export async function resumeConversation(conversationId: string): Promise<void> {
  const rec = await loadConversationById(conversationId);
  if (!rec) return;
  rec.state.paused = false;
  rec.state.strikes = 0;
  rec.state.lockedUntil = undefined;
  await saveState(rec, { status: 'open', needs_human: false, escalation_reason: null });
}

export const reasonLabel: Record<EscalationReason, string> = {
  complaint: 'complaint', insurance: 'insurance question', legal: 'legal threat', safety: 'safety issue', uncertainty: 'bot unsure',
  abuse: 'abusive customer', requested_human: 'asked for a person', cost_cap: 'chat cost cap reached', other: 'other',
};
