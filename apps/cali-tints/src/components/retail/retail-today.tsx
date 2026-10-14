import type { CalendarItem, RetailMoneySummary, TextQueueRow } from "@/lib/db/types";

/**
 * Data shapes the demo fixtures still build for the Retail dashboard's
 * appointments and online bookings. (The screen itself is retail-dashboard.tsx.)
 */
export interface RetailTodayCar {
  id: string;
  tag: string;
  /** The repair order number (0043). */
  ro_number?: string | null;
  vehicle: string | null;
  customer: string | null;
  performed_at: string;
  paid_at: string | null;
  /** Set once the repair order is converted to the invoice (0052); null = still work in progress. */
  invoiced_at?: string | null;
  services: string[];
}

export interface RetailTodayData {
  customers: number;
  /** Retail cars logged today, newest first. */
  today: RetailTodayCar[];
  /** Retail jobs still to collect (any day). */
  unpaid: RetailTodayCar[];
  /** Repair orders in the shop, approved but not invoiced yet (0052). */
  inProgress?: RetailTodayCar[];
  /** Online bookings waiting for a confirmation. */
  leads: CalendarItem[];
  /** Spots held right now by someone booking online. */
  holds: CalendarItem[];
  /** Today's appointments, in order. */
  appointments: CalendarItem[];
  /** Owner/admin only: deposits and what came in this week. */
  money?: RetailMoneySummary | null;
  /** Texts the automations queued for the phone: one tap each. */
  texts?: TextQueueRow[];
}

