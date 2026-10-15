// Channel abstraction. The agent (agent.ts) knows nothing about Twilio, HTTP or Instagram: a channel adapter only
//   1. authenticates an inbound webhook,
//   2. turns it into InboundMessage objects with a CHANNEL-ESTABLISHED identity (never what the customer typed),
//   3. delivers the reply.
// To add Instagram / Facebook DMs: implement ChannelAdapter (see adapters/meta.ts for the contract), register it in
// ADAPTERS, add a route under src/app/api/<channel>/. Nothing in the agent, tools or guardrails changes.
import { log, maskPhone } from '@/lib/api/log';
import { isSmsLive, normalizePhone, sendSms, type SendResult } from '@/lib/sms';
import { handleMessage, type AgentOptions } from './agent';
import { conciergeConfig } from './config';
import { smsExternalId } from './state';
import { mediaToAttachments } from './twilio';
import type { Channel, ChannelIdentity, InboundMessage, TurnResult } from './types';

export type ChannelCapabilities = {
  /** Replies are clipped to this many characters. */
  maxChars: number;
  /** Customer can send images. */
  media: boolean;
  /** Can render cards/buttons (booking card, slot chips). SMS cannot: links go in the text. */
  richUi: boolean;
  /** Reply can be streamed progressively. */
  streaming: boolean;
  /** The channel itself proves who the customer is (SMS From number). Web needs the code step. */
  identityProvenByChannel: boolean;
};

export interface ChannelAdapter {
  readonly channel: Channel;
  readonly capabilities: ChannelCapabilities;
  /** Authenticate an inbound webhook/request. 'unconfigured' = refuse (503) instead of guessing. */
  authenticate(req: Request, rawParams?: Record<string, string>): 'ok' | 'bad_signature' | 'unconfigured';
  /** Deliver a reply the agent produced outside a request/response cycle (async channels). */
  deliver(to: string, text: string): Promise<SendResult>;
}

export const smsAdapter: ChannelAdapter = {
  channel: 'sms',
  capabilities: { maxChars: conciergeConfig.channelMaxChars.sms!, media: true, richUi: false, streaming: false, identityProvenByChannel: true },
  authenticate: () => 'ok', // real check lives in twilio.ts authenticateWebhook (needs the raw form params)
  deliver: (to, text) => sendSms(to, text),
};

export const webAdapter: ChannelAdapter = {
  channel: 'web',
  capabilities: { maxChars: conciergeConfig.channelMaxChars.web!, media: true, richUi: true, streaming: true, identityProvenByChannel: false },
  authenticate: () => 'ok', // session token is checked by the route
  deliver: async () => ({ ok: true, mock: true }), // replies travel on the HTTP response / SSE stream
};

export const ADAPTERS: Partial<Record<Channel, ChannelAdapter>> = { sms: smsAdapter, web: webAdapter };

// ------------------------------------------------------------------------------------------------ SMS

export type TwilioInbound = Record<string, string>;

/** Turn one signed Twilio inbound message into a turn, and deliver the reply through the sms lib. */
export async function processInboundSms(p: TwilioInbound, opts: AgentOptions & { deliver?: boolean } = {}): Promise<TurnResult | null> {
  const phone = normalizePhone(p.From);
  if (!phone) { log('warn', 'concierge.sms_bad_from'); return null; }
  const identity: ChannelIdentity = { channel: 'sms', externalId: smsExternalId(phone), phone, phoneVerified: true };
  const attachments = await mediaToAttachments(p);
  const msg: InboundMessage = { identity, text: p.Body ?? '', attachments, providerId: p.MessageSid || p.SmsMessageSid || undefined };
  const result = await handleMessage(msg, opts);
  const keywordReply = result.optedOut || result.optedIn || result.help;
  // When Twilio manages STOP/START/HELP (default on its numbers) it already answered; a second reply would be a duplicate
  // (and after STOP it would be blocked anyway). Our DB is updated either way. Flip CONCIERGE_SMS_KEYWORD_REPLIES=1 to reply ourselves.
  const skip = keywordReply && isSmsLive() && process.env.CONCIERGE_SMS_KEYWORD_REPLIES !== '1';
  if (result.reply && opts.deliver !== false && !skip) {
    const sent = await smsAdapter.deliver(phone, result.reply);
    if (!sent.ok) log('warn', 'concierge.sms_deliver_failed', { to: maskPhone(phone), error: sent.error });
  }
  return result;
}
