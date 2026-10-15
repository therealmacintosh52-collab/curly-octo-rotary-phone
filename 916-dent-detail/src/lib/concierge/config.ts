// Concierge tunables. Money rates and caps live here (and env), never inline in logic. Business facts that customers
// hear (prices, policies, hours) come from src/config/*, not from here.
import { normalizePhone } from '@/lib/sms';

const num = (v: string | undefined, d: number) => { const n = Number(v); return v && Number.isFinite(n) && n > 0 ? n : d; };

export const MODEL_ID = () => process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';

/** USD per million tokens. cacheRead = 0.1x input, cacheWrite (5 min) = 1.25x input. Update when the model changes. */
export const RATES: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  'claude-haiku-5-5': { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.4, cacheWrite: 5 },
};
export const rateFor = (model: string) => RATES[model] ?? RATES['claude-sonnet-5-5']!;

export const conciergeConfig = {
  /** Hard cap on model spend per conversation (USD). Env CONCIERGE_MAX_COST_USD overrides. */
  maxCostUsd: () => num(process.env.CONCIERGE_MAX_COST_USD, 0.5),
  /** Hard cap on total tokens (in+out, cache included) per conversation. */
  maxTotalTokens: 120_000,
  maxToolIterations: 8,
  /** Wall-clock budget for one customer message, model calls included. */
  turnTimeoutMs: 40_000,
  modelMaxTokens: 700,
  /** Messages replayed to the model (older ones are folded into the memory summary). */
  historyWindow: 14,
  maxMessageChars: 1000,
  /** Offered slots stay bookable this long (ms). */
  slotTtlMs: 2 * 3_600_000,
  maxOfferedSlots: 6,
  maxPhotos: 8,
  limits: {
    ipPer10Min: 30,
    conversationPerHour: 80,
    phonePerHour: 40,
    verifySendsPerPhonePerHour: 3,
    verifyAttempts: 5,
    abuseStrikesToLock: 3,
    lockMinutes: 30,
    ipAbusePerHour: 6,
  },
  /** Missed-call text-back */
  missedCall: { dedupeHours: 6, maxDelaySec: 60 },
  verifyCodeTtlMs: 10 * 60_000,
  /** Mock mode only: any phone can be "verified" with this code. NEVER honoured when Supabase is live. */
  mockVerifyCode: '424242',
  channelMaxChars: { web: 700, sms: 480, instagram: 900, facebook: 900, voice: 300 } as Record<string, number>,
};

export const ownerAlertPhones = (): string[] =>
  (process.env.OWNER_ALERT_PHONES ?? '').split(',').map((p) => normalizePhone(p.trim())).filter((p): p is string => Boolean(p));
