// Model selection and cost accounting. Live Anthropic when ANTHROPIC_API_KEY exists, else the scripted mock policy.
import { isAnthropicLive } from '@/lib/ai/client';
import { AnthropicModel } from './anthropic-model';
import { rateFor } from './config';
import { MockPolicyModel } from './mock-model';
import type { ModelClient, ModelUsage } from './types';

export const defaultModel = (): ModelClient => (isAnthropicLive() ? new AnthropicModel() : new MockPolicyModel());
export const isLiveModel = (): boolean => isAnthropicLive();

/** USD for one response. input is the UNCACHED input; cache reads/writes are billed at their own rates. */
export function usageCostUsd(model: string, u: ModelUsage): number {
  const r = rateFor(model);
  return (u.input * r.input + u.output * r.output + u.cacheRead * r.cacheRead + u.cacheWrite * r.cacheWrite) / 1_000_000;
}
export const addUsage = (a: ModelUsage, b: ModelUsage): ModelUsage => ({ input: a.input + b.input, output: a.output + b.output, cacheRead: a.cacheRead + b.cacheRead, cacheWrite: a.cacheWrite + b.cacheWrite });
export const zeroUsage = (): ModelUsage => ({ input: 0, output: 0, cacheRead: 0, cacheWrite: 0 });
