// In-memory (optionally file-backed) mock store. Seeded on first use. Process-wide singleton on globalThis so
// Next route handlers, server components and HMR all see the same data.
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import { occupiesCalendar } from '@/lib/booking/state';
import { NotFoundError, SlotTakenError, type ListOpts, type NewRow, type Repo, type Table } from './repo';
import { CUSTOMER_FKS, FILLABLE, invoiceNumber } from './merge';
import { seedData } from './seed';
import { TABLE_NAMES, type BookingRow, type QueueRow, type TableMap, type TableName } from './types';

type Store = Record<TableName, Map<string, Record<string, unknown>>>;
const G = globalThis as unknown as { __mockRepo?: Repo };

function norm(v: unknown): unknown {
  return v instanceof Date ? v.toISOString() : v;
}
function cmpVal(a: unknown, b: unknown): number {
  const x = typeof a === 'string' && /^\d{4}-\d\d-\d\dT/.test(a) ? Date.parse(a) : a;
  const y = typeof b === 'string' && /^\d{4}-\d\d-\d\dT/.test(b) ? Date.parse(b) : b;
  return (x as number) < (y as number) ? -1 : (x as number) > (y as number) ? 1 : 0;
}

class MockTable<T extends { id: string }> implements Table<T> {
  constructor(private store: Store, private name: TableName, private persist: () => void) {}
  private get map() { return this.store[this.name]; }
  async get(id: string) { const r = this.map.get(id); return r ? ({ ...r } as unknown as T) : null; }
  async insert(row: NewRow<T>) {
    const now = new Date().toISOString();
    const rec = { ...(row as Record<string, unknown>) } as Record<string, unknown>;
    for (const k of Object.keys(rec)) rec[k] = norm(rec[k]);
    rec.id = (rec.id as string) || randomUUID();
    if (this.map.has(rec.id as string)) throw new Error(`duplicate key in ${this.name}`);
    rec.created_at = now; rec.updated_at = now;
    this.map.set(rec.id as string, rec);
    this.persist();
    return { ...rec } as unknown as T;
  }
  async update(id: string, patch: Partial<Omit<T, 'id' | 'created_at'>>) {
    const cur = this.map.get(id);
    if (!cur) throw new NotFoundError(this.name);
    const next = { ...cur } as Record<string, unknown>;
    for (const [k, v] of Object.entries(patch)) next[k] = norm(v);
    // strictly increasing per row: updated_at doubles as the row version for compare-and-set (updateIf), so two writes in one millisecond must differ
    const prev = Date.parse(String(cur.updated_at));
    next.updated_at = new Date(Math.max(Date.now(), Number.isFinite(prev) ? prev + 1 : 0)).toISOString();
    this.map.set(id, next);
    this.persist();
    return { ...next } as unknown as T;
  }
  async updateIf(id: string, where: Partial<{ [K in keyof T]: T[K] | null }>, patch: Partial<Omit<T, 'id' | 'created_at'>>) {
    const cur = this.map.get(id);
    if (!cur) return null;
    for (const [k, v] of Object.entries(where)) if ((cur[k] ?? null) !== (v ?? null)) return null;
    return this.update(id, patch);
  }
  async remove(id: string) { this.map.delete(id); this.persist(); }
  async list(opts: ListOpts<T> = {}) {
    let rows = [...this.map.values()];
    if (opts.where) {
      for (const [k, v] of Object.entries(opts.where)) rows = rows.filter((r) => (r[k] ?? null) === (v ?? null));
    }
    for (const rg of opts.ranges ?? []) {
      rows = rows.filter((r) => {
        const v = r[rg.col];
        if (v == null) return false;
        const cmp = (o: string | number | undefined, f: (c: number) => boolean) => o === undefined || f(cmpVal(v, o));
        return cmp(rg.gte, (c) => c >= 0) && cmp(rg.gt, (c) => c > 0) && cmp(rg.lt, (c) => c < 0) && cmp(rg.lte, (c) => c <= 0);
      });
    }
    for (const wi of opts.whereIn ?? []) rows = rows.filter((r) => wi.values.includes(r[wi.col] as string | number));
    if (opts.search?.q.trim()) {
      const q = opts.search.q.trim().toLowerCase();
      rows = rows.filter((r) => opts.search!.cols.some((c) => String(r[c] ?? '').toLowerCase().includes(q)));
    }
    const ob = opts.orderBy ?? 'created_at';
    rows.sort((a, b) => cmpVal(a[ob], b[ob]) * (opts.desc ? -1 : 1));
    if (opts.offset) rows = rows.slice(opts.offset);
    if (opts.limit) rows = rows.slice(0, opts.limit);
    return rows.map((r) => ({ ...r }) as unknown as T);
  }
  async first(opts: ListOpts<T> = {}) { return (await this.list({ ...opts, limit: 1 }))[0] ?? null; }
}

export function createMockRepo(): Repo {
  const file = process.env.MOCK_DB_FILE;
  const store = Object.fromEntries(TABLE_NAMES.map((n) => [n, new Map()])) as unknown as Store;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const persist = () => {
    if (!file) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      try { fs.writeFileSync(file, JSON.stringify(Object.fromEntries(TABLE_NAMES.map((n) => [n, [...store[n].values()]])))); } catch { /* best effort */ }
    }, 50);
  };
  const load = () => {
    if (file && fs.existsSync(file)) {
      try {
        const raw = JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, Record<string, unknown>[]>;
        for (const n of TABLE_NAMES) for (const r of raw[n] ?? []) store[n].set(r.id as string, r);
        return;
      } catch { /* fall through to seed */ }
    }
    const seed = seedData();
    const now = new Date().toISOString();
    for (const n of TABLE_NAMES) for (const r of (seed[n] ?? []) as Record<string, unknown>[]) store[n].set(r.id as string, { created_at: now, updated_at: now, ...r });
  };
  load();

  const t = <K extends TableName>(n: K) => new MockTable<TableMap[K]>(store, n, persist) as Table<TableMap[K]>;
  const tables = Object.fromEntries(TABLE_NAMES.map((n) => [n, t(n)])) as { [K in TableName]: Table<TableMap[K]> };

  const overlaps = (techId: string, s: string, e: string, ignoreId?: string) =>
    [...store.bookings.values()].some((b) => {
      const r = b as unknown as BookingRow;
      if (r.id === ignoreId || r.tech_id !== techId || !occupiesCalendar(r.status)) return false;
      if (r.status === 'pending_deposit' && r.hold_expires_at && Date.parse(r.hold_expires_at) <= Date.now()) return false;
      return Date.parse(r.starts_at) < Date.parse(e) && Date.parse(r.ends_at) > Date.parse(s);
    });

  const repo: Repo = {
    ...tables,
    mode: 'mock',
    bookingsX: {
      async createChecked(row) {
        if (row.tech_id && overlaps(row.tech_id, norm(row.starts_at) as string, norm(row.ends_at) as string)) throw new SlotTakenError();
        return tables.bookings.insert(row);
      },
      async moveChecked(id, patch) {
        if (overlaps(patch.tech_id, patch.starts_at, patch.ends_at, id)) throw new SlotTakenError();
        return tables.bookings.update(id, patch);
      },
    },
    queue: {
      async enqueue(row) {
        const ex = await tables.notification_queue.first({ where: { dedupe_key: row.dedupe_key } });
        return ex ?? tables.notification_queue.insert(row);
      },
      async claimDue(nowISO, limit) {
        const due = (await tables.notification_queue.list({ where: { status: 'pending' }, ranges: [{ col: 'run_at', lte: nowISO }], orderBy: 'run_at', limit })) as QueueRow[];
        const out: QueueRow[] = [];
        for (const r of due) out.push(await tables.notification_queue.update(r.id, { status: 'processing', attempts: r.attempts + 1 }));
        return out;
      },
      async cancelPending(bookingId, kinds) {
        const rows = await tables.notification_queue.list({ where: { booking_id: bookingId, status: 'pending' } });
        let n = 0;
        for (const r of rows) if (!kinds || kinds.includes(r.kind)) { await tables.notification_queue.update(r.id, { status: 'cancelled' }); n++; }
        return n;
      },
    },
    admin: {
      async mergeCustomers(keepId, dropId) {
        if (keepId === dropId) throw new Error('Cannot merge a customer into itself.');
        const keep = await tables.customers.get(keepId);
        const drop = await tables.customers.get(dropId);
        if (!keep || !drop) throw new NotFoundError('customer');
        const moved: Record<string, number> = {};
        for (const { table, col } of CUSTOMER_FKS) {
          let n = 0;
          for (const r of store[table].values()) if (r[col] === dropId) { r[col] = keepId; r.updated_at = new Date().toISOString(); n++; }
          if (n) moved[table] = n;
        }
        let n = 0;
        for (const r of store.notes.values()) if (r.entity_type === 'customer' && r.entity_id === dropId) { r.entity_id = keepId; n++; }
        for (const r of store.events.values()) if (r.entity_type === 'customer' && r.entity_id === dropId) { r.entity_id = keepId; }
        if (n) moved.notes = n;
        const patch: Record<string, unknown> = {};
        for (const f of FILLABLE) if (!(keep as Record<string, unknown>)[f] && (drop as Record<string, unknown>)[f]) patch[f] = (drop as Record<string, unknown>)[f];
        // consent: keep the strongest evidence; an opt-out on either record stays an opt-out
        if (!keep.sms_opt_in && drop.sms_opt_in) Object.assign(patch, { sms_opt_in: true, sms_opt_in_at: drop.sms_opt_in_at ?? null, sms_opt_in_text: drop.sms_opt_in_text ?? null });
        if (!keep.sms_opt_out_at && drop.sms_opt_out_at) patch.sms_opt_out_at = drop.sms_opt_out_at;
        if (Object.keys(patch).length) await tables.customers.update(keepId, patch);
        await tables.customers.remove(dropId);
        return { moved };
      },
      async nextInvoiceNumber(now = Date.now()) {
        const year = new Date(now).getUTCFullYear();
        const prefix = `INV-${year}-`;
        let max = 0;
        for (const r of store.invoices.values()) {
          const num = r.number as string | null;
          if (num?.startsWith(prefix)) max = Math.max(max, Number(num.slice(prefix.length)) || 0);
        }
        return invoiceNumber(year, max + 1);
      },
    },
    async reset() {
      for (const n of TABLE_NAMES) store[n].clear();
      const seed = seedData();
      const now = new Date().toISOString();
      for (const n of TABLE_NAMES) for (const r of (seed[n] ?? []) as Record<string, unknown>[]) store[n].set(r.id as string, { created_at: now, updated_at: now, ...r });
      persist();
    },
  };
  return repo;
}

export function mockRepo(): Repo {
  return (G.__mockRepo ??= createMockRepo());
}
