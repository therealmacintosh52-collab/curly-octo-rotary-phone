// Booking state machine. Pure. Every status change goes through `transition`.
export const BOOKING_STATUSES = ['pending_deposit', 'confirmed', 'on_the_way', 'in_progress', 'completed', 'cancelled', 'no_show', 'expired'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];
export type BookingEvent = 'deposit_paid' | 'hold_expired' | 'cancel' | 'tech_en_route' | 'start' | 'finish' | 'no_show';

const TABLE: Record<BookingStatus, Partial<Record<BookingEvent, BookingStatus>>> = {
  pending_deposit: { deposit_paid: 'confirmed', hold_expired: 'expired', cancel: 'cancelled' },
  confirmed: { cancel: 'cancelled', tech_en_route: 'on_the_way', start: 'in_progress', no_show: 'no_show' },
  on_the_way: { start: 'in_progress', cancel: 'cancelled', no_show: 'no_show' },
  in_progress: { finish: 'completed' },
  completed: {},
  cancelled: {},
  no_show: {},
  expired: {},
};

export class InvalidTransitionError extends Error {
  constructor(public from: BookingStatus, public event: BookingEvent) {
    super(`Cannot apply "${event}" to a booking that is ${from}.`);
    this.name = 'InvalidTransitionError';
  }
}

export const canTransition = (from: BookingStatus, event: BookingEvent): boolean => TABLE[from][event] !== undefined;
export function transition(from: BookingStatus, event: BookingEvent): BookingStatus {
  const to = TABLE[from][event];
  if (!to) throw new InvalidTransitionError(from, event);
  return to;
}
export const isTerminal = (s: BookingStatus): boolean => Object.keys(TABLE[s]).length === 0;
/** Statuses that occupy the tech's calendar. */
export const occupiesCalendar = (s: BookingStatus): boolean => ['pending_deposit', 'confirmed', 'on_the_way', 'in_progress'].includes(s);
