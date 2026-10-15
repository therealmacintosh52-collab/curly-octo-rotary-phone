// Guardrails for the 916 Concierge. Everything here is deterministic code that runs OUTSIDE the model:
//   inbound:  sanitize + fence customer text, length, gibberish, abuse, hard-risk triggers, rate limits, lockout
//   outbound: output filter (prices, PII, links, leaks, claims, AI-identity), SMS formatting
// The model is never the last line of defence. See THREAT_MODEL.md.
import { createHmac } from 'node:crypto';
import { addonPrices, depositAmount, ESTIMATE_LABEL, fixedPrices, travelFees, detailSpread } from '@/config/pricing';
import { site } from '@/config/site';
import { clientIp, rateLimit } from '@/lib/api/http';
import { conciergeConfig } from './config';
import type { Channel, EscalationReason } from './types';

// ------------------------------------------------------------------------------------------------ inbound hygiene

// zero-width, bidi overrides/isolates, BOM, soft hyphen, and C0/C1 controls except \n \t
const INVISIBLE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f­؜᠎​-‏‪-‮⁠-⁤⁦-⁩﻿￹-￻]/g;

/** Patterns that look like someone trying to speak as the system / developer / assistant or to change the rules. */
const ROLE_SPOOF_LINE = /^[ \t>*_#-]*(system|assistant|developer|tool|human|ai|admin|owner|operator|instruction[s]?)\s*(prompt|message|override)?\s*[:：>\]\)-]/gim;
const SPECIAL_TOKENS = /<\|[^|>]{0,40}\|>|\[\/?(INST|SYS|SYSTEM)\]|<<\/?SYS>>|###\s*(system|instruction|assistant)\b/gi;
const INJECTION_PHRASES = [
  /ignore\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier|preceding|your)\s+(instructions?|rules?|prompts?|messages?)/i,
  /disregard\s+(all\s+|any\s+|the\s+)?(previous|prior|above|your)\s+(instructions?|rules?)/i,
  /forget\s+(everything|all|your)\s+(you|instructions?|rules?)/i,
  /(reveal|show|print|repeat|output|display|leak|tell me)\s+(me\s+)?(your|the)\s+(system|hidden|initial|original|secret)\s*(prompt|instructions?|rules?|message)/i,
  /what\s+(is|are|were)\s+your\s+(system\s+)?(prompt|instructions)/i,
  /you\s+are\s+now\s+(in\s+)?(dan|developer|god|jailbreak|admin|unrestricted)/i,
  /(developer|debug|admin|maintenance)\s+mode/i,
  /act\s+as\s+(if\s+you\s+(are|were)\s+)?(the\s+)?(owner|admin|system|developer|manager)/i,
  /new\s+(instructions?|rules?)\s*:/i,
  /override\s+(the\s+)?(price|pricing|policy|rules?|limits?)/i,
  /(api[_ -]?key|service[_ -]?role|auth[_ -]?token|secret)/i,
];

export type Sanitized = { text: string; flagged: boolean; reasons: string[]; truncated: boolean };

/**
 * Make customer-supplied text safe to put inside a fenced block: strip invisible/control characters, normalise
 * look-alike characters, neutralise role-spoof lines and special tokens, and break any angle bracket so the text
 * cannot close our fence or open a fake tag. Meaning is preserved; the model still sees what the customer wrote.
 */
export function sanitizeUntrusted(input: string, maxChars = conciergeConfig.maxMessageChars): Sanitized {
  const reasons: string[] = [];
  let t = String(input ?? '');
  const truncated = t.length > maxChars;
  if (truncated) t = t.slice(0, maxChars);
  t = t.normalize('NFKC');
  if (INVISIBLE.test(t)) reasons.push('invisible_chars');
  t = t.replace(INVISIBLE, '');
  if (SPECIAL_TOKENS.test(t)) reasons.push('special_tokens');
  t = t.replace(SPECIAL_TOKENS, '[removed]');
  if (ROLE_SPOOF_LINE.test(t)) reasons.push('role_spoof');
  t = t.replace(ROLE_SPOOF_LINE, (_m, role: string) => `(customer wrote the word "${role.toLowerCase()}") `);
  if (/[<>]/.test(t)) reasons.push('angle_brackets');
  t = t.replace(/</g, '‹').replace(/>/g, '›');
  if (INJECTION_PHRASES.some((re) => re.test(t))) reasons.push('injection_phrase');
  t = t.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const flagged = reasons.some((r) => r === 'role_spoof' || r === 'special_tokens' || r === 'injection_phrase');
  return { text: t, flagged, reasons, truncated };
}

/** Tool results and stored memory are untrusted too: same neutralisation, applied to every string leaf. */
export function sanitizeDeep<T>(v: T, maxStr = 600): T {
  if (typeof v === 'string') return sanitizeUntrusted(v, maxStr).text as unknown as T;
  if (Array.isArray(v)) return v.slice(0, 40).map((x) => sanitizeDeep(x, maxStr)) as unknown as T;
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, sanitizeDeep(x, maxStr)])) as T;
  return v;
}

export const looksLikeInjection = (text: string): boolean => INJECTION_PHRASES.some((re) => re.test(text));

const KEYBOARD_ROWS = /(qwer|wert|erty|asdf|sdfg|dfgh|fghj|ghjk|hjkl|zxcv|xcvb|cvbn|vbnm|qaz|wsx|edc|rfv)/i;
/** A word that no language produces: almost no vowels, a long consonant run, or a keyboard-row mash. */
function weirdWord(w: string): boolean {
  if (w.length < 4) return false;
  if (KEYBOARD_ROWS.test(w) && !/^(sdf|qwer)$/.test(w) && w.length >= 4 && !/^(sweet|swerve|dwert)/.test(w)) return /(asdf|sdfg|dfgh|fghj|ghjk|hjkl|zxcv|xcvb|cvbn|vbnm|qwer|wert|erty)/i.test(w) || w.length >= 5;
  const vowels = (w.match(/[aeiouy]/g) ?? []).length;
  if (w.length >= 6 && vowels / w.length < 0.15) return true;
  if (/[^aeiouy\d\W]{6,}/.test(w)) return true;
  if (w.length >= 8 && vowels / w.length > 0.85) return true;
  return false;
}

export function looksLikeGibberish(raw: string): boolean {
  const t = raw.trim();
  if (t.length < 6) return false;
  if (/(.)\1{9,}/.test(t)) return true; // aaaaaaaaaa
  const letters = (t.match(/\p{L}/gu) ?? []).length;
  const digits = (t.match(/\d/g) ?? []).length;
  if (t.length >= 8 && (letters + digits) / t.length < 0.35) return true; // mostly symbols
  const words = t.toLowerCase().split(/[^\p{L}]+/u).filter((w) => w.length > 0);
  if (words.length === 0) return false;
  const weird = words.filter(weirdWord).length;
  if (weird >= 2 && weird / words.length >= 0.5 && t.length >= 8) return true;
  if (words.length === 1 && weird === 1 && t.length >= 10) return true;
  const uniq = new Set(t.toLowerCase().replace(/\s/g, '')).size;
  if (t.length >= 20 && uniq <= 4) return true;
  return false;
}

const PROFANITY = /\b(f+u+c+k+\w*|sh[i1]+t+\w*|b[i1]tch\w*|a+ss+h+o+l+e+s?|c+u+n+t+s?|bastard|dumb\s?ass|motherf\w+|piece of (shit|crap)|stupid (bot|robot)|useless (bot|piece)|idiots?|morons?|retard\w*)\b/i;
const THREATS = /\b(kill (you|him|her|them|your)|i('| wi)ll (find|hurt|burn|destroy|come after) (you|your)|burn (your|the) (shop|van|truck)|shoot|bomb)\b/i;

/** Abuse = profanity/threats aimed at the business or bot. A complaint with swearing still gets handed to a human. */
export function classifyAbuse(text: string): 'none' | 'abusive' | 'threat' {
  if (THREATS.test(text)) return 'threat';
  if (PROFANITY.test(text)) return 'abusive';
  return 'none';
}

// ---- deterministic hand-off triggers. The model is told to escalate these too; this is the backstop that does not
// depend on the model behaving.
const RISK: { reason: EscalationReason; re: RegExp }[] = [
  { reason: 'legal', re: /\b(lawyer|attorney|sue|suing|lawsuit|legal action|small claims|court|bbb|better business bureau|report you|attorney general|cslb|police)\b/i },
  { reason: 'safety', re: /\b(injur(ed|y)|hospital|ambulance|emergency|on fire|caught fire|(car|vehicle|truck|house|garage|engine) (is )?(on )?fire|fire department|gas leak|carbon monoxide|unsafe|brakes? (failed|gone)|someone (is )?hurt|accident (just|right) (now|happened))\b/i },
  { reason: 'insurance', re: /\b(insurance|insurer|adjuster|adjustor|deductible|claim number|claims? (process|adjuster|department)|file a claim|state farm|geico|progressive|allstate|farmers|usaa|liberty mutual|policy number|total loss)\b|\bclaim\b/i },
  { reason: 'complaint', re: /\b(complain(t|ing)?|unacceptable|ripped off|rip.?off|scam(med)?|damaged my|you (broke|damaged|scratched|ruined|dented)|ruined my|(your|the) (tech|technician|guys|crew|team|work) (damaged|scratched|ruined|broke|left)|scratched my|dented my|chargeback|want (my money back|a refund|a manager)|dispute (the|this|a) (charge|payment)|furious|angry|livid|never again|speak (to|with) (the |a )?(manager|owner|supervisor)|no.?show(ed)?|never (showed|came|arrived)|didn'?t show)\b/i },
  { reason: 'requested_human', re: /\b(talk|speak|chat|connect|transfer|put me|get me)\b[^.?!]{0,30}\b(human|real person|a person|someone real|agent|representative|owner|manager|somebody)\b|\b(human|real person|live agent|representative) (please|now)\b/i },
];

export function detectRisk(text: string): EscalationReason | null {
  const t = text.normalize('NFKC');
  for (const r of RISK) if (r.re.test(t)) return r.reason;
  return null;
}
/** Reasons the agent escalates without waiting for the model. Others are model-judgement with a backstop on `RISK`. */
export const HARD_ESCALATE: EscalationReason[] = ['legal', 'safety'];

/** Customer sincerely asking whether they are talking to a bot/AI. */
export const asksIfBot = (text: string): boolean =>
  /\b(are|r) (you|u) (a |an |really )?(bot|robot|ai|a\.i\.|human|real|person|machine|automated|chatgpt|gpt|claude|an? assistant|live)\b|\b(is this|am i (talking|speaking|chatting) (to|with)) (a |an )?(bot|robot|ai|human|real person|machine|automated)\b|\breal person\??$|\bis (this|that) (automated|ai|a bot)\b/i.test(text);

// ------------------------------------------------------------------------------------------------ rate limiting

const secret = () => process.env.BOOKING_TOKEN_SECRET || 'dev-only-booking-token-secret-change-me';
/** Keyed hash so phone numbers never appear in rate-limit stores, logs or external ids. */
export const hashKey = (v: string): string => createHmac('sha256', secret()).update(`concierge:${v}`).digest('hex').slice(0, 32);

export type LimitCheck = { ok: true } | { ok: false; scope: 'ip' | 'conversation' | 'phone'; retryAfter: number };

export async function checkInboundLimits(p: { ip?: string; conversationId: string; phone?: string | null; channel: Channel }): Promise<LimitCheck> {
  const L = conciergeConfig.limits;
  if (p.ip && p.ip !== 'unknown' && p.channel === 'web') {
    const r = await rateLimit(`cc:ip:${hashKey(p.ip)}`, L.ipPer10Min, 600);
    if (!r.ok) return { ok: false, scope: 'ip', retryAfter: r.retryAfter };
  }
  const c = await rateLimit(`cc:conv:${p.conversationId}`, L.conversationPerHour, 3600);
  if (!c.ok) return { ok: false, scope: 'conversation', retryAfter: c.retryAfter };
  if (p.phone) {
    const ph = await rateLimit(`cc:phone:${hashKey(p.phone)}`, L.phonePerHour, 3600);
    if (!ph.ok) return { ok: false, scope: 'phone', retryAfter: ph.retryAfter };
  }
  return { ok: true };
}

/**
 * IP-level abuse ledger so a locked-out visitor cannot just open a new chat. Per-instance memory (documented limitation in
 * THREAT_MODEL.md): enough to stop a casual repeat offender, not a distributed attacker (the rate limiter + Upstash covers volume).
 */
const ipAbuse = new Map<string, { n: number; reset: number }>();
export function noteIpAbuse(ip: string | undefined, now = Date.now()): void {
  if (!ip || ip === 'unknown') return;
  const k = hashKey(`abuse:${ip}`);
  const cur = ipAbuse.get(k);
  const row = cur && cur.reset > now ? cur : { n: 0, reset: now + 3_600_000 };
  row.n++;
  ipAbuse.set(k, row);
  if (ipAbuse.size > 2000) for (const [key, v] of ipAbuse) if (v.reset <= now) ipAbuse.delete(key);
}
export function ipIsBlocked(ip: string | undefined, now = Date.now()): boolean {
  if (!ip || ip === 'unknown') return false;
  const row = ipAbuse.get(hashKey(`abuse:${ip}`));
  return Boolean(row && row.reset > now && row.n >= conciergeConfig.limits.ipAbusePerHour);
}
export const resetIpAbuse = () => ipAbuse.clear();
export { clientIp };

// ------------------------------------------------------------------------------------------------ output filter

/** Every dollar amount the bot may say without a tool result: deposit, travel fees, add-ons, fixed detailing prices. */
export function configPriceAllowList(): Set<number> {
  const s = new Set<number>([depositAmount]);
  for (const t of travelFees.tiers) s.add(t.fee);
  for (const v of Object.values(addonPrices)) s.add(v);
  for (const bySize of Object.values(fixedPrices)) for (const p of Object.values(bySize ?? {})) { s.add(p); s.add(Math.round(p * (1 + detailSpread))); }
  return s;
}

export type FilterContext = {
  channel: Channel;
  /** Dollar amounts that appeared in tool results this conversation (quote ranges, totals). */
  toolAmounts: Set<number>;
  /** URLs returned by tools this turn (deposit links, manage links). */
  toolUrls: Set<string>;
  /** The customer's own contact data that may be echoed back. */
  ownPhone?: string | null;
  ownEmails?: string[];
  /** Successful state-changing tools this turn. */
  done: { create_booking?: 'pending_deposit' | 'confirmed' | boolean; reschedule_booking?: boolean; cancel_booking?: boolean; send_deposit_link?: boolean };
  /** True when the reply (or a tool result) includes a dent/quote range that must carry the estimate label. */
  quotedThisTurn?: boolean;
  systemPrompt: string;
  canary: string;
  /** Customer-facing wording present in the prompt (excluded from the leak check). */
  publicFacts?: string[];
  siteOrigin: string;
};

export type FilterResult = { text: string; reasons: string[]; replaced: boolean };

const AMOUNT = /\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?/g;
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const PHONE = /(?:\+?1[\s.-]?)?\(?\b[2-9]\d{2}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const URL_RE = /\bhttps?:\/\/[^\s)>\]]+|\bwww\.[^\s)>\]]+/gi;
const BARE_DOMAIN = /(?<![@\w.-])[a-z0-9][a-z0-9-]{1,40}\.(?:com|net|org|io|co|us|app|ly|me|xyz|info|biz|link|click|site|online|shop|top|cc|tk)\b(?:\/\S*)?/gi;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const TOOL_NAMES = /\b(get_services|check_service_area|get_quote_range|check_availability|create_booking|send_deposit_link|reschedule_booking|cancel_booking|lookup_booking|create_lead|escalate_to_human)\b/i;
const SECRET_PATTERNS = /(sk-ant-[A-Za-z0-9_-]{6,}|ANTHROPIC_API_KEY|TWILIO_AUTH_TOKEN|SUPABASE_SERVICE_ROLE|BOOKING_TOKEN_SECRET|STRIPE_SECRET|service_role|whsec_[A-Za-z0-9]+)/i;
const NEGATION = /\b(can'?t|cannot|can not|don'?t|do not|won'?t|will not|unable|not able|never|isn'?t|aren'?t)\b[^.!?]{0,40}$/i;
const CONDITIONAL_AFTER = /^\s*(once|after|when|as soon as|if|until|before)\b/i;

/** True when the claim appears and is not immediately conditional ("it's locked in once the deposit goes through"). */
function claimedUnconditionally(re: RegExp, text: string): boolean {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  let m: RegExpExecArray | null;
  while ((m = g.exec(text))) {
    if (!CONDITIONAL_AFTER.test(text.slice(m.index + m[0].length, m.index + m[0].length + 14))) return true;
  }
  return false;
}

const shingles = (s: string, n = 8) => {
  const w = s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const out = new Set<string>();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(' '));
  return out;
};
const promptShingleCache = new Map<string, Set<string>>();

export function leaksPrompt(reply: string, systemPrompt: string, canary: string, publicFacts: string[] = []): boolean {
  if (reply.includes(canary)) return true;
  const cacheKey = `${systemPrompt.length}:${publicFacts.length}:${systemPrompt.slice(0, 40)}`;
  let sh = promptShingleCache.get(cacheKey);
  if (!sh) {
    // wording that is meant to be said to customers (objection answers, policy lines) must not count as a "leak"
    let stripped = systemPrompt;
    for (const f of publicFacts) stripped = stripped.split(f).join(' ');
    sh = shingles(stripped); promptShingleCache.set(cacheKey, sh);
  }
  const mine = shingles(reply);
  let hits = 0;
  for (const g of mine) if (sh.has(g) && ++hits >= 5) return true;
  return false;
}

/** A claim is "negated" if a negation word sits shortly before it ("I can't offer discounts"). */
function claimed(re: RegExp, text: string): boolean {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  let m: RegExpExecArray | null;
  while ((m = g.exec(text))) {
    const before = text.slice(Math.max(0, m.index - 45), m.index);
    // reset at sentence boundary so "No problem. We offer a discount." is not negated
    const sentence = before.split(/[.!?]\s/).pop() ?? before;
    if (!NEGATION.test(sentence)) return true;
  }
  return false;
}

const OFF_BRAND: { reason: string; re: RegExp }[] = [
  { reason: 'discount_claim', re: /\b((give|offer|apply|knock|take|do|honou?r)\w*\s+(you\s+)?(a\s+|an\s+|the\s+|that\s+)?(\d+%\s+)?(discount|deal|coupon|promo\w*|special|price match)|price.?match|promo code|coupon code|(it'?s|that'?s|everything'?s?)\s+free\b|for free\b|free of charge|no charge|on the house|complimentary)/i },
  { reason: 'guarantee_claim', re: /\b(guarantee[sd]?|lifetime warranty|\d+[- ]?(year|yr|month)s? warranty|warrant(y|ies) (on|for|covers?)|money.?back)\b/i },
  { reason: 'superlative_claim', re: /\b(best (price|in|around|dent|detail)|cheapest|lowest price|#\s?1|number one|top.?rated|five.?star|5.?star|award.?winning|voted)\b/i },
  { reason: 'credential_claim', re: /\b(fully )?(licensed|insured|bonded|certified|accredited)\b/i },
  { reason: 'disparage_competitor', re: /\b(rip.?off artists?|crooks?|scammers?|(other|those) (shops?|detailers?|guys) (are|will) (rip|scam|lie|cheat))\b/i },
  { reason: 'fixed_dent_promise', re: /\b(flat|fixed|set|guaranteed) (rate|price|fee) (for|of|on) (any|all|every) dent/i },
];

/** Numeric discounts are blocked even when phrased negatively: there is no legitimate reason to say them. */
const NUMERIC_DISCOUNT = /(\b\d{1,2}\s?% off\b|\$\s?\d+\s+off\b|\b\d{1,2}\s?percent off\b)/i;
const BOOKING_DONE_CLAIM = /\b(you(?:'re| are)\s+(?:all\s+)?(?:booked|set|confirmed|locked in|on the schedule|scheduled)|(?:your\s+)?(?:booking|appointment)\s+(?:is|has been)\s+(?:confirmed|booked|scheduled|set)|(?:i|we)(?:'ve| have)\s+(?:booked|scheduled|confirmed)\b|(?:it'?s|that'?s)\s+(?:booked|confirmed|locked in))/i;
const CANCEL_DONE_CLAIM = /\b((?:i|we)(?:'ve| have)\s+(?:cancell?ed)|(?:your\s+)?(?:booking|appointment)\s+(?:is|has been)\s+cancell?ed)/i;
const RESCHEDULE_DONE_CLAIM = /\b((?:i|we)(?:'ve| have)\s+(?:rescheduled|moved)|(?:your\s+)?(?:booking|appointment)\s+(?:is|has been)\s+(?:rescheduled|moved))/i;
const PAID_CLAIM = /\b(deposit\s+(?:is|was|has been)\s+(?:paid|received|processed|confirmed)|(?:i|we)(?:'ve| have)\s+(?:received|charged|processed)\s+(?:your\s+)?(?:deposit|payment)|payment\s+(?:went through|received|confirmed))/i;
const HUMAN_CLAIM = /\b(i(?:'m| am)\s+(?:a\s+)?(?:real\s+)?(?:human|person|live agent|actual person)|(?:this is|you(?:'re| are) (?:talking|speaking|chatting) (?:to|with))\s+(?:a\s+)?(?:real\s+)?(?:human|person)|i(?:'m| am) not (?:a|an) (?:bot|ai|robot|assistant))\b/i;

export const FILTER_FALLBACK: Record<string, string> = {
  leak: 'I can help with prices, scheduling and questions about our services. What does your car need?',
  secret: 'I can help with prices, scheduling and questions about our services. What does your car need?',
  tool_leak: 'I can help with prices, scheduling and questions about our services. What does your car need?',
  price: "I can only quote prices from our price list or from photos, so let me have the owners confirm that. What's the best way to reach you?",
  discount_claim: "I can't change prices or offer discounts, but I can get you a range from photos and find a time that works.",
  guarantee_claim: "I can't promise that, but I can have the owners confirm the details with you.",
  superlative_claim: 'I can tell you how we work and what it costs. What does your car need?',
  credential_claim: "I'd rather the owners confirm that directly. Want me to pass your question along?",
  disparage_competitor: 'I can only speak for how we work: no paint, no repaint, and we come to you. Want a price range from a photo?',
  fixed_dent_promise: "Dent prices come from photos, so I can't promise a flat rate. Send a couple of photos and I'll give you a range.",
  booking_claim: "I haven't confirmed a booking yet. I can hold a time for you once I have your details.",
  cancel_claim: "I haven't cancelled anything yet. Tell me which booking and I'll check the details with you.",
  reschedule_claim: "I haven't changed your booking yet. Tell me which time you'd like and I'll check what's open.",
  paid_claim: "I can't see a payment yet. Your time is only locked in once the deposit goes through.",
  human_claim: "I'm the 916 Concierge, an AI assistant for 916 Dent & Detail. I can bring in the owners any time.",
  empty: 'Could you tell me a bit more about what your car needs?',
};

function stripMarkdown(t: string): string {
  return t
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1').replace(/(^|\s)\*([^*\n]+)\*(?=\s|$)/g, '$1$2')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/<\/?[a-z][^>]*>/gi, ' ')
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '$1 $2')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function clipSentence(t: string, max: number): string {
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('? '), cut.lastIndexOf('! '));
  return (end > max * 0.5 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '') + '…').trim();
}

const digitsOnly = (s: string) => s.replace(/\D/g, '');

/**
 * Run every outbound rule. Rules that cannot be repaired replace the whole reply with a safe fallback; repairable ones
 * (stray link, stray contact detail, missing estimate label, formatting) are fixed in place. `reasons` is for
 * monitoring: no message content is ever put in it.
 */
export function filterReply(raw: string, ctx: FilterContext): FilterResult {
  const reasons: string[] = [];
  let t = String(raw ?? '');

  // 1. secrets / system prompt / tool-name leaks: replace everything
  if (SECRET_PATTERNS.test(t)) return { text: FILTER_FALLBACK.secret!, reasons: ['secret'], replaced: true };
  if (leaksPrompt(t, ctx.systemPrompt, ctx.canary, ctx.publicFacts)) return { text: FILTER_FALLBACK.leak!, reasons: ['leak'], replaced: true };
  if (TOOL_NAMES.test(t)) return { text: FILTER_FALLBACK.tool_leak!, reasons: ['tool_leak'], replaced: true };

  // 2. claims the model has no standing to make
  if (HUMAN_CLAIM.test(t)) return { text: FILTER_FALLBACK.human_claim!, reasons: ['human_claim'], replaced: true };
  if (NUMERIC_DISCOUNT.test(t)) return { text: FILTER_FALLBACK.discount_claim!, reasons: ['discount_claim'], replaced: true };
  for (const r of OFF_BRAND) if (claimed(r.re, t)) return { text: FILTER_FALLBACK[r.reason] ?? FILTER_FALLBACK.leak!, reasons: [r.reason], replaced: true };
  if (PAID_CLAIM.test(t)) return { text: FILTER_FALLBACK.paid_claim!, reasons: ['paid_claim'], replaced: true };
  // "you're booked" is only true when a booking is confirmed (deposit paid). A fresh create_booking is only a HOLD.
  if (claimedUnconditionally(BOOKING_DONE_CLAIM, t) && !ctx.done.reschedule_booking && ctx.done.create_booking !== 'confirmed') {
    return { text: ctx.done.create_booking ? holdWording(ctx) : FILTER_FALLBACK.booking_claim!, reasons: ['booking_claim'], replaced: true };
  }
  if (CANCEL_DONE_CLAIM.test(t) && !ctx.done.cancel_booking) return { text: FILTER_FALLBACK.cancel_claim!, reasons: ['cancel_claim'], replaced: true };
  if (RESCHEDULE_DONE_CLAIM.test(t) && !ctx.done.reschedule_booking) return { text: FILTER_FALLBACK.reschedule_claim!, reasons: ['reschedule_claim'], replaced: true };

  // 3. prices: every $ amount must come from config or a tool result
  const allowed = configPriceAllowList();
  const amounts = [...t.matchAll(AMOUNT)].map((m) => Number(m[1]!.replace(/,/g, '')));
  if (amounts.some((a) => !allowed.has(a) && !ctx.toolAmounts.has(a))) return { text: FILTER_FALLBACK.price!, reasons: ['price'], replaced: true };

  // 4. links: only ones a tool produced this turn, or plain paths on our own site
  t = t.replace(URL_RE, (u) => {
    const clean = u.replace(/[.,;:!?]+$/, '');
    if (ctx.toolUrls.has(clean)) return u;
    try {
      const url = new URL(clean.startsWith('http') ? clean : `https://${clean}`);
      const own = new URL(ctx.siteOrigin);
      if (url.host === own.host && /^\/(book|pricing|services|areas|dealers|reviews)\/?$/.test(url.pathname)) return u;
    } catch { /* fall through */ }
    reasons.push('link');
    return '';
  });
  t = t.replace(BARE_DOMAIN, (d) => {
    try { if (new URL(ctx.siteOrigin).host.replace(/^www\./, '') === d.toLowerCase().replace(/^www\./, '').split('/')[0]) return d; } catch { /* ignore */ }
    reasons.push('link');
    return '';
  });
  t = t.replace(UUID, () => { reasons.push('uuid'); return ''; });

  // 5. PII echo: only the customer's own phone/email and the business phone may appear
  const okPhones = new Set<string>([digitsOnly(site.phone.e164).slice(-10)]);
  if (ctx.ownPhone) okPhones.add(digitsOnly(ctx.ownPhone).slice(-10));
  t = t.replace(PHONE, (p) => { if (okPhones.has(digitsOnly(p).slice(-10))) return p; reasons.push('phone_echo'); return ''; });
  const okEmails = new Set((ctx.ownEmails ?? []).map((e) => e.toLowerCase()));
  t = t.replace(EMAIL, (e) => { if (okEmails.has(e.toLowerCase()) || e.toLowerCase() === site.email.address.toLowerCase()) return e; reasons.push('email_echo'); return ''; });

  // 6. format for the channel
  t = stripMarkdown(t).replace(/\s+([,.!?])/g, '$1').replace(/ {2,}/g, ' ').trim();

  // 7. estimate label travels with any price range that came from a quote
  const hasQuoteAmount = [...t.matchAll(AMOUNT)].some((m) => ctx.toolAmounts.has(Number(m[1]!.replace(/,/g, ''))) && !allowed.has(Number(m[1]!.replace(/,/g, ''))));
  const hasAnyQuote = ctx.quotedThisTurn || hasQuoteAmount;
  if (hasAnyQuote && /\$\s?\d/.test(t) && !t.includes(ESTIMATE_LABEL)) t = `${t} ${ESTIMATE_LABEL}`;

  t = clipSentence(t, conciergeConfig.channelMaxChars[ctx.channel] ?? 600);
  if (t.length < 2) return { text: FILTER_FALLBACK.empty!, reasons: [...reasons, 'empty'], replaced: true };
  return { text: t, reasons, replaced: false };
}

function holdWording(ctx: FilterContext): string {
  const link = [...ctx.toolUrls][0];
  return `I've held that time for you. It's locked in once the $${depositAmount} deposit goes through${link ? `: ${link}` : '.'}`;
}

/** Dollar amounts mentioned anywhere in a JSON-able value (used to build `toolAmounts`). */
export function amountsIn(v: unknown, out = new Set<number>()): Set<number> {
  if (typeof v === 'number' && Number.isFinite(v)) { out.add(v); return out; }
  if (Array.isArray(v)) { for (const x of v) amountsIn(x, out); return out; }
  if (v && typeof v === 'object') { for (const [k, x] of Object.entries(v as Record<string, unknown>)) { if (/(low|high|total|fee|price|deposit|amount)/i.test(k)) amountsIn(x, out); else if (x && typeof x === 'object') amountsIn(x, out); } }
  return out;
}

/** PII-minimised description of a tool call for logs and the messages table. */
export const PII_FIELDS = /^(name|email|phone|address_line|notes|manage_token|summary|caption|make|model)$/i;
export function redactArgs(v: unknown, depth = 0): unknown {
  if (depth > 3) return '[deep]';
  if (Array.isArray(v)) return v.slice(0, 8).map((x) => redactArgs(x, depth + 1));
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, PII_FIELDS.test(k) ? '[redacted]' : redactArgs(x, depth + 1)]));
  if (typeof v === 'string') return v.length > 40 ? `${v.slice(0, 12)}…[${v.length}]` : v;
  return v;
}
