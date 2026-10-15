// Typed repository interface shared by the Supabase and mock implementations. Phases 3-5 add features by
// calling `repo()` (see ./index.ts); they should not talk to Supabase or the mock store directly.
import type { BookingRow, QueueRow, TableMap, TableName } from './types';

export type NewRow<T> = Omit<T, 'id' | 'created_at' | 'updated_at'> & { id?: string };
export type ListOpts<T> = {
  where?: Partial<{ [K in keyof T]: T[K] | null }>;
  /** Half-open ranges on one or more columns (ISO strings / numbers). */
  ranges?: { col: keyof T & string; gte?: string | number; gt?: string | number; lt?: string | number; lte?: string | number }[];
  orderBy?: keyof T & string;
  desc?: boolean;
  limit?: number;
  /** P3: skip this many rows (after ordering). */
  offset?: number;
  /** P3: row matches when ANY listed column equals one of the values. One entry per column; entries are ANDed. */
  whereIn?: { col: keyof T & string; values: (string | number)[] }[];
  /** P3: case-insensitive "contains" on any of the columns (OR). */
  search?: { cols: (keyof T & string)[]; q: string };
};

export interface Table<T extends { id: string }> {
  get(id: string): Promise<T | null>;
  insert(row: NewRow<T>): Promise<T>;
  update(id: string, patch: Partial<Omit<T, 'id' | 'created_at'>>): Promise<T>;
  remove(id: string): Promise<void>;
  /**
   * P3: optimistic conditional update. Applies `patch` only if every `where` column still equals the given value;
   * returns the updated row, or null when the condition no longer holds (someone else got there first).
   */
  updateIf(id: string, where: Partial<{ [K in keyof T]: T[K] | null }>, patch: Partial<Omit<T, 'id' | 'created_at'>>): Promise<T | null>;
  list(opts?: ListOpts<T>): Promise<T[]>;
  first(opts?: ListOpts<T>): Promise<T | null>;
}

export class SlotTakenError extends Error {
  constructor() { super('That time was just taken. Please pick another slot.'); this.name = 'SlotTakenError'; }
}
export class NotFoundError extends Error {
  constructor(what = 'record') { super(`${what} not found`); this.name = 'NotFoundError'; }
}

export type Repo = { [K in TableName]: Table<TableMap[K]> } & {
  readonly mode: 'mock' | 'supabase';
  bookingsX: {
    /** Insert a booking, atomically refusing an overlap with a live booking for the same tech. */
    createChecked(row: NewRow<BookingRow>): Promise<BookingRow>;
    /** Move a booking to a new slot with the same overlap guarantee. */
    moveChecked(id: string, patch: { starts_at: string; ends_at: string; tech_id: string }): Promise<BookingRow>;
  };
  queue: {
    /** Idempotent on dedupe_key: returns the existing row when it already exists. */
    enqueue(row: NewRow<QueueRow>): Promise<QueueRow>;
    /** Atomically flip due pending rows to "processing" and return them. */
    claimDue(nowISO: string, limit: number): Promise<QueueRow[]>;
    /** Cancel pending rows for a booking (optionally only some kinds). */
    cancelPending(bookingId: string, kinds?: QueueRow['kind'][]): Promise<number>;
  };
  /** P3 (admin) operations that need more than one table or a database-side sequence. */
  admin: {
    /** Re-point every child row from `dropId` to `keepId`, fill gaps on the kept record, delete the duplicate. */
    mergeCustomers(keepId: string, dropId: string): Promise<{ moved: Record<string, number> }>;
    /** Next human invoice number, e.g. INV-2026-0007. Unique per call (DB sequence on Supabase). */
    nextInvoiceNumber(now?: number): Promise<string>;
  };
  /** Mock-only helper for tests: wipe and reseed. No-op on Supabase. */
  reset?(): Promise<void>;
};
