// Supabase implementation (service-role client, server-side only). Active when NEXT_PUBLIC_SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are set. Authorization for customers is the signed link token checked in the API layer.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NotFoundError, SlotTakenError, type ListOpts, type NewRow, type Repo, type Table } from './repo';
import { TABLE_NAMES, type BookingRow, type QueueRow, type TableMap, type TableName } from './types';

class SbTable<T extends { id: string }> implements Table<T> {
  constructor(private sb: SupabaseClient, private name: TableName) {}
  private fail(error: { message: string; code?: string } | null): never {
    if (error?.code === '23P01' || (error?.code === '23505' && this.name === 'bookings' && /overlap|no_overlap/i.test(error.message))) throw new SlotTakenError();
    throw new Error(`${this.name}: ${error?.message ?? 'unknown error'}`);
  }
  async get(id: string) {
    const { data, error } = await this.sb.from(this.name).select('*').eq('id', id).maybeSingle();
    if (error) this.fail(error);
    return (data as T | null) ?? null;
  }
  async insert(row: NewRow<T>) {
    const { data, error } = await this.sb.from(this.name).insert(row as never).select('*').single();
    if (error) this.fail(error);
    return data as T;
  }
  async update(id: string, patch: Partial<Omit<T, 'id' | 'created_at'>>) {
    const { data, error } = await this.sb.from(this.name).update(patch as never).eq('id', id).select('*').maybeSingle();
    if (error) this.fail(error);
    if (!data) throw new NotFoundError(this.name);
    return data as T;
  }
  async updateIf(id: string, where: Partial<{ [K in keyof T]: T[K] | null }>, patch: Partial<Omit<T, 'id' | 'created_at'>>) {
    let q = this.sb.from(this.name).update(patch as never).eq('id', id);
    for (const [k, v] of Object.entries(where)) q = v === null || v === undefined ? q.is(k, null) : q.eq(k, v as never);
    const { data, error } = await q.select('*');
    if (error) this.fail(error);
    return data && data.length ? (data[0] as T) : null;
  }
  async remove(id: string) {
    const { error } = await this.sb.from(this.name).delete().eq('id', id);
    if (error) this.fail(error);
  }
  async list(opts: ListOpts<T> = {}) {
    let q = this.sb.from(this.name).select('*');
    for (const [k, v] of Object.entries(opts.where ?? {})) q = v === null ? q.is(k, null) : q.eq(k, v as never);
    for (const wi of opts.whereIn ?? []) q = q.in(wi.col, wi.values as never);
    if (opts.search?.q.trim()) {
      // PostgREST or() grammar: strip characters that would break out of the filter ( , ( ) % * \ )
      const term = opts.search.q.trim().replace(/[,()%*\\:"']/g, ' ').replace(/\s+/g, ' ').slice(0, 60);
      if (term) q = q.or(opts.search.cols.map((c) => `${c}.ilike.*${term}*`).join(','));
    }
    for (const r of opts.ranges ?? []) {
      if (r.gte !== undefined) q = q.gte(r.col, r.gte);
      if (r.gt !== undefined) q = q.gt(r.col, r.gt);
      if (r.lt !== undefined) q = q.lt(r.col, r.lt);
      if (r.lte !== undefined) q = q.lte(r.col, r.lte);
    }
    q = q.order(opts.orderBy ?? 'created_at', { ascending: !opts.desc });
    const start = opts.offset ?? 0;
    if (opts.limit) {
      const { data, error } = await q.range(start, start + opts.limit - 1);
      if (error) this.fail(error);
      return (data ?? []) as T[];
    }
    // No limit asked: page through PostgREST's 1000-row cap so reports never silently truncate.
    const out: T[] = [];
    for (let from = start; ; from += 1000) {
      const { data, error } = await q.range(from, from + 999);
      if (error) this.fail(error);
      out.push(...((data ?? []) as T[]));
      if (!data || data.length < 1000) break;
    }
    return out;
  }
  async first(opts: ListOpts<T> = {}) { return (await this.list({ ...opts, limit: 1 }))[0] ?? null; }
}

export function createSupabaseRepo(url: string, serviceKey: string): Repo {
  const sb = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const tables = Object.fromEntries(TABLE_NAMES.map((n) => [n, new SbTable(sb, n)])) as unknown as { [K in TableName]: Table<TableMap[K]> };
  return {
    ...tables,
    mode: 'supabase',
    admin: {
      async mergeCustomers(keepId, dropId) {
        const { data, error } = await sb.rpc('merge_customers', { keep_id: keepId, drop_id: dropId });
        if (error) throw new Error(`merge_customers: ${error.message}`);
        return { moved: (data ?? {}) as Record<string, number> };
      },
      async nextInvoiceNumber(now = Date.now()) {
        const { data, error } = await sb.rpc('next_invoice_number', { year: new Date(now).getUTCFullYear() });
        if (error || typeof data !== 'string') throw new Error(`next_invoice_number: ${error?.message ?? 'bad result'}`);
        return data;
      },
    },
    bookingsX: {
      // The bookings_no_overlap exclusion constraint is the source of truth; 23P01 maps to SlotTakenError.
      createChecked: (row: NewRow<BookingRow>) => tables.bookings.insert(row),
      moveChecked: (id, patch) => tables.bookings.update(id, patch),
    },
    queue: {
      async enqueue(row) {
        const { data, error } = await sb.from('notification_queue').upsert(row as never, { onConflict: 'dedupe_key', ignoreDuplicates: true }).select('*');
        if (error) throw new Error(`notification_queue: ${error.message}`);
        if (data && data.length) return data[0] as QueueRow;
        const ex = await tables.notification_queue.first({ where: { dedupe_key: row.dedupe_key } });
        if (!ex) throw new Error('notification_queue: enqueue failed');
        return ex;
      },
      async claimDue(nowISO, limit) {
        const { data: due, error } = await sb.from('notification_queue').select('*').eq('status', 'pending').lte('run_at', nowISO).order('run_at').limit(limit);
        if (error) throw new Error(`notification_queue: ${error.message}`);
        const claimed: QueueRow[] = [];
        for (const r of (due ?? []) as QueueRow[]) {
          // conditional update = optimistic lock; a concurrent worker that lost the race gets no row back
          const { data } = await sb.from('notification_queue').update({ status: 'processing', attempts: r.attempts + 1 }).eq('id', r.id).eq('status', 'pending').select('*');
          if (data && data.length) claimed.push(data[0] as QueueRow);
        }
        return claimed;
      },
      async cancelPending(bookingId, kinds) {
        let q = sb.from('notification_queue').update({ status: 'cancelled' }).eq('booking_id', bookingId).eq('status', 'pending');
        if (kinds?.length) q = q.in('kind', kinds);
        const { data, error } = await q.select('id');
        if (error) throw new Error(`notification_queue: ${error.message}`);
        return data?.length ?? 0;
      },
    },
  };
}
