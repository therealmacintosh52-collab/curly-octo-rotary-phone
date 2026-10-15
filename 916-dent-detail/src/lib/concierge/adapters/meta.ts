// STUB: Instagram / Facebook Messenger DMs (Meta Graph API). Not implemented, not wired to any route.
// This file documents the contract so the channel can be added later without touching the agent.
//
// Inbound   : POST /api/meta (to be created) receives Meta webhook events. Verify `X-Hub-Signature-256` (HMAC-SHA256 of the
//             raw body with the app secret) and answer the GET hub.challenge handshake with META_VERIFY_TOKEN.
// Identity  : the page-scoped sender id (PSID / IGSID) is the externalId. It proves the DM account, NOT a phone number, so
//             `phoneVerified` is false: lookup/cancel/reschedule use the same web flow (verify a phone by SMS code first, or
//             a signed manage-link token). Never trust a phone number typed into a DM.
//             externalId = smsExternalId-style keyed hash of `${channel}:${senderId}`, channel = 'instagram' | 'facebook'
//             (both already allowed by conversations.channel in 0001_init.sql).
// Messages  : map each `messaging[].message` to handleMessage({ identity, text, attachments, providerId: mid }). Images:
//             download the attachment URL server-side (Meta CDN hosts only), pass it through savePhoto() (magic bytes + size),
//             then attach the returned path. Same rules as MMS in twilio.ts.
// Reply     : POST https://graph.facebook.com/<ver>/me/messages with the page token. 24h standard-messaging window applies:
//             if the window is closed, do not send; escalate_to_human instead.
// Limits    : Instagram DM text limit is 1000 chars (conciergeConfig.channelMaxChars). No UI cards: put links in text.
// Compliance: opt-out = "stop" works the same (set state.paused, no more automated messages), TCPA does not apply but Meta's
//             policies do. Keep the AI disclosure in the first reply.
import type { ChannelAdapter } from '../channels';

export const metaDmAdapterStub: Pick<ChannelAdapter, 'channel'> & { implemented: false } = { channel: 'instagram', implemented: false };
export class NotImplementedError extends Error { constructor() { super('Meta DM channel is a documented stub (see adapters/meta.ts).'); this.name = 'NotImplementedError'; } }
export const handleMetaWebhook = (): never => { throw new NotImplementedError(); };
