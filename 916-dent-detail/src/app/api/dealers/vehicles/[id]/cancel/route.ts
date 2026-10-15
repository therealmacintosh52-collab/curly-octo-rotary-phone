import { fail, guard, ok } from '@/lib/api/http';
import { requireDealer } from '@/lib/dealers/guard';
import { StatusError } from '@/lib/dealers/status';
import { setVehicleStatus, VehicleError } from '@/lib/dealers/vehicles';

export const dynamic = 'force-dynamic';

/** Dealer cancels a vehicle that has not started (submitted or scheduled). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  return guard('dealers.vehicle.cancel', async () => {
    const a = await requireDealer(req, { active: true, mutating: true });
    if ('res' in a) return a.res;
    const { id } = await ctx.params;
    try {
      const v = await setVehicleStatus(id, 'cancelled', `dealer:${a.ctx.profileId}`, { dealerId: a.ctx.dealer.id });
      return ok({ status: v.status });
    } catch (e) {
      if (e instanceof VehicleError) return fail(e.code === 'not_found' ? 404 : 409, e.code, e.message);
      if (e instanceof StatusError) return fail(409, 'bad_state', e.message);
      throw e;
    }
  });
}
