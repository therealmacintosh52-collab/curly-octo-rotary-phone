// Booking flow state: shape, reducer, validity per step, draft persistence. Client only.
import { SIZE_CLASS_IDS, bookingConfig } from '@/config/booking';
import { computePrice, hasDent, requiresPhotos, validateSelection, type PriceResult } from '@/lib/pricing';
import type { AreaResult } from '@/lib/geo';

export const STEPS = [
  { id: 1, key: 'service', title: 'Services', heading: 'What do you need done?' },
  { id: 2, key: 'vehicle', title: 'Vehicle', heading: 'Tell us about your vehicle' },
  { id: 3, key: 'photos', title: 'Photos', heading: 'Add photos' },
  { id: 4, key: 'area', title: 'Location', heading: 'Where will the car be?' },
  { id: 5, key: 'time', title: 'Time', heading: 'Pick a time' },
  { id: 6, key: 'contact', title: 'Contact', heading: 'How do we reach you?' },
  { id: 7, key: 'deposit', title: 'Deposit', heading: 'Reserve your time' },
  { id: 8, key: 'done', title: 'Done', heading: "You're booked" },
] as const;

export type Photo = { path: string; name: string; thumb?: string };
export type QuoteOk = {
  status: 'ok'; low: number; high: number; confidence: number; confidenceLabel: 'low' | 'medium' | 'high';
  panels: { name: string; dents: number; severity: string }[]; panelCount: number; notes: string; label: string; mock: boolean;
};
export type QuoteNone = { status: 'needs_photos' | 'needs_review'; message: string; label: string };
export type QuoteState = { quoteId: string | null; result: QuoteOk | QuoteNone; fingerprint: string } | null;
export type Slot = { startsAt: string; endsAt: string; date: string; isoDate: string; label: string; techId: string };
export type BookingRef = {
  id: string; token: string; intentId: string; mode: 'mock' | 'live'; clientSecret: string; publishableKey?: string;
  amount: number; holdExpiresAt: string | null; fingerprint: string;
};
export type Contact = { name: string; phone: string; email: string; addressLine: string; notes: string; smsConsent: boolean; website: string; /** optional referral code the customer typed (checked via /api/referral/validate) */ referralCode?: string };

export type Flow = {
  step: number;
  services: string[]; addons: string[];
  year: string; make: string; model: string; sizeClass: string;
  photos: Photo[]; quote: QuoteState;
  zip: string; area: AreaResult | null;
  slot: Slot | null;
  contact: Contact;
  booking: BookingRef | null;
  idemKey: string;
  confirmed: boolean;
};

export const newKey = () => (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `k${Date.now()}${Math.random().toString(36).slice(2)}`);

export const initialFlow = (): Flow => ({
  step: 1, services: [], addons: [], year: '', make: '', model: '', sizeClass: '', photos: [], quote: null, zip: '', area: null, slot: null,
  contact: { name: '', phone: '', email: '', addressLine: '', notes: '', smsConsent: false, website: '' }, booking: null, idemKey: '', confirmed: false,
});

export type Action =
  | { type: 'patch'; patch: Partial<Flow> }
  | { type: 'contact'; patch: Partial<Contact> }
  | { type: 'toggleService'; id: string }
  | { type: 'toggleAddon'; id: string }
  | { type: 'reset' }
  | { type: 'hydrate'; flow: Flow };

export function reducer(s: Flow, a: Action): Flow {
  switch (a.type) {
    case 'patch': return { ...s, ...a.patch };
    case 'contact': return { ...s, contact: { ...s.contact, ...a.patch } };
    case 'toggleService': {
      const services = s.services.includes(a.id) ? s.services.filter((x) => x !== a.id) : [...s.services, a.id];
      return { ...s, services, slot: null, quote: null };
    }
    case 'toggleAddon': return { ...s, addons: s.addons.includes(a.id) ? s.addons.filter((x) => x !== a.id) : [...s.addons, a.id], slot: null };
    case 'reset': return initialFlow();
    case 'hydrate': return a.flow;
  }
}

// ---------------------------------------------------------------- validity
export const yearOk = (y: string) => /^\d{4}$/.test(y) && Number(y) >= 1950 && Number(y) <= new Date().getFullYear() + 1;
export const phoneDigits = (p: string) => p.replace(/\D/g, '').replace(/^1(?=\d{10}$)/, '');
export const phoneOk = (p: string) => /^[2-9]\d{2}[2-9]\d{6}$/.test(phoneDigits(p));
export const emailOk = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e.trim());

export function validSelection(s: Flow): boolean {
  const v = validateSelection(s.services, s.sizeClass || 'sedan', s.addons);
  return v.ok;
}
export const needsPhotos = (s: Flow) => requiresPhotos(s.services);
export const photosOk = (s: Flow) => !needsPhotos(s) || s.photos.length >= bookingConfig.photos.minForDents;

export function stepValid(s: Flow, n: number): boolean {
  switch (n) {
    case 1: return s.services.length > 0 && validSelection(s);
    case 2: return yearOk(s.year) && s.make.trim().length > 0 && s.model.trim().length > 0 && (SIZE_CLASS_IDS as readonly string[]).includes(s.sizeClass);
    case 3: return photosOk(s);
    case 4: return s.area?.status === 'in_area' && s.area.zip === s.zip;
    case 5: return s.slot !== null;
    case 6: return s.contact.name.trim().length >= 2 && phoneOk(s.contact.phone) && emailOk(s.contact.email) && s.contact.addressLine.trim().length >= 4;
    case 7: return s.booking !== null;
    default: return false;
  }
}
/** Furthest step the user may jump to: every earlier step must be valid. */
export function maxReachable(s: Flow): number {
  if (s.confirmed) return 8;
  let n = 1;
  while (n < 7 && stepValid(s, n)) n++;
  return Math.min(n, 7);
}

export const photoFingerprint = (s: Flow) => [s.services.join(','), s.addons.join(','), s.sizeClass, s.year, s.make, s.model, s.photos.map((p) => p.path).join(',')].join('|');
/** Anything that would change what the server holds: if it changes after reserving, the hold is released and re-made. */
export const bookingFingerprint = (s: Flow) =>
  [photoFingerprint(s), s.zip, s.slot?.startsAt, s.contact.name, s.contact.phone, s.contact.email, s.contact.addressLine, s.contact.notes, s.contact.smsConsent, normalizeReferralInput(s.contact.referralCode)].join('|');

/** Same normalisation the server uses (src/lib/referrals normalizeCode): uppercase, no spaces or dashes. Empty string = no code. */
export const normalizeReferralInput = (raw: string | null | undefined): string => (raw ?? '').toUpperCase().replace(/[\s-]/g, '').slice(0, 20);

export function priceFor(s: Flow): PriceResult | null {
  if (!s.services.length || !s.sizeClass) return null;
  const dentQuote = s.quote && s.quote.result.status === 'ok' ? { low: s.quote.result.low, high: s.quote.result.high } : null;
  const area = s.area?.status === 'in_area' ? s.area : null;
  return computePrice({ services: s.services, sizeClass: s.sizeClass, addons: s.addons, dentQuote: hasDent(s.services) ? dentQuote : null, travelFee: area?.travelFee ?? 0 });
}

// ---------------------------------------------------------------- persistence
const LS = 'd916_booking_draft_v1';
const SS = 'd916_booking_hold_v1';
export function saveDraft(s: Flow): void {
  try {
    if (s.confirmed) { localStorage.removeItem(LS); sessionStorage.removeItem(SS); return; }
    const { booking, contact, ...rest } = s;
    localStorage.setItem(LS, JSON.stringify({ ...rest, contact: { ...contact, smsConsent: false } })); // consent must be given fresh each time
    if (booking) sessionStorage.setItem(SS, JSON.stringify(booking)); else sessionStorage.removeItem(SS);
  } catch { /* storage blocked: the flow still works, it just is not persisted */ }
}
export function loadDraft(): Flow | null {
  try {
    const raw = localStorage.getItem(LS);
    if (!raw) return null;
    const d = JSON.parse(raw) as Partial<Flow>;
    const base = initialFlow();
    let booking: BookingRef | null = null;
    try { booking = JSON.parse(sessionStorage.getItem(SS) ?? 'null'); } catch { /* ignore */ }
    if (booking?.holdExpiresAt && Date.parse(booking.holdExpiresAt) < Date.now()) booking = null;
    return { ...base, ...d, contact: { ...base.contact, ...(d.contact ?? {}) }, booking, confirmed: false };
  } catch { return null; }
}
export function clearDraft(): void {
  try { localStorage.removeItem(LS); sessionStorage.removeItem(SS); } catch { /* ignore */ }
}
