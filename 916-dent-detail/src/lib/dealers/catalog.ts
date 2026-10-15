// Dealer service catalog + wholesale rate resolution. Rates ONLY come from src/config/pricing.ts (dealerWholesale) or an
// owner-set per-dealer override in dealers.wholesale_pricing. Nothing here contains a price.
import { dealerServiceIds, dealerWholesale, type DealerServiceId, type Money } from '@/config/pricing';

export type { DealerServiceId };

export type DealerServiceDef = {
  id: DealerServiceId;
  /** Customer-facing name (plain-language rule). */
  plain: string;
  /** Real trade term (shown small, used in schema/FAQ). */
  term: string;
  unit: 'panel' | 'vehicle';
  /** Words accepted in a CSV "services" cell. */
  aliases: string[];
};

export const dealerServices: readonly DealerServiceDef[] = [
  { id: 'pdr_panel', plain: 'Dent Removal (no paint, no body shop)', term: 'Paintless dent repair', unit: 'panel', aliases: ['pdr', 'dent', 'dents', 'ding', 'dings', 'dent removal', 'paintless dent repair'] },
  { id: 'hail_panel', plain: 'Hail Fix', term: 'Hail damage repair', unit: 'panel', aliases: ['hail', 'hail fix', 'hail damage'] },
  { id: 'interior_reset', plain: 'Interior Reset', term: 'Interior detail', unit: 'vehicle', aliases: ['interior', 'interior detail', 'interior reset'] },
  { id: 'paint_deep_clean', plain: 'Paint Deep-Clean', term: 'Clay bar and decontamination', unit: 'vehicle', aliases: ['deep clean', 'deep-clean', 'clay', 'decon', 'paint deep-clean'] },
  { id: 'swirl_erase', plain: 'Swirl & Scratch Erase', term: 'Paint correction', unit: 'vehicle', aliases: ['swirl', 'swirls', 'polish', 'paint correction', 'swirl erase'] },
  { id: 'gloss_shield', plain: 'Gloss Shield', term: 'Ceramic coating', unit: 'vehicle', aliases: ['gloss', 'gloss shield', 'ceramic', 'coating'] },
  { id: 'headlights', plain: 'Headlight Restoration', term: 'Headlight restoration', unit: 'vehicle', aliases: ['headlight', 'headlights', 'headlight restoration'] },
];

if (dealerServices.length !== dealerServiceIds.length) throw new Error('dealerServices must cover every dealerServiceIds entry');

export const getDealerService = (id: string) => dealerServices.find((s) => s.id === id);
export const isDealerServiceId = (id: string): id is DealerServiceId => dealerServiceIds.includes(id as DealerServiceId);

export type ServiceRequest = { id: DealerServiceId; panels?: number | null };

/** Map free text ("dent; interior", "pdr|hail") to service ids. Unknown words are returned so the row can report them. */
export function parseServiceList(cell: string): { ids: DealerServiceId[]; unknown: string[] } {
  const ids: DealerServiceId[] = [];
  const unknown: string[] = [];
  for (const raw of String(cell ?? '').split(/[;|,/]+|\s+\+\s+|\s+and\s+/i)) {
    const w = raw.trim().toLowerCase();
    if (!w) continue;
    const hit = dealerServices.find((s) => s.id === w || s.aliases.includes(w));
    if (hit) { if (!ids.includes(hit.id)) ids.push(hit.id); } else unknown.push(raw.trim());
  }
  return { ids, unknown };
}

export type RateSheet = Partial<Record<string, unknown>>;

/** Owner per-dealer override first, then config; null = not set (UI: "Request wholesale sheet"). */
export function resolveRate(id: DealerServiceId, override?: RateSheet | null, base: Record<DealerServiceId, Money> = dealerWholesale): Money {
  const o = override?.[id];
  if (typeof o === 'number' && Number.isFinite(o) && o >= 0) return o;
  return base[id] ?? null;
}

/** Sum of rates for the requested services. null if any rate is unknown or a per-panel service has no panel count. */
export function suggestPrice(services: ServiceRequest[], override?: RateSheet | null, base?: Record<DealerServiceId, Money>): number | null {
  if (!services.length) return null;
  let cents = 0;
  for (const s of services) {
    const def = getDealerService(s.id);
    const rate = resolveRate(s.id, override, base);
    if (!def || rate === null) return null;
    const qty = def.unit === 'panel' ? s.panels ?? 0 : 1;
    if (qty <= 0) return null;
    cents += Math.round(rate * 100) * qty;
  }
  return cents / 100;
}
