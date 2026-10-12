/**
 * Business-hours maths, shared by the open/closed pill, the booking calendar
 * and the assistant. All times are the shop's local time (site.tz); the
 * visitor's clock is converted with Intl so a customer in another zone still
 * sees "open now" when the shop is actually open.
 */
import data from '../data/site.json';

const S = data.site;
export const TZ: string = S.tz;
/** [open, close] in 24h hours per weekday, Sunday first; null = closed. */
export const HOURS: (readonly [number, number] | null)[] = (S.hours_open as ([number, number] | null)[]);
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export interface ShopNow { day: number; minutes: number; y: number; m: number; d: number }

/** The shop's current weekday and minutes-since-midnight for any instant. */
export function shopNow(at: Date = new Date()): ShopNow {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false,
    year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const hour = Number(get('hour')) % 24;
  return { day, minutes: hour * 60 + Number(get('minute')), y: Number(get('year')), m: Number(get('month')), d: Number(get('day')) };
}

export function fmtHour(h: number): string {
  const whole = Math.floor(h), mins = Math.round((h - whole) * 60);
  const ampm = whole >= 12 ? 'PM' : 'AM';
  const h12 = whole % 12 === 0 ? 12 : whole % 12;
  return `${h12}:${String(mins).padStart(2, '0')} ${ampm}`;
}

export interface OpenState {
  open: boolean;
  /** "Open until 6:00 PM" or "Closed · opens Monday 10:00 AM" */
  label: string;
  short: string;
  closesAt?: string;
  opensAt?: string;
}

export function openState(at: Date = new Date()): OpenState {
  const now = shopNow(at);
  const today = HOURS[now.day];
  if (today && now.minutes >= today[0] * 60 && now.minutes < today[1] * 60) {
    const closesAt = fmtHour(today[1]);
    const soon = today[1] * 60 - now.minutes <= 45;
    return { open: true, closesAt, label: soon ? `Open · closes at ${closesAt}` : `Open until ${closesAt}`, short: 'Open now' };
  }
  // Find the next opening.
  for (let i = 0; i < 8; i++) {
    const d = (now.day + i) % 7;
    const h = HOURS[d];
    if (!h) continue;
    if (i === 0 && now.minutes >= h[1] * 60) continue;     // already closed today
    if (i === 0) {                                          // before opening today
      return { open: false, opensAt: fmtHour(h[0]), label: `Closed · opens today at ${fmtHour(h[0])}`, short: 'Opens today' };
    }
    const when = i === 1 ? 'tomorrow' : DAYS[d];
    return { open: false, opensAt: fmtHour(h[0]), label: `Closed · opens ${when} at ${fmtHour(h[0])}`, short: 'Closed now' };
  }
  return { open: false, label: 'Closed', short: 'Closed' };
}

export { DAYS };
