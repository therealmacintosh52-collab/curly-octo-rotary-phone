import { bookingConfig } from '@/config/booking';
import { fail, guard, limited, ok, parseJson } from '@/lib/api/http';
import { loadPhoto } from '@/lib/booking/photos';
import { quoteRequestSchema } from '@/lib/booking/schema';
import { repo } from '@/lib/db';
import { assessZip } from '@/lib/geo';
import { computePrice, hasDent, validateSelection } from '@/lib/pricing';
import { getQuote, type QuotePhoto } from '@/lib/quote';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: Request) {
  return guard('quote', async () => {
    const rl = await limited(req, 'quote', 12, 3600);
    if (rl) return rl;
    const p = await parseJson(req, quoteRequestSchema);
    if (!p.ok) return p.res;
    const q = p.data;
    const sel = validateSelection(q.services, q.sizeClass, q.addons);
    if (!sel.ok) return fail(400, 'invalid_selection', sel.error);
    const travelFee = q.zip ? (assessZip(q.zip).travelFee ?? 0) : 0;

    // Detailing-only: priced from config, no AI involved.
    if (!hasDent(sel.services)) {
      const price = computePrice({ services: sel.services, sizeClass: sel.sizeClass, addons: sel.addons, travelFee });
      return ok({ kind: 'config', quote: null, quoteId: null, price });
    }

    const photos: QuotePhoto[] = [];
    for (const path of q.photoPaths.slice(0, bookingConfig.photos.max)) { const ph = await loadPhoto(path); if (ph) photos.push(ph); }
    const quote = await getQuote({ services: sel.services, sizeClass: sel.sizeClass, vehicle: q.vehicle, photos });
    if (quote.status !== 'ok') {
      const price = computePrice({ services: sel.services, sizeClass: sel.sizeClass, addons: sel.addons, travelFee });
      return ok({ kind: 'ai', quote, quoteId: null, price });
    }
    const row = await repo().quotes.insert({
      services: sel.services, size_class: sel.sizeClass, low: quote.low, high: quote.high, confidence: quote.confidence, panels: quote.panels,
      notes: quote.notes, photo_paths: q.photoPaths, model: quote.mock ? 'mock' : bookingConfig.quote.model, mock: quote.mock, label: quote.label,
    });
    const price = computePrice({ services: sel.services, sizeClass: sel.sizeClass, addons: sel.addons, dentQuote: { low: quote.low, high: quote.high }, travelFee });
    return ok({ kind: 'ai', quote, quoteId: row.id, price });
  });
}
