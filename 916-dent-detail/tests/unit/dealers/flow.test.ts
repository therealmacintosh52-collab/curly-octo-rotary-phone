import { beforeEach, describe, expect, it } from 'vitest';
import { repo } from '@/lib/db';
import { emailOutbox } from '@/lib/email';
import { AccountError, approveDealer, setDealerStatus, setNetTerms, setWholesaleRates, signUpDealer } from '@/lib/dealers/accounts';
import { AddonError, asProposals, decideAddon, dealerVisible, priceAddon, proposeAddon } from '@/lib/dealers/addons';
import { trail } from '@/lib/dealers/audit';
import { computeCheckDigit } from '@/lib/dealers/vin';
import { statementPdf } from '@/lib/dealers/pdf';
import { applyStripeInvoiceEvent, dealerLedger, generateStatement, issueInvoice, markInvoicePaid, markOverdue, runMonthlyStatements, voidInvoice, BillingError, asLines, invoiceTerms } from '@/lib/dealers/statements';
import { StatusError } from '@/lib/dealers/status';
import { attachPhoto, countsByColumn, getVehicle, listVehicles, previewBulk, setVehiclePrice, setVehicleStatus, submitBulk, VehicleError } from '@/lib/dealers/vehicles';

const vinFrom = (stem: string) => { const raw = stem.slice(0, 8) + '0' + stem.slice(8, 16); return raw.slice(0, 8) + computeCheckDigit(raw) + raw.slice(9); };
const V1 = '1HGCM82633A004352';
const V2 = '1M8GDM9AXKP042788';
const V3 = vinFrom('1FTEW1EPKFA00001');
const ymNow = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit' }).format(new Date());

const signup = (over: Record<string, unknown> = {}) => signUpDealer({
  businessName: 'Test Motors', contactName: 'Pat Manager', email: 'pat@testmotors.example', phone: '(916) 555-0123',
  lotAddresses: ['1 Auto Mall Dr, Roseville, CA 95661'], apEmail: 'ap@testmotors.example', expectedMonthlyVolume: 40, netTermsRequested: true, ...over,
});

async function activeDealer() {
  const { dealer } = await signup();
  return approveDealer(dealer.id, { netTermsApproved: true, netTermsDays: 30 });
}

const CSV = (rows: string[]) => ['vin,stock_number,panels,services,notes', ...rows].join('\n');
const actor = (id: string) => `dealer:${id}` as const;

beforeEach(async () => { await repo().reset?.(); emailOutbox().length = 0; });

describe('accounts', () => {
  it('signup creates a PENDING dealer + login + dealer_user, emails the dealer, refuses a duplicate email', async () => {
    const { dealer, profileId } = await signup();
    expect(dealer.status).toBe('pending');
    expect(dealer).toMatchObject({ ap_email: 'ap@testmotors.example', license_number: null, expected_monthly_volume: 40, net_terms_requested: true, net_terms_approved: false, address_zip: '95661' });
    expect(await repo().dealer_users.first({ where: { dealer_id: dealer.id, profile_id: profileId } })).not.toBeNull();
    expect((await repo().profiles.get(profileId))?.role).toBe('dealer');
    expect(emailOutbox().some((m) => m.to === 'pat@testmotors.example' && /received/i.test(m.subject))).toBe(true);
    await expect(signup()).rejects.toBeInstanceOf(AccountError);
  });
  it('approval activates, records terms, emails; terms must be an allowed option', async () => {
    const { dealer } = await signup();
    const d = await approveDealer(dealer.id, { netTermsApproved: true, netTermsDays: 15, note: 'ok' });
    expect(d).toMatchObject({ status: 'active', net_terms_approved: true, net_terms_days: 15 });
    expect(d.approved_at).toBeTruthy();
    expect(emailOutbox().some((m) => /approved/i.test(m.subject))).toBe(true);
    await expect(setNetTerms(dealer.id, { approved: true, days: 45 })).rejects.toBeInstanceOf(AccountError);
    expect((await setDealerStatus(dealer.id, 'paused')).status).toBe('paused');
  });
  it('wholesale rates: validates ids and values, blank clears', async () => {
    const { dealer } = await signup();
    expect((await setWholesaleRates(dealer.id, { pdr_panel: 12.345 })).wholesale_pricing).toEqual({ pdr_panel: 12.35 });
    await expect(setWholesaleRates(dealer.id, { nope: 5 })).rejects.toBeInstanceOf(AccountError);
    await expect(setWholesaleRates(dealer.id, { pdr_panel: -1 })).rejects.toBeInstanceOf(AccountError);
    expect((await setWholesaleRates(dealer.id, { pdr_panel: null })).wholesale_pricing).toEqual({});
  });
  it('invoiceTerms: unapproved dealers are due on receipt', () => {
    expect(invoiceTerms({ net_terms_approved: false, net_terms_days: 30 })).toEqual({ days: 1, label: 'Due on receipt' });
    expect(invoiceTerms({ net_terms_approved: true, net_terms_days: 15 })).toEqual({ days: 15, label: 'Net 15' });
  });
});

describe('bulk submission', () => {
  it('creates vehicle + job + dealer_vehicle per good row, reports bad rows, dedupes in-file and against open vehicles', async () => {
    const d = await activeDealer();
    const bad = V1.slice(0, 11) + '5' + V1.slice(12);
    const csv = CSV([`${V1},A1,2,dent;interior,left rear door`, `${V1},A1b,,,`, `${bad},A2,,,`, `${V2},A3,,interior,`]);
    const prev = await previewBulk(d.id, csv);
    expect(prev.okCount).toBe(2); expect(prev.errorCount).toBe(2);
    const rep = await submitBulk(d, actor(d.id), csv);
    expect(rep.created.map((c) => c.vin)).toEqual([V1, V2]);
    expect(rep.rejected.map((r) => r.line)).toEqual([3, 4]);
    expect(rep.rejected[0]!.errors[0]).toMatch(/Duplicate VIN/);
    expect(rep.rejected[1]!.errors[0]).toMatch(/Check digit/);

    const dvs = await repo().dealer_vehicles.list({ where: { dealer_id: d.id } });
    expect(dvs).toHaveLength(2);
    const a = dvs.find((v) => v.vin === V1)!;
    expect(a).toMatchObject({ status: 'submitted', stock_number: 'A1', year: 2003, make: 'Honda', panels: 2, price: null, batch_id: rep.batchId });
    expect(a.services).toEqual([{ id: 'pdr_panel', panels: 2 }, { id: 'interior_reset' }]);
    const job = await repo().jobs.get(a.job_id!);
    expect(job).toMatchObject({ dealer_id: d.id, stage: 'new' });
    expect(job!.summary).toContain('Stock A1');
    expect(await repo().vehicles.get(job!.vehicle_id!)).toMatchObject({ dealer_id: d.id, vin: V1 });
    expect((await repo().customers.first({ where: { dealer_id: d.id } }))?.name).toBe('Test Motors');

    const again = await submitBulk(d, actor(d.id), CSV([`${V1},A9,,,`, `${V3},A10,,,`]));
    expect(again.rejected[0]!.errors[0]).toMatch(/Already submitted/);
    expect(again.created).toHaveLength(1);
  });
  it('a fatal file problem throws instead of creating anything', async () => {
    const d = await activeDealer();
    await expect(submitBulk(d, actor(d.id), 'stock,year\nA1,2020')).rejects.toBeInstanceOf(VehicleError);
    expect(await repo().dealer_vehicles.list({ where: { dealer_id: d.id } })).toHaveLength(0);
  });
  it('search by stock number, VIN fragment, make; board counts', async () => {
    const d = await activeDealer();
    await submitBulk(d, actor(d.id), CSV([`${V1},A1,,,`, `${V2},B7,,,`]));
    expect((await listVehicles(d.id, { q: 'b7' })).map((v) => v.stock_number)).toEqual(['B7']);
    expect((await listVehicles(d.id, { q: V1.slice(-6) })).map((v) => v.stock_number)).toEqual(['A1']);
    expect((await listVehicles(d.id, { q: 'honda' })).length).toBe(1);
    expect((await listVehicles(d.id, { status: 'scheduled' })).length).toBe(0);
    expect((await countsByColumn(d.id))).toMatchObject({ all: 2, submitted: 2, scheduled: 0 });
  });
  it("one dealer can never read or touch another dealer's vehicles or photos", async () => {
    const a = await activeDealer();
    const { dealer: b0 } = await signup({ businessName: 'Other Cars', email: 'x@other.example', apEmail: 'ap@other.example' });
    const b = await approveDealer(b0.id);
    const rep = await submitBulk(a, actor(a.id), CSV([`${V1},A1,,,`]));
    const id = rep.created[0]!.id;
    expect(await getVehicle(b.id, id)).toBeNull();
    await expect(setVehicleStatus(id, 'cancelled', actor(b.id), { dealerId: b.id })).rejects.toBeInstanceOf(VehicleError);
    await expect(attachPhoto(b.id, id, `dealers/${b.id}/${crypto.randomUUID()}.jpg`)).rejects.toBeInstanceOf(VehicleError);
    await expect(attachPhoto(a.id, id, `dealers/${b.id}/${crypto.randomUUID()}.jpg`)).rejects.toBeInstanceOf(VehicleError);
    await expect(attachPhoto(a.id, id, `../../etc/passwd`)).rejects.toBeInstanceOf(VehicleError);
    const p = `dealers/${a.id}/${crypto.randomUUID()}.jpg`;
    expect((await attachPhoto(a.id, id, p)).photo_paths).toEqual([p]);
  });
});

describe('status tracking', () => {
  it('owner moves it along the chain, job stays in step, audit trail records each step, dealer is told when frontline-ready', async () => {
    const d = await activeDealer();
    const id = (await submitBulk(d, actor(d.id), CSV([`${V1},A1,,dent,`]))).created[0]!.id;
    await expect(setVehicleStatus(id, 'done', 'owner')).rejects.toBeInstanceOf(StatusError);
    await setVehicleStatus(id, 'scheduled', 'owner');
    const ip = await setVehicleStatus(id, 'in_progress', 'owner');
    expect((await repo().jobs.get(ip.job_id!))).toMatchObject({ stage: 'in_progress' });
    expect((await repo().jobs.get(ip.job_id!))!.started_at).toBeTruthy();
    emailOutbox().length = 0;
    const done = await setVehicleStatus(id, 'done', 'owner');
    expect(done.done_at).toBeTruthy();
    expect(await repo().jobs.get(done.job_id!)).toMatchObject({ stage: 'done' });
    expect(emailOutbox().some((m) => /frontline-ready/.test(m.subject) && m.to === d.email)).toBe(true);
    const t = await trail('dealer_vehicle', id);
    const steps = t.filter((e) => e.type === 'dealer.vehicle.status').map((e) => (e.data as { to: string }).to);
    expect([...steps].sort()).toEqual(['done', 'in_progress', 'scheduled']);
    expect(t.some((e) => e.type === 'dealer.vehicle.submitted')).toBe(true);
  });
  it('dealers may only cancel a car that has not started', async () => {
    const d = await activeDealer();
    const id = (await submitBulk(d, actor(d.id), CSV([`${V1},A1,,,`]))).created[0]!.id;
    await expect(setVehicleStatus(id, 'scheduled', actor(d.id), { dealerId: d.id })).rejects.toBeInstanceOf(VehicleError);
    expect((await setVehicleStatus(id, 'cancelled', actor(d.id), { dealerId: d.id })).status).toBe('cancelled');
    // a cancelled VIN can be submitted again
    expect((await submitBulk(d, actor(d.id), CSV([`${V1},A1,,,`]))).created).toHaveLength(1);
  });
});

describe('add-ons', () => {
  it('draft (unpriced) is hidden from the dealer; owner prices it, dealer is emailed; only the owning dealer can decide, once', async () => {
    const d = await activeDealer();
    const { dealer: o0 } = await signup({ businessName: 'Other', email: 'o@o.example', apEmail: 'o@o.example' });
    const other = await approveDealer(o0.id);
    const id = (await submitBulk(d, actor(d.id), CSV([`${V1},A1,,dent,`]))).created[0]!.id;
    const a = await proposeAddon(id, { label: 'Second panel: right fender', by: 'tech' }, 'tech');
    expect(a.status).toBe('draft');
    expect(dealerVisible(asProposals((await repo().dealer_vehicles.get(id))!.addon_approvals))).toHaveLength(0);
    await expect(decideAddon(d, id, a.id, 'approved', actor(d.id))).rejects.toBeInstanceOf(AddonError);
    emailOutbox().length = 0;
    await priceAddon(id, a.id, 85);
    expect(emailOutbox().some((m) => /Approval needed/.test(m.subject) && m.to === d.email)).toBe(true);
    await expect(decideAddon(other, id, a.id, 'approved', actor(other.id))).rejects.toBeInstanceOf(AddonError);
    const ok = await decideAddon(d, id, a.id, 'approved', actor(d.id), 'go ahead');
    expect(ok).toMatchObject({ status: 'approved', decidedBy: actor(d.id), reason: 'go ahead', price: 85 });
    await expect(decideAddon(d, id, a.id, 'declined', actor(d.id))).rejects.toThrow(/already approved/);
    const types = (await trail('dealer_vehicle', id)).map((e) => e.type);
    expect(types).toEqual(expect.arrayContaining(['dealer.addon.proposed', 'dealer.addon.priced', 'dealer.addon.approved']));
  });
  it('a priced proposal goes straight to the dealer; declined add-ons are not billed; bad prices rejected', async () => {
    const d = await activeDealer();
    const id = (await submitBulk(d, actor(d.id), CSV([`${V1},A1,,,`]))).created[0]!.id;
    expect((await proposeAddon(id, { label: 'Interior Reset', price: 120, by: 'owner' }, 'owner')).status).toBe('proposed');
    await expect(proposeAddon(id, { label: 'x', price: -3, by: 'owner' }, 'owner')).rejects.toBeInstanceOf(AddonError);
    await expect(proposeAddon(id, { label: '  ', by: 'owner' }, 'owner')).rejects.toBeInstanceOf(AddonError);
    const [a] = asProposals((await repo().dealer_vehicles.get(id))!.addon_approvals);
    expect((await decideAddon(d, id, a!.id, 'declined', actor(d.id))).status).toBe('declined');
  });
});

describe('billing: statements, invoices, aging, PDF', () => {
  async function seedFinished() {
    const d = await activeDealer();
    const rep = await submitBulk(d, actor(d.id), CSV([`${V1},A1,2,dent;interior,`, `${V2},A2,,interior,`, `${V3},A3,,,`]));
    const ids = rep.created.map((c) => c.id);
    for (const id of ids) { await setVehicleStatus(id, 'scheduled', 'owner'); await setVehicleStatus(id, 'in_progress', 'owner'); await setVehicleStatus(id, 'done', 'owner'); }
    await setVehiclePrice(ids[0]!, 300); await setVehiclePrice(ids[1]!, 150.5); // third stays unpriced
    const ap = await proposeAddon(ids[0]!, { label: 'Extra panel', price: 75, by: 'owner' }, 'owner');
    await decideAddon(d, ids[0]!, ap.id, 'approved', actor(d.id));
    const ap2 = await proposeAddon(ids[1]!, { label: 'Odor treatment', price: 60, by: 'owner' }, 'owner');
    await decideAddon(d, ids[1]!, ap2.id, 'declined', actor(d.id));
    return { d, ids };
  }

  it('aggregates priced completed work for the month, holds back unpriced, and is idempotent', async () => {
    const { d, ids } = await seedFinished();
    const r = await generateStatement(d.id, ymNow());
    expect(r).toMatchObject({ created: true, added: 2, unpriced: 1 });
    expect(r.statement!.total).toBe(300 + 75 + 150.5);
    expect(r.statement!).toMatchObject({ status: 'open', vehicle_count: 2, unpriced_count: 1 });
    expect(asLines(r.statement!.line_items).map((l) => l.stock_number)).toEqual(['A1', 'A2']);
    const again = await generateStatement(d.id, ymNow());
    expect(again).toMatchObject({ created: false, added: 0 });
    expect((await repo().dealer_statements.list({ where: { dealer_id: d.id } }))).toHaveLength(1);
    // price the held-back car, rerun: the OPEN statement picks it up
    await setVehiclePrice(ids[2]!, 40);
    const upd = await generateStatement(d.id, ymNow());
    expect(upd).toMatchObject({ created: false, added: 1, unpriced: 0 });
    expect(upd.statement!.total).toBe(300 + 75 + 150.5 + 40);
    expect(await generateStatement(d.id, '2026-01')).toMatchObject({ statement: null }); // an empty month makes no $0 statement
  });

  it('issues a mock net-30 invoice, builds a valid PDF, marks paid, writes a payment row', async () => {
    const { d } = await seedFinished();
    const { statement } = await generateStatement(d.id, ymNow());
    const now = Date.parse('2026-10-31T12:00:00Z');
    const inv = await issueInvoice(statement!.id, now);
    expect(inv).toMatchObject({ status: 'sent', total: 525.5, mock: true, net_days: 30, dealer_id: d.id, statement_id: statement!.id });
    expect(inv.stripe_invoice_id).toMatch(/^in_mock_/);
    expect(inv.hosted_invoice_url).toBe(`/dealers/dashboard/billing/invoices/${inv.stripe_invoice_id}`);
    expect(inv.due_at).toBe(new Date(now + 30 * 86400000).toISOString());
    expect(inv.number).toMatch(/^INV-\d{6}-[0-9A-F]{6}$/);
    expect((await repo().dealer_statements.get(statement!.id))).toMatchObject({ status: 'sent', invoice_id: inv.id });
    expect((await repo().dealer_vehicles.list({ where: { invoice_id: inv.id } })).every((v) => v.status === 'invoiced')).toBe(true);
    await expect(issueInvoice(statement!.id)).rejects.toBeInstanceOf(BillingError);
    expect(emailOutbox().some((m) => m.to === 'ap@testmotors.example' && /Invoice INV-/.test(m.subject))).toBe(true);

    const st = (await repo().dealer_statements.get(statement!.id))!;
    const pdf = await statementPdf({ statement: st, lines: asLines(st.line_items), dealer: d, invoice: inv, termsLabel: 'Net 30' });
    expect(Buffer.from(pdf.subarray(0, 5)).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(1500);

    const l1 = await dealerLedger(d.id, now + 5 * 86400000);
    expect(l1.balance).toBe(525.5); expect(l1.aging.current).toBe(525.5);
    const l2 = await dealerLedger(d.id, now + 45 * 86400000);
    expect(l2.aging.d1_30).toBe(525.5); expect(l2.invoices[0]!.effectiveStatus).toBe('overdue');

    const paid = await markInvoicePaid(inv.id, { method: 'check', reference: '#1042' });
    expect(paid.status).toBe('paid'); expect(paid.paid_at).toBeTruthy();
    expect((await repo().dealer_statements.get(statement!.id))!.status).toBe('paid');
    const pay = await repo().payments.first({ where: { invoice_id: inv.id } });
    expect(pay).toMatchObject({ kind: 'dealer', amount: 525.5, status: 'succeeded', mock: true });
    expect((await dealerLedger(d.id)).balance).toBe(0);
    await expect(voidInvoice(inv.id)).rejects.toBeInstanceOf(BillingError);
  });

  it('void reopens the statement so it can be corrected and reissued; overdue sweep; stripe webhook handler', async () => {
    const { d, ids } = await seedFinished();
    const { statement } = await generateStatement(d.id, ymNow());
    const inv = await issueInvoice(statement!.id, Date.parse('2026-01-01T00:00:00Z'));
    expect(await markOverdue(Date.parse('2026-03-01T00:00:00Z'))).toBe(1);
    expect((await repo().invoices.get(inv.id))!.status).toBe('overdue');
    expect((await repo().dealer_statements.get(statement!.id))!.status).toBe('overdue');
    await voidInvoice(inv.id);
    expect((await repo().invoices.get(inv.id))!.status).toBe('void');
    const reopened = (await repo().dealer_statements.get(statement!.id))!;
    expect(reopened).toMatchObject({ status: 'open', invoice_id: null });
    expect((await repo().dealer_vehicles.get(ids[0]!))!.status).toBe('done');
    const inv2 = await issueInvoice(statement!.id);
    expect(inv2.id).not.toBe(inv.id);
    expect(await applyStripeInvoiceEvent('invoice.paid', inv2.stripe_invoice_id!)).toBe('paid');
    expect((await repo().invoices.get(inv2.id))!.status).toBe('paid');
    expect(await applyStripeInvoiceEvent('invoice.paid', 'in_unknown')).toBe('ignored');
    expect(await applyStripeInvoiceEvent('customer.created', inv2.stripe_invoice_id!)).toBe('ignored');
  });

  it('billed vehicles cannot be repriced or reopened; cron run reports the month and skips non-active dealers', async () => {
    const { d, ids } = await seedFinished();
    const month = ymNow();
    const run = await runMonthlyStatements({ month, now: new Date() });
    expect(run).toMatchObject({ month, dealers: 2, created: 1, unpricedVehicles: 1 }) // 2 = the seeded demo dealer + ours;
    await expect(setVehiclePrice(ids[0]!, 1)).rejects.toBeInstanceOf(VehicleError);
    await expect(setVehicleStatus(ids[0]!, 'in_progress', 'owner')).rejects.toThrow(/statement/);
    const rerun = await runMonthlyStatements({ month });
    expect(rerun.created).toBe(0);
    await setDealerStatus(d.id, 'paused');
    expect((await runMonthlyStatements({ month })).dealers).toBe(1); // only the seeded demo dealer is still active
  });

  it('PDF paginates a long statement', async () => {
    const d = await activeDealer();
    const lines = Array.from({ length: 80 }, (_, i) => ({ vehicle_id: `v${i}`, stock_number: `S${i}`, vin: V1, label: '2019 Toyota Camry SE', done_at: '2026-10-05T00:00:00Z', description: 'Dent Removal (no paint, no body shop) x3 panels, Interior Reset, Paint Deep-Clean', base: 100 + i, addons: i % 5 === 0 ? [{ id: 'a', label: 'Extra panel', amount: 50 }] : [], total: 100 + i }));
    const st = { id: 's', dealer_id: d.id, period_start: '2026-10-01', period_end: '2026-10-31', total: 12345.67, status: 'open', line_items: lines, created_at: '', updated_at: '' } as never;
    const bytes = await statementPdf({ statement: st, lines, dealer: d, termsLabel: 'Net 30' });
    const { PDFDocument } = await import('pdf-lib');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThan(2);
  });
});
