// Photo quote. Live: Anthropic vision with structured JSON output. Mock: deterministic, no network.
// Output is always clamped to config bounds and always carries the estimate label. Dents REQUIRE photos.
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { bookingConfig, isDentService, type SizeClass } from '@/config/booking';
import { ESTIMATE_LABEL, dentPricing } from '@/config/pricing';
import { anthropic } from '@/lib/ai/client';
import { dentPerPanel, hasDent, roundTo } from '@/lib/pricing';
import { QUOTE_SCHEMA, QUOTE_SYSTEM_PROMPT, vehicleLine } from './prompt';

export type QuotePhoto = { mediaType: 'image/jpeg' | 'image/png' | 'image/webp'; base64: string };
export type QuoteRequest = {
  services: string[];
  sizeClass: SizeClass;
  vehicle?: { year?: number; make?: string; model?: string };
  photos: QuotePhoto[];
};
export type Panel = { name: string; dents: number; severity: 'minor' | 'moderate' | 'major' };
export type QuoteOk = {
  status: 'ok';
  low: number; high: number; confidence: number; confidenceLabel: 'low' | 'medium' | 'high';
  panels: Panel[]; panelCount: number; notes: string; label: typeof ESTIMATE_LABEL; mock: boolean;
};
export type QuoteNone = { status: 'needs_photos' | 'needs_review'; label: typeof ESTIMATE_LABEL; message: string; mock: boolean };
export type QuoteResult = QuoteOk | QuoteNone;

const modelOut = z.object({
  panels: z.array(z.object({ name: z.string(), dents: z.number(), severity: z.enum(['minor', 'moderate', 'major']) })).max(40),
  low: z.number(), high: z.number(), confidence: z.number(), notes: z.string(),
});

export const confidenceLabel = (c: number): 'low' | 'medium' | 'high' => (c >= 0.75 ? 'high' : c >= 0.5 ? 'medium' : 'low');

/** Plain text only, no links/emails/phones, bounded. Model output is untrusted. */
export function sanitizeNotes(s: string): string {
  return s
    .replace(/[\u0000-\u001f\u007f<>]/g, ' ')
    .replace(/https?:\/\/\S+|www\.\S+|\S+@\S+\.\S+/gi, '')
    .replace(/\+?\d[\d\s().-]{8,}\d/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}
const sanitizeName = (s: string) => s.replace(/[^A-Za-z0-9 \-/]/g, '').trim().slice(0, 40) || 'panel';

export function isImageBytes(buf: Buffer): QuotePhoto['mediaType'] | null {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}

/**
 * Clamp whatever a model (or mock) says to the owner's configured bounds. Exported for tests.
 * Bounds: never below the configured minimum, never above maximum, and never above what the panel count could
 * plausibly cost at the top per-panel rate, so an injected "$1" or "$99,999" cannot get through.
 */
export function clampRange(raw: { low: number; high: number; confidence: number; panels: Panel[] }, sizeClass: SizeClass, hail: boolean):
  { low: number; high: number; confidence: number; panels: Panel[]; panelCount: number } {
  const panels = raw.panels
    .map((p) => ({ name: sanitizeName(p.name), dents: Math.max(1, Math.min(30, Math.round(p.dents) || 1)), severity: p.severity }))
    .slice(0, dentPricing.maxPanels);
  const confidence = Number.isFinite(raw.confidence) ? Math.min(1, Math.max(0, raw.confidence)) : 0;
  const panelCount = Math.max(1, panels.length);
  const per = dentPerPanel(sizeClass, hail);
  const ceiling = Math.min(dentPricing.maximum, Math.max(dentPricing.minimum * 2, Math.round(panelCount * per.high * 1.25)));
  const floor = Math.max(dentPricing.minimum, Math.round(panelCount * per.low * 0.5));
  let low = Number.isFinite(raw.low) ? raw.low : floor;
  let high = Number.isFinite(raw.high) ? raw.high : ceiling;
  if (low > high) [low, high] = [high, low];
  low = Math.min(Math.max(low, floor), ceiling);
  high = Math.min(Math.max(high, low), ceiling);
  if (confidence < dentPricing.lowConfidenceBelow) {
    low = Math.max(floor, Math.round(low * (1 - dentPricing.widenFactor)));
    high = Math.min(ceiling, Math.round(high * (1 + dentPricing.widenFactor)));
  }
  low = Math.max(dentPricing.minimum, roundTo(low, dentPricing.roundTo));
  high = Math.max(low, Math.min(dentPricing.maximum, roundTo(high, dentPricing.roundTo)));
  return { low, high, confidence, panels, panelCount };
}

const MOCK_PANELS = ['hood', 'roof', 'left front door', 'right front door', 'left rear quarter panel', 'trunk lid', 'right rear door'];

function mockQuote(req: QuoteRequest, hail: boolean): QuoteOk {
  const h = createHash('sha256');
  for (const p of req.photos) h.update(p.base64.slice(0, 4096));
  h.update(req.sizeClass);
  const d = h.digest();
  const n = 1 + (d[0]! % 3);
  const per = dentPerPanel(req.sizeClass, hail);
  const panels: Panel[] = Array.from({ length: n }, (_, i) => ({
    name: MOCK_PANELS[(d[1]! + i) % MOCK_PANELS.length]!, dents: 1 + (d[2 + i]! % 3), severity: (['minor', 'moderate', 'major'] as const)[d[5 + i]! % 3]!,
  }));
  const c = clampRange({ low: per.low * n, high: per.high * n, confidence: 0.6, panels }, req.sizeClass, hail);
  return {
    status: 'ok', ...c, confidenceLabel: confidenceLabel(c.confidence), label: ESTIMATE_LABEL, mock: true,
    notes: 'Demo estimate: no AI key is configured, so this range comes from fixed rules, not from your photos.',
  };
}

export async function getQuote(req: QuoteRequest): Promise<QuoteResult> {
  if (!hasDent(req.services)) throw new Error('getQuote is for dent services only');
  const hail = req.services.some((s) => s === 'hail') && req.services.every((s) => !isDentService(s) || s === 'hail');
  if (req.photos.length < bookingConfig.photos.minForDents) {
    return { status: 'needs_photos', label: ESTIMATE_LABEL, mock: false, message: `Dent work needs photos before we can give a price. Add at least ${bookingConfig.photos.minForDents}: one wide shot of the panel and one close-up of each dent.` };
  }
  const client = anthropic();
  if (!client) return mockQuote(req, hail);

  try {
    const res = await client.messages.create({
      model: bookingConfig.quote.model,
      max_tokens: bookingConfig.quote.maxTokens,
      system: QUOTE_SYSTEM_PROMPT,
      output_config: { effort: 'low', format: { type: 'json_schema', schema: QUOTE_SCHEMA as unknown as Record<string, unknown> } },
      messages: [{
        role: 'user',
        content: [
          ...req.photos.slice(0, bookingConfig.photos.max).map((p) => ({ type: 'image' as const, source: { type: 'base64' as const, media_type: p.mediaType, data: p.base64 } })),
          { type: 'text' as const, text: vehicleLine(req.vehicle, req.sizeClass, hail) },
        ],
      }],
    });
    if (res.stop_reason === 'refusal' || res.stop_reason === 'max_tokens') return needsReview();
    const text = res.content.filter((b) => b.type === 'text').map((b) => (b as { text: string }).text).join('');
    const parsed = modelOut.safeParse(JSON.parse(text));
    if (!parsed.success) return needsReview();
    const m = parsed.data;
    if (m.panels.length === 0 || m.confidence <= 0) return needsReview();
    const c = clampRange(m, req.sizeClass, hail);
    return { status: 'ok', ...c, confidenceLabel: confidenceLabel(c.confidence), notes: sanitizeNotes(m.notes), label: ESTIMATE_LABEL, mock: false };
  } catch {
    // No error detail is logged: request bodies contain customer photos.
    return needsReview();
  }
}

function needsReview(): QuoteNone {
  return { status: 'needs_review', label: ESTIMATE_LABEL, mock: false, message: "We couldn't read a damage estimate from these photos. A technician will review them and confirm a price. You can still book an inspection slot." };
}
