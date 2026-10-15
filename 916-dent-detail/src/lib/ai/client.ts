// Anthropic client factory. Returns null when no key is configured (callers then use their mock path).
import Anthropic from '@anthropic-ai/sdk';

const G = globalThis as unknown as { __anthropic?: Anthropic };

export const isAnthropicLive = (): boolean => Boolean(process.env.ANTHROPIC_API_KEY);

export function anthropic(): Anthropic | null {
  if (!isAnthropicLive()) return null;
  return (G.__anthropic ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 60_000 }));
}
