// Vehicle submission (single + bulk), queries, status changes. Creates a vehicles row, a jobs row (work order, linked to the
// dealer) and a dealer_vehicles row per car, all through repo(). Per-row failures never abort the batch.
import { randomUUID } from 'node:crypto';
import { log } from '@/lib/api/log';
import { isSupabaseLive, repo } from '@/lib/db';
import type { Dealer, DealerVehicle } from '@/lib/db/types';
import { ensureDealerCustomer } from './accounts';
import { asProposals, dealerVisible, pendingFor } from './addons';
import { audit, type Actor } from './audit';
import { getDealerService, suggestPrice, type ServiceRequest } from './catalog';
import { parseCsv, validateRows, type RowResult, type VehicleInput } from './csv';
import { notifyDealer, notifyOwner, portalUrl } from './notify';
import { DEALER_PHOTO_MAX_PER_VEHICLE, DEALER_PHOTO_RE } from './photos';
import { assertTransition, BOARD_COLUMNS, isOpen, jobStageFor, STATUS_LABEL, type VehicleStatus } from './status';
import { decodeVinVpic } from './vin';

export class VehicleError extends Error {
  constructor(public code: 'not_found' | 'invalid' | 'limit', message: string) { super(message); this.name = 'VehicleError'; }
}

export const vehicleLabel = (v: Pick<DealerVehicle, 'year' | 'make' | 'model' | 'vin' | 'stock_number'>): string => {
  if (v.make || v.model) return [v.year, v.make, v.model].filter(Boolean).join(' ');
  if (v.vin) return [v.year, `VIN …${v.vin.slice(-8)}`].filter(Boolean).join(' ');
  return v.stock_number ? `Stock ${v.stock_number}` : 'Vehicle';
};

export function describeServices(services: unknown, panels?: number | null): string {
  const list = (Array.isArray(services) ? services : []) as ServiceRequest[];
  if (!list.length) return 'Inspection and proposal';
  return list.map((s) => {
    const def = getDealerService(s.id);
    if (!def) return s.id;
    const n = def.unit === 'panel' ? s.panels ?? panels ?? null : null;
    return n ? `${def.plain} x${n} panel${n === 1 ? '' : 's'}` : def.plain;
  }).join(', ');
}

/** VIN -> short text for vehicles still open on this dealer's account (used to refuse duplicates). */
export async function openVinMap(dealerId: string): Promise<Map<string, string>> {
  const rows = await repo().dealer_vehicles.list({ where: { dealer_id: dealerId } });
  const m = new Map<string, string>();
  for (const r of rows) if (r.vin && isOpen(r.status)) m.set(r.vin, `${r.stock_number ? `stock ${r.stock_number}, ` : ''}${STATUS_LABEL[r.status].toLowerCase()}`);
  return m;
}

export type Preview = { fatal: string[]; notes: string[]; rows: RowResult[]; okCount: number; errorCount: number };

/** Parse + validate without writing anything: powers the per-row error report before the dealer confirms. */
export async function previewBulk(dealerId: string, csvText: string, now = new Date()): Promise<Preview> {
  const parsed = parseCsv(csvText);
  const fatal = parsed.rows.length === 0 ? parsed.errors : [];
  const notes = parsed.rows.length === 0 ? [] : parsed.errors;
  const rows = parsed.rows.length ? validateRows(parsed.rows, { existingOpen: await openVinMap(dealerId), now }) : [];
  if (isSupabaseLive()) await enrichWithVpic(rows);
  return { fatal, notes, rows, okCount: rows.filter((r) => r.ok).length, errorCount: rows.filter((r) => !r.ok).length };
}

/** Live mode only: fill blank year/make/model from NHTSA vPIC. Never overrides what the dealer typed. Bounded concurrency. */
async function enrichWithVpic(rows: RowResult[]): Promise<void> {
  const todo = rows.filter((r) => r.ok && r.value && (!r.value.model || !r.value.make || !r.value.year));
  for (let i = 0; i < todo.length; i += 5) {
    await Promise.all(todo.slice(i, i + 5).map(async (r) => {
      const d = await decodeVinVpic(r.vin!);
      if (!d || !r.value) return;
      r.value.year ??= d.year; r.value.make ??= d.make; r.value.model ??= d.model;
      if (r.value.decoded === 'none' || r.value.decoded === 'offline') r.value.decoded = 'offline';
    }));
  }
}

export type SubmitReport = {
  batchId: string;
  created: { line: number; id: string; vin: string; stock_number: string | null; label: string }[];
  rejected: { line: number; vin?: string; errors: string[] }[];
  warnings: { line: number; messages: string[] }[];
};

/** Validate and create. Rows that fail validation (or hit a race on the unique open-VIN index) are reported, the rest are created. */
export async function submitBulk(dealer: Dealer, actor: Actor, csvText: string): Promise<SubmitReport> {
  const p = await previewBulk(dealer.id, csvText);
  if (p.fatal.length) throw new VehicleError('invalid', p.fatal[0]!);
  return createFromRows(dealer, actor, p.rows);
}

export async function createFromRows(dealer: Dealer, actor: Actor, rows: RowResult[], batchId = randomUUID()): Promise<SubmitReport> {
  const report: SubmitReport = { batchId, created: [], rejected: [], warnings: [] };
  const customer = await ensureDealerCustomer(dealer);
  for (const r of rows) {
    if (!r.ok || !r.value) { report.rejected.push({ line: r.line, vin: r.vin, errors: r.errors }); continue; }
    if (r.warnings.length) report.warnings.push({ line: r.line, messages: r.warnings });
    try {
      const dv = await createOne(dealer, customer.id, r.value, batchId);
      report.created.push({ line: r.line, id: dv.id, vin: r.value.vin, stock_number: r.value.stock_number, label: vehicleLabel(dv) });
    } catch (e) {
      const msg = (e as Error).message;
      const dup = /duplicate|unique|23505/i.test(msg);
      report.rejected.push({ line: r.line, vin: r.value.vin, errors: [dup ? 'Already submitted and still open.' : 'Could not save this row. Try it again on its own.'] });
      if (!dup) log('error', 'dealer.submit.row_failed', { dealer: dealer.id, detail: msg.slice(0, 100) });
    }
  }
  if (report.created.length) {
    await notifyOwner(`${dealer.name} submitted ${report.created.length} vehicle${report.created.length === 1 ? '' : 's'}`, `Review: ${portalUrl('/admin/dealers')}`);
    await audit('dealer.batch', 'dealer', dealer.id, actor, { batch: batchId, created: report.created.length, rejected: report.rejected.length });
  }
  return report;
}

async function createOne(dealer: Dealer, customerId: string, v: VehicleInput, batchId: string): Promise<DealerVehicle> {
  const db = repo();
  const veh = await db.vehicles.insert({ customer_id: customerId, dealer_id: dealer.id, year: v.year, make: v.make, model: v.model, color: v.color, vin: v.vin });
  const summary = `Dealer: ${dealer.name}${v.stock_number ? ` | Stock ${v.stock_number}` : ''} | ${describeServices(v.services, v.panels)}${v.notes ? ` | ${v.notes}` : ''}`.slice(0, 500);
  const job = await db.jobs.insert({ customer_id: customerId, vehicle_id: veh.id, dealer_id: dealer.id, stage: 'new', summary });
  const price = suggestPrice(v.services, dealer.wholesale_pricing);
  try {
    const dv = await db.dealer_vehicles.insert({
      dealer_id: dealer.id, vin: v.vin, stock_number: v.stock_number, year: v.year, make: v.make, model: v.model, photo_paths: [], notes: v.notes, status: 'submitted',
      job_id: job.id, addon_approvals: [], services: v.services, panels: v.panels, color: v.color, lot_address: v.lot_address, batch_id: batchId,
      price, price_source: price === null ? null : 'rate_card',
    });
    await audit('dealer.vehicle.submitted', 'dealer_vehicle', dv.id, `dealer:${dealer.id}`, { batch: batchId, services: v.services.map((s) => s.id) });
    return dv;
  } catch (e) {
    await db.jobs.remove(job.id).catch(() => undefined); await db.vehicles.remove(veh.id).catch(() => undefined); // keep no orphans
    throw e;
  }
}

// ---------------------------------------------------------------- queries
export type VehicleFilter = { q?: string; status?: string; limit?: number };
export type VehicleRow = DealerVehicle & { label: string; pendingAddons: number; statusLabel: string };

const decorate = (v: DealerVehicle): VehicleRow => ({ ...v, label: vehicleLabel(v), pendingAddons: pendingFor(asProposals(v.addon_approvals)).length, statusLabel: STATUS_LABEL[v.status] });

/** Search by stock#, VIN (any part), make/model/year; status accepts a board column key or an exact status. */
export async function listVehicles(dealerId: string, f: VehicleFilter = {}): Promise<VehicleRow[]> {
  let rows = await repo().dealer_vehicles.list({ where: { dealer_id: dealerId }, orderBy: 'created_at', desc: true, limit: 1000 });
  if (f.status && f.status !== 'all') {
    const col = BOARD_COLUMNS.find((c) => c.key === f.status);
    rows = rows.filter((r) => (col ? col.statuses.includes(r.status) : r.status === f.status));
  }
  const q = f.q?.trim().toLowerCase();
  if (q) rows = rows.filter((r) => [r.stock_number, r.vin, r.make, r.model, r.year ? String(r.year) : '', r.notes].some((x) => (x ?? '').toLowerCase().includes(q)));
  return rows.slice(0, f.limit ?? 300).map(decorate);
}

export async function countsByColumn(dealerId: string): Promise<Record<string, number>> {
  const rows = await repo().dealer_vehicles.list({ where: { dealer_id: dealerId }, limit: 2000 });
  const out: Record<string, number> = { all: 0, pending_addons: 0 };
  for (const c of BOARD_COLUMNS) out[c.key] = 0;
  for (const r of rows) {
    if (r.status === 'cancelled') continue;
    out.all!++;
    const c = BOARD_COLUMNS.find((x) => x.statuses.includes(r.status));
    if (c) out[c.key]!++;
    out.pending_addons! += pendingFor(asProposals(r.addon_approvals)).length;
  }
  return out;
}

export async function getVehicle(dealerId: string, id: string): Promise<VehicleRow | null> {
  const v = await repo().dealer_vehicles.get(id);
  return v && v.dealer_id === dealerId ? decorate(v) : null;
}

/** Add-ons as the dealer should see them. */
export const addonsForDealer = (v: DealerVehicle) => dealerVisible(asProposals(v.addon_approvals));

// ---------------------------------------------------------------- photos
export async function attachPhoto(dealerId: string, vehicleId: string, path: string): Promise<DealerVehicle> {
  if (!DEALER_PHOTO_RE.test(path) || !path.startsWith(`dealers/${dealerId}/`)) throw new VehicleError('invalid', 'Bad photo path.');
  const v = await repo().dealer_vehicles.get(vehicleId);
  if (!v || v.dealer_id !== dealerId) throw new VehicleError('not_found', 'Vehicle not found.');
  if (v.photo_paths.length >= DEALER_PHOTO_MAX_PER_VEHICLE) throw new VehicleError('limit', `Up to ${DEALER_PHOTO_MAX_PER_VEHICLE} photos per vehicle.`);
  return repo().dealer_vehicles.update(v.id, { photo_paths: [...v.photo_paths, path] });
}

// ---------------------------------------------------------------- status
/** Move a vehicle along the chain, keep the linked job in step, write the audit row, tell the dealer when it is frontline-ready. */
export async function setVehicleStatus(vehicleId: string, to: VehicleStatus, actor: Actor, opts: { dealerId?: string; scheduledAt?: string | null; note?: string | null } = {}): Promise<DealerVehicle> {
  const db = repo();
  const v = await db.dealer_vehicles.get(vehicleId);
  if (!v || (opts.dealerId && v.dealer_id !== opts.dealerId)) throw new VehicleError('not_found', 'Vehicle not found.');
  if (actor.startsWith('dealer:') && !(to === 'cancelled' && (v.status === 'submitted' || v.status === 'scheduled'))) throw new VehicleError('invalid', 'Dealers can only cancel a vehicle that has not started.');
  assertTransition(v.status, to, { billed: Boolean(v.statement_id) });
  const now = new Date().toISOString();
  const patch: Partial<DealerVehicle> = { status: to };
  if (to === 'scheduled') patch.scheduled_at = opts.scheduledAt ?? v.scheduled_at ?? now;
  if (to === 'submitted') patch.scheduled_at = null;
  if (to === 'done') {
    patch.done_at = now;
    if (v.price == null) {
      const dealer = await db.dealers.get(v.dealer_id);
      const p = suggestPrice((v.services ?? []) as ServiceRequest[], dealer?.wholesale_pricing);
      if (p !== null) { patch.price = p; patch.price_source = 'rate_card'; }
    }
  }
  if (to === 'in_progress' && v.status === 'done') patch.done_at = null;
  const next = await db.dealer_vehicles.update(v.id, patch);
  if (v.job_id) {
    const job = await db.jobs.get(v.job_id);
    if (job) {
      await db.jobs.update(job.id, {
        stage: jobStageFor(to),
        ...(to === 'in_progress' && !job.started_at ? { started_at: now } : {}),
        ...(to === 'done' ? { finished_at: now, final_price: next.price ?? job.final_price ?? null } : {}),
      });
    }
  }
  await audit('dealer.vehicle.status', 'dealer_vehicle', v.id, actor, { from: v.status, to, ...(opts.note ? { note: opts.note.slice(0, 200) } : {}) });
  if (to === 'done') {
    const d = await db.dealers.get(v.dealer_id);
    if (d) await notifyDealer(d, `${vehicleLabel(next)} is frontline-ready`, `${vehicleLabel(next)}${next.stock_number ? ` (stock ${next.stock_number})` : ''} is done. Before and after photos are in your portal: ${portalUrl(`/dealers/dashboard/vehicles/${v.id}`)}`);
  }
  return next;
}

/** Owner sets/overrides the price of a vehicle's base work (whole dollars, 0 allowed for goodwill). Blocked once billed. */
export async function setVehiclePrice(vehicleId: string, price: number | null): Promise<DealerVehicle> {
  const v = await repo().dealer_vehicles.get(vehicleId);
  if (!v) throw new VehicleError('not_found', 'Vehicle not found.');
  if (v.statement_id) throw new VehicleError('invalid', 'Already on a statement.');
  if (price !== null && (!Number.isFinite(price) || price < 0 || price > 100_000)) throw new VehicleError('invalid', 'Price must be between 0 and 100000.');
  const next = await repo().dealer_vehicles.update(v.id, { price: price === null ? null : Math.round(price * 100) / 100, price_source: price === null ? null : 'owner' });
  await audit('dealer.vehicle.priced', 'dealer_vehicle', v.id, 'owner', { price });
  if (v.job_id && price !== null && v.status === 'done') await repo().jobs.update(v.job_id, { final_price: price });
  return next;
}
