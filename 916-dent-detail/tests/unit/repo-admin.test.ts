// Phase 3 repo extensions on the mock store: search, whereIn, offset, updateIf, merge, invoice numbers.
import { beforeEach, describe, expect, it } from 'vitest';
import { repo } from '@/lib/db';

beforeEach(async () => { await repo().reset!(); });

describe('list extensions', () => {
  it('search matches name/phone/email case-insensitively; whereIn and offset work', async () => {
    const db = repo();
    const a = await db.customers.insert({ name: 'Alex Rivera', email: 'ALEX@example.com', phone: '+19165550101', sms_opt_in: false });
    await db.customers.insert({ name: 'Blair Chen', email: 'b@example.com', phone: '+19165550102', sms_opt_in: false });
    await db.customers.insert({ name: 'Casey Ng', email: null, phone: '+19165550103', sms_opt_in: false });
    expect((await db.customers.list({ search: { cols: ['name', 'email', 'phone'], q: 'alex@EX' } })).map((c) => c.id)).toEqual([a.id]);
    expect(await db.customers.list({ search: { cols: ['phone'], q: '0102' } })).toHaveLength(1);
    expect(await db.customers.list({ search: { cols: ['name'], q: '   ' } })).toHaveLength(3);
    expect(await db.customers.list({ whereIn: [{ col: 'name', values: ['Alex Rivera', 'Casey Ng'] }] })).toHaveLength(2);
    const all = await db.customers.list({ orderBy: 'name' });
    expect((await db.customers.list({ orderBy: 'name', offset: 1, limit: 1 }))[0]!.id).toBe(all[1]!.id);
  });
});

describe('updateIf', () => {
  it('applies only while the condition holds', async () => {
    const db = repo();
    const c = await db.referral_codes.insert({ code: 'ABC123', credit_amount: 25, active: true });
    const cr = await db.referral_credits.insert({ referral_code_id: c.id, amount: 25, status: 'available' });
    const first = await db.referral_credits.updateIf(cr.id, { status: 'available' }, { status: 'redeemed' });
    const second = await db.referral_credits.updateIf(cr.id, { status: 'available' }, { status: 'redeemed' });
    expect(first?.status).toBe('redeemed');
    expect(second).toBeNull();
    expect(await db.referral_credits.updateIf('nope', { status: 'available' }, { status: 'void' })).toBeNull();
  });
});

describe('mergeCustomers', () => {
  it('moves children, fills gaps, keeps opt-out, deletes the duplicate', async () => {
    const db = repo();
    const keep = await db.customers.insert({ name: 'Sam R', phone: '+19165550142', sms_opt_in: false });
    const drop = await db.customers.insert({ name: 'Samuel Rivera', phone: '+19165550142', email: 'sam@example.com', sms_opt_in: true, sms_opt_in_at: '2026-01-01T00:00:00.000Z', sms_opt_in_text: 'x', sms_opt_out_at: '2026-02-01T00:00:00.000Z' });
    const v = await db.vehicles.insert({ customer_id: drop.id, make: 'Toyota' });
    await db.notes.insert({ entity_type: 'customer', entity_id: drop.id, body: 'prefers mornings' });
    await db.leads.insert({ customer_id: drop.id, stage: 'new', source: 'google' });
    const r = await db.admin.mergeCustomers(keep.id, drop.id);
    expect(r.moved).toMatchObject({ vehicles: 1, leads: 1, notes: 1 });
    expect(await db.customers.get(drop.id)).toBeNull();
    expect((await db.vehicles.get(v.id))!.customer_id).toBe(keep.id);
    const k = (await db.customers.get(keep.id))!;
    expect(k.email).toBe('sam@example.com');
    expect(k.sms_opt_out_at).toBe('2026-02-01T00:00:00.000Z');
    expect((await db.notes.list({ where: { entity_id: keep.id } }))).toHaveLength(1);
  });
  it('refuses self-merge and unknown ids', async () => {
    const db = repo();
    const c = await db.customers.insert({ name: 'A', sms_opt_in: false });
    await expect(db.admin.mergeCustomers(c.id, c.id)).rejects.toThrow();
    await expect(db.admin.mergeCustomers(c.id, 'missing')).rejects.toThrow();
  });
});

describe('nextInvoiceNumber', () => {
  it('increments per year', async () => {
    const db = repo();
    const t = Date.UTC(2026, 5, 1);
    const n1 = await db.admin.nextInvoiceNumber(t);
    expect(n1).toBe('INV-2026-0001');
    await db.invoices.insert({ number: n1, status: 'draft', line_items: [], subtotal: 0, deposit_applied: 0, total: 0 });
    expect(await db.admin.nextInvoiceNumber(t)).toBe('INV-2026-0002');
    expect(await db.admin.nextInvoiceNumber(Date.UTC(2027, 0, 2))).toBe('INV-2027-0001');
  });
});
