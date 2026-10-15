// Display helpers for admin screens (pure). Money is whole dollars with cents only when present.
import { TIMEZONE } from '@/config/booking';
import { formatLocal, localToUtc } from '@/lib/availability/tz';

export const money = (n: number | null | undefined): string => {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const neg = n < 0;
  const abs = Math.abs(n);
  const s = abs.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(abs) ? 0 : 2, maximumFractionDigits: 2 });
  return `${neg ? '-' : ''}$${s}`;
};
export const moneyRange = (lo: number | null | undefined, hi: number | null | undefined): string =>
  lo == null || hi == null ? 'Needs photos' : lo === hi ? money(lo) : `${money(lo)} – ${money(hi)}`;

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export const fmtDate = (iso: string | number | null | undefined): string => (iso ? formatLocal(typeof iso === 'number' ? iso : Date.parse(iso), { weekday: 'short', month: 'short', day: 'numeric' }) : '—');
export const fmtTime = (iso: string | number | null | undefined): string => (iso ? formatLocal(typeof iso === 'number' ? iso : Date.parse(iso), { hour: 'numeric', minute: '2-digit' }) : '—');
export const fmtDateTime = (iso: string | number | null | undefined): string => (iso ? `${fmtDate(iso)}, ${fmtTime(iso)}` : '—');
export const fmtDateLong = (iso: string | number): string => formatLocal(typeof iso === 'number' ? iso : Date.parse(iso), { weekday: 'long', month: 'long', day: 'numeric' });

/** Relative "5m ago" / "2d ago" for activity lists. */
export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 14) return `${Math.floor(s / 86400)}d ago`;
  return fmtDate(iso);
}

export function fmtPhone(p: string | null | undefined): string {
  if (!p) return '';
  const d = p.replace(/\D/g, '');
  const t = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  return t.length === 10 ? `(${t.slice(0, 3)}) ${t.slice(3, 6)}-${t.slice(6)}` : p;
}

export const vehicleLabel = (v: { year?: number | null; make?: string | null; model?: string | null; color?: string | null } | null | undefined): string =>
  v ? [v.year, v.color, v.make, v.model].filter(Boolean).join(' ') || 'Vehicle' : '';

/** Local YYYY-MM-DD for "today". */
export const localToday = (now = Date.now()): string => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  return parts;
};

export const SOURCE_LABELS: Record<string, string> = {
  google: 'Google', gbp: 'Google Business', meta_ads: 'Meta ads', instagram: 'Instagram', tiktok: 'TikTok', door_knock: 'Door-knock',
  referral: 'Referral', dealer: 'Dealer', organic: 'Organic', direct: 'Direct', other: 'Other', chat: 'Website chat', sms: 'Text message',
};
export const sourceLabel = (s: string | null | undefined): string => SOURCE_LABELS[s ?? ''] ?? (s || 'Unknown');

/** <input type="datetime-local"> value ("2026-10-20T09:30", Pacific wall time) -> ISO instant, or null when invalid / nonexistent. */
export function localInputToIso(v: string): string | null {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(v);
  if (!m) return null;
  const ms = localToUtc(m[1]!, Number(m[2]) * 60 + Number(m[3]), TIMEZONE);
  return ms === null ? null : new Date(ms).toISOString();
}
