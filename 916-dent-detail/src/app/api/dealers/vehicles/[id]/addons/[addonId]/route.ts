import { fail, guard, ok, parseJson } from '@/lib/api/http';
import { AddonError, decideAddon } from '@/lib/dealers/addons';
import { requireDealer } from '@/lib/dealers/guard';
import { decideSchema } from '@/lib/dealers/schema';

export const dynamic = 'force-dynamic';

/** Dealer approves or declines a priced add-on proposal. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string; addonId: string }> }) {
  return guard('dealers.addon.decide', async () => {
    const a = await requireDealer(req, { active: true, mutating: true });
    if ('res' in a) return a.res;
    const p = await parseJson(req, decideSchema);
    if (!p.ok) return p.res;
    const { id, addonId } = await ctx.params;
    try {
      const r = await decideAddon(a.ctx.dealer, id, addonId, p.data.decision, `dealer:${a.ctx.profileId}`, p.data.reason);
      return ok({ id: r.id, status: r.status });
    } catch (e) {
      if (e instanceof AddonError) return fail(e.code === 'not_found' ? 404 : 409, e.code, e.message);
      throw e;
    }
  });
}
