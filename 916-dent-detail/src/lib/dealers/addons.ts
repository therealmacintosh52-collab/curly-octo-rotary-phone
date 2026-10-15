// Add-on proposals ("we found a second dented panel"): proposed by a tech/owner, PRICED by the owner, approved or declined by
// the dealer. Stored in dealer_vehicles.addon_approvals (jsonb). Pure transition helpers first, I/O below.
import { randomUUID } from 'node:crypto';
import { repo } from '@/lib/db';
import type { Dealer, DealerVehicle } from '@/lib/db/types';
import { audit, type Actor } from './audit';
import { notifyDealer, notifyOwner, portalUrl } from './notify';

export type AddonStatus = 'draft' | 'proposed' | 'approved' | 'declined' | 'withdrawn';
export type AddonProposal = {
  id: string; label: string; description: string | null; price: number | null; proposedBy: 'tech' | 'owner';
  proposedAt: string; status: AddonStatus; pricedAt?: string | null; decidedAt?: string | null; decidedBy?: string | null; reason?: string | null;
};

export const ADDON_SUGGESTIONS = ['Additional panel dent removal', 'Interior Reset', 'Headlight restoration', 'Paint Deep-Clean', 'Pet hair removal', 'Odor treatment'];

export class AddonError extends Error {
  constructor(public code: 'not_found' | 'bad_state' | 'invalid' | 'billed', message: string) { super(message); this.name = 'AddonError'; }
}

export const asProposals = (v: unknown): AddonProposal[] => (Array.isArray(v) ? (v as AddonProposal[]).filter((a) => a && typeof a.id === 'string') : []);
/** What a dealer may see: priced proposals and their outcomes (never unpriced drafts or withdrawn ones). */
export const dealerVisible = (list: AddonProposal[]): AddonProposal[] => list.filter((a) => a.status === 'proposed' || a.status === 'approved' || a.status === 'declined');
export const pendingFor = (list: AddonProposal[]): AddonProposal[] => list.filter((a) => a.status === 'proposed');

const validPrice = (p: number) => Number.isFinite(p) && p > 0 && p <= 10_000;

export function newProposal(i: { label: string; description?: string | null; price?: number | null; by: 'tech' | 'owner' }, now = new Date()): AddonProposal {
  const label = i.label.trim().slice(0, 80);
  if (!label) throw new AddonError('invalid', 'Describe the add-on.');
  if (i.price != null && !validPrice(i.price)) throw new AddonError('invalid', 'Price must be more than $0 and at most $10,000.');
  const priced = i.price != null;
  return {
    id: randomUUID(), label, description: i.description?.trim().slice(0, 300) || null, price: priced ? Math.round((i.price as number) * 100) / 100 : null,
    proposedBy: i.by, proposedAt: now.toISOString(), status: priced ? 'proposed' : 'draft', pricedAt: priced ? now.toISOString() : null,
  };
}

export function applyPrice(list: AddonProposal[], id: string, price: number, now = new Date()): AddonProposal[] {
  if (!validPrice(price)) throw new AddonError('invalid', 'Price must be more than $0 and at most $10,000.');
  const a = list.find((x) => x.id === id);
  if (!a) throw new AddonError('not_found', 'Add-on not found.');
  if (a.status !== 'draft' && a.status !== 'proposed') throw new AddonError('bad_state', `A ${a.status} add-on cannot be re-priced.`);
  return list.map((x) => (x.id === id ? { ...x, price: Math.round(price * 100) / 100, status: 'proposed', pricedAt: now.toISOString() } : x));
}

export function applyDecision(list: AddonProposal[], id: string, decision: 'approved' | 'declined', by: string, reason?: string | null, now = new Date()): AddonProposal[] {
  const a = list.find((x) => x.id === id);
  if (!a || a.status === 'draft' || a.status === 'withdrawn') throw new AddonError('not_found', 'Add-on not found.');
  if (a.status !== 'proposed') throw new AddonError('bad_state', `This add-on was already ${a.status}.`);
  if (a.price === null) throw new AddonError('bad_state', 'This add-on has no price yet.');
  return list.map((x) => (x.id === id ? { ...x, status: decision, decidedAt: now.toISOString(), decidedBy: by, reason: reason?.trim().slice(0, 300) || null } : x));
}

// ---------------------------------------------------------------- I/O
async function load(vehicleId: string, dealerId?: string): Promise<DealerVehicle> {
  const v = await repo().dealer_vehicles.get(vehicleId);
  if (!v || (dealerId && v.dealer_id !== dealerId)) throw new AddonError('not_found', 'Vehicle not found.');
  return v;
}
const vlabel = (v: DealerVehicle) => `${v.stock_number ? `stock ${v.stock_number}` : v.vin ? `VIN …${v.vin.slice(-6)}` : 'a vehicle'}`;

async function announce(v: DealerVehicle, a: AddonProposal) {
  const d = await repo().dealers.get(v.dealer_id);
  if (!d) return;
  await notifyDealer(d, `Approval needed: add-on for ${vlabel(v)}`, `We found something extra on ${vlabel(v)}: ${a.label}${a.description ? ` (${a.description})` : ''}. Price: $${a.price?.toFixed(2)}. We will not do it until you approve. Approve or decline here: ${portalUrl(`/dealers/dashboard/vehicles/${v.id}`)}`);
}

export async function proposeAddon(vehicleId: string, i: { label: string; description?: string | null; price?: number | null; by: 'tech' | 'owner' }, actor: Actor): Promise<AddonProposal> {
  const v = await load(vehicleId);
  if (v.status === 'invoiced' || v.statement_id) throw new AddonError('billed', 'This vehicle is already billed.');
  if (v.status === 'cancelled') throw new AddonError('bad_state', 'This vehicle is cancelled.');
  const a = newProposal(i);
  await repo().dealer_vehicles.update(v.id, { addon_approvals: [...asProposals(v.addon_approvals), a] });
  await audit('dealer.addon.proposed', 'dealer_vehicle', v.id, actor, { addon: a.id, priced: a.price !== null });
  if (a.status === 'proposed') await announce(v, a); else await notifyOwner('Add-on needs a price', `${vlabel(v)}: "${a.label}" is waiting for you to price it: ${portalUrl('/admin/dealers')}`);
  return a;
}

export async function priceAddon(vehicleId: string, addonId: string, price: number, actor: Actor = 'owner'): Promise<AddonProposal> {
  const v = await load(vehicleId);
  const next = applyPrice(asProposals(v.addon_approvals), addonId, price);
  await repo().dealer_vehicles.update(v.id, { addon_approvals: next });
  const a = next.find((x) => x.id === addonId)!;
  await audit('dealer.addon.priced', 'dealer_vehicle', v.id, actor, { addon: a.id, price: a.price });
  await announce(v, a);
  return a;
}

export async function decideAddon(dealer: Pick<Dealer, 'id' | 'name'>, vehicleId: string, addonId: string, decision: 'approved' | 'declined', actor: Actor, reason?: string | null): Promise<AddonProposal> {
  const v = await load(vehicleId, dealer.id);
  const next = applyDecision(asProposals(v.addon_approvals), addonId, decision, actor, reason);
  await repo().dealer_vehicles.update(v.id, { addon_approvals: next });
  const a = next.find((x) => x.id === addonId)!;
  await audit(`dealer.addon.${decision}`, 'dealer_vehicle', v.id, actor, { addon: a.id, price: a.price });
  await notifyOwner(`Add-on ${decision} by ${dealer.name}`, `${vlabel(v)}: "${a.label}" ${decision}${a.price != null ? ` ($${a.price.toFixed(2)})` : ''}.${reason ? ` Note: ${reason}` : ''}`);
  return a;
}

export async function withdrawAddon(vehicleId: string, addonId: string, actor: Actor = 'owner'): Promise<void> {
  const v = await load(vehicleId);
  const list = asProposals(v.addon_approvals);
  const a = list.find((x) => x.id === addonId);
  if (!a) throw new AddonError('not_found', 'Add-on not found.');
  if (a.status === 'approved' && v.statement_id) throw new AddonError('billed', 'This add-on is already billed.');
  await repo().dealer_vehicles.update(v.id, { addon_approvals: list.map((x) => (x.id === addonId ? { ...x, status: 'withdrawn' as const } : x)) });
  await audit('dealer.addon.withdrawn', 'dealer_vehicle', v.id, actor, { addon: addonId });
}
