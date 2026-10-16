// SECURITY O-09: add-on changes are read-modify-write on one jsonb column. With compare-and-set on the row version nothing is lost and a dealer
// can never approve an offer that changed after they looked at it.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { repo } from '@/lib/db';
import { emailOutbox } from '@/lib/email';
import { approveDealer, signUpDealer } from '@/lib/dealers/accounts';
import { AddonError, asProposals, decideAddon, priceAddon, proposeAddon, withdrawAddon } from '@/lib/dealers/addons';
import { submitBulk } from '@/lib/dealers/vehicles';

const actor = (id: string) => `dealer:${id}` as const;
async function setup() {
  const { dealer } = await signUpDealer({ businessName: 'Race Motors', contactName: 'Pat Manager', email: 'pat@race.example', phone: '(916) 555-0123', lotAddresses: ['1 Auto Mall Dr, Roseville, CA 95661'], apEmail: 'ap@race.example', expectedMonthlyVolume: 10, netTermsRequested: false });
  const d = await approveDealer(dealer.id, {});
  const id = (await submitBulk(d, actor(d.id), ['vin,stock_number,panels,services,notes', '1HGCM82633A004352,R1,,dent,'].join('\n'))).created[0]!.id;
  return { d, id };
}
const addons = async (id: string) => asProposals((await repo().dealer_vehicles.get(id))!.addon_approvals);

beforeEach(async () => { vi.restoreAllMocks(); await repo().reset?.(); emailOutbox().length = 0; });

describe('add-on compare-and-set', () => {
  it('five concurrent proposals all survive (no lost update)', async () => {
    const { id } = await setup();
    await Promise.all(Array.from({ length: 5 }, (_, i) => proposeAddon(id, { label: `Panel ${i}`, price: 50 + i, by: 'owner' }, 'owner')));
    expect((await addons(id)).map((a) => a.label).sort()).toEqual(['Panel 0', 'Panel 1', 'Panel 2', 'Panel 3', 'Panel 4']);
  });
  it('approve and decline at the same moment: exactly one decision wins, the other is refused', async () => {
    const { d, id } = await setup();
    const a = await proposeAddon(id, { label: 'Extra panel', price: 85, by: 'owner' }, 'owner');
    const r = await Promise.allSettled([decideAddon(d, id, a.id, 'approved', actor(d.id)), decideAddon(d, id, a.id, 'declined', actor(d.id))]);
    expect(r.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    const lost = r.find((x) => x.status === 'rejected') as PromiseRejectedResult;
    expect(lost.reason).toBeInstanceOf(AddonError);
    const final = (await addons(id))[0]!;
    expect(['approved', 'declined']).toContain(final.status);
    expect(final.status).toBe((r.find((x) => x.status === 'fulfilled') as PromiseFulfilledResult<{ status: string }>).value.status);
  });
  it('a dealer cannot approve an offer that was re-priced after they opened it: refused, still proposed at the new price', async () => {
    const { d, id } = await setup();
    const a = await proposeAddon(id, { label: 'Extra panel', price: 85, by: 'owner' }, 'owner');
    const t = repo().dealer_vehicles;
    const orig = t.updateIf.bind(t);
    let injected = false;
    vi.spyOn(t, 'updateIf').mockImplementation(async (...args: Parameters<typeof orig>) => {
      if (!injected) { injected = true; await priceAddon(id, a.id, 95); } // the owner re-prices between the dealer's read and write
      return orig(...args);
    });
    await expect(decideAddon(d, id, a.id, 'approved', actor(d.id))).rejects.toMatchObject({ code: 'conflict' });
    const now = (await addons(id))[0]!;
    expect(now).toMatchObject({ status: 'proposed', price: 95 });
  });
  it('an unrelated change to the vehicle (its status) between read and write does not block the approval', async () => {
    const { d, id } = await setup();
    const a = await proposeAddon(id, { label: 'Extra panel', price: 85, by: 'owner' }, 'owner');
    const t = repo().dealer_vehicles;
    const orig = t.updateIf.bind(t);
    let injected = false;
    vi.spyOn(t, 'updateIf').mockImplementation(async (...args: Parameters<typeof orig>) => {
      if (!injected) { injected = true; await t.update(id, { notes: 'moved the car' }); }
      return orig(...args);
    });
    expect((await decideAddon(d, id, a.id, 'approved', actor(d.id))).status).toBe('approved');
    expect((await addons(id))[0]).toMatchObject({ status: 'approved', price: 85 });
  });
  it('owner-side edits retry on fresh data: re-price while a withdraw races lands both changes or a clear error, never a lost update', async () => {
    const { id } = await setup();
    const a = await proposeAddon(id, { label: 'A', price: 50, by: 'owner' }, 'owner');
    const b = await proposeAddon(id, { label: 'B', price: 60, by: 'owner' }, 'owner');
    await Promise.all([priceAddon(id, a.id, 55), withdrawAddon(id, b.id)]);
    const list = await addons(id);
    expect(list.find((x) => x.id === a.id)).toMatchObject({ price: 55, status: 'proposed' });
    expect(list.find((x) => x.id === b.id)!.status).toBe('withdrawn');
  });
});
