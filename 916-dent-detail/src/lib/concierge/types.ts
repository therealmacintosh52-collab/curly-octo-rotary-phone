// Shared types for the 916 Concierge. Channel-agnostic: nothing here knows about Twilio, Next or the browser.
import type { Conversation } from '@/lib/db/types';

export type Channel = Conversation['channel'];

/** Who is on the other end, as established by the CHANNEL (never by what the customer types). */
export type ChannelIdentity = {
  channel: Channel;
  /** Stable id inside the channel: hashed phone for SMS, session id for web, page-scoped id for IG/FB. */
  externalId: string;
  /** E.164. Trusted only when `phoneVerified`. SMS: the Twilio `From` (signature-checked). Web: set after the code step. */
  phone: string | null;
  phoneVerified: boolean;
  ip?: string;
};

export type Attachment = { path: string; caption?: string };
export type Attribution = {
  utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_term?: string; utm_content?: string;
  gclid?: string; fbclid?: string; ref?: string; referrer?: string; landing_page?: string;
};

export type InboundMessage = {
  identity: ChannelIdentity;
  text: string;
  attachments?: Attachment[];
  /** Existing conversation id (web only; must be proven with a session token by the route). */
  conversationId?: string;
  attribution?: { first?: Attribution; last?: Attribution };
  /** Provider message id, for idempotency (Twilio MessageSid). */
  providerId?: string;
};

// ---- UI blocks: produced by the SERVER from tool results, never by the model, so they cannot be forged by injection.
export type UiBlock =
  | { type: 'slots'; slots: { id: string; label: string }[]; durationMin?: number }
  | { type: 'quote'; low: number; high: number; label: string; services: string[]; travelFee: number; deposit: number }
  | { type: 'booking_hold'; bookingId: string; when: string; services: string[]; holdMinutes: number; deposit: number; depositUrl: string; priceLow: number | null; priceHigh: number | null; estimateLabel: string }
  | { type: 'booking_list'; bookings: { id: string; when: string; services: string[]; status: string }[] }
  | { type: 'verify_phone'; mockCodeHint?: string }
  | { type: 'handoff'; reason: string };

export type ToolOutcome = { ok: boolean; data: Record<string, unknown>; ui?: UiBlock[]; /** server refused: policy/authorization, not a bug */ blocked?: string };

// ---- Model abstraction (live Anthropic or the scripted mock policy)
export type TextBlock = { type: 'text'; text: string };
export type ToolUseBlock = { type: 'tool_use'; id: string; name: string; input: unknown };
export type ToolResultBlock = { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean };
export type ModelMessage =
  | { role: 'user'; content: string | (TextBlock | ToolResultBlock)[] }
  | { role: 'assistant'; content: string | unknown[] };
export type ToolDef = { name: string; description: string; input_schema: Record<string, unknown> };
export type ModelUsage = { input: number; output: number; cacheRead: number; cacheWrite: number };
export type ModelRequest = { system: string; tools: ToolDef[]; messages: ModelMessage[]; maxTokens: number; signal?: AbortSignal };
export type ModelResponse = {
  /** Assistant content exactly as returned (replayed unchanged inside one turn's tool loop). */
  raw: unknown[];
  text: string;
  toolUses: ToolUseBlock[];
  stopReason: 'end_turn' | 'tool_use' | 'max_tokens' | 'refusal' | 'other';
  usage: ModelUsage;
  model: string;
  mock: boolean;
};
export interface ModelClient { complete(req: ModelRequest): Promise<ModelResponse> }

export type EscalationReason = 'complaint' | 'insurance' | 'legal' | 'safety' | 'uncertainty' | 'abuse' | 'requested_human' | 'cost_cap' | 'other';

export type TurnResult = {
  conversationId: string;
  /** Web only: signed session token the widget must send back. */
  sessionToken?: string;
  /** null = say nothing (opted out, duplicate, locked) */
  reply: string | null;
  ui: UiBlock[];
  suggestions: string[];
  toolCalls: { name: string; ok: boolean; blocked?: string }[];
  /** Output-filter / pre-filter reasons that fired this turn (empty = reply went out as the model wrote it). */
  filtered: string[];
  escalated: boolean;
  optedOut?: boolean;
  optedIn?: boolean;
  help?: boolean;
  status: 'ok' | 'rate_limited' | 'locked' | 'too_long' | 'gibberish' | 'abuse' | 'paused' | 'cost_cap' | 'timeout' | 'error' | 'opted_out' | 'duplicate' | 'refused';
  usage: ModelUsage;
  costUsd: number;
  mock: boolean;
};
