import { fail, guard, limited, ok, parseJson } from '@/lib/api/http';
import { requireDealer } from '@/lib/dealers/guard';
import { submitSchema } from '@/lib/dealers/schema';
import { createFromRows, listVehicles, previewBulk, previewCells } from '@/lib/dealers/vehicles';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return guard('dealers.vehicles.list', async () => {
    const a = await requireDealer(req);
    if ('res' in a) return a.res;
    const u = new URL(req.url);
    const rows = await listVehicles(a.ctx.dealer.id, { q: u.searchParams.get('q') ?? undefined, status: u.searchParams.get('status') ?? undefined, limit: 200 });
    return ok({ vehicles: rows.map((v) => ({ id: v.id, vin: v.vin, stock_number: v.stock_number, label: v.label, status: v.status, statusLabel: v.statusLabel, pendingAddons: v.pendingAddons, updated_at: v.updated_at })) });
  });
}

/** Submit one vehicle ({vehicle}) or many ({csv}). `dryRun` validates and returns the per-row report without saving. */
export async function POST(req: Request) {
  return guard('dealers.vehicles.submit', async () => {
    const a = await requireDealer(req, { active: true, mutating: true });
    if ('res' in a) return a.res;
    const rl = await limited(req, 'dealer-submit', 60, 600);
    if (rl) return rl;
    const p = await parseJson(req, submitSchema, 300_000);
    if (!p.ok) return p.res;
    const d = a.ctx.dealer;
    const body = p.data;
    let rows; let notes: string[] = [];
    if ('csv' in body) {
      const prev = await previewBulk(d.id, body.csv);
      if (prev.fatal.length) return fail(400, 'bad_file', prev.fatal[0]!);
      rows = prev.rows; notes = prev.notes;
    } else {
      const v = body.vehicle;
      const cells = { vin: v.vin, stock_number: v.stockNumber ?? '', year: v.year ?? '', make: v.make ?? '', model: v.model ?? '', color: v.color ?? '', panels: v.panels ?? '', services: v.services.join(';'), notes: v.notes ?? '' };
      rows = (await previewCells(d.id, [{ line: 1, cells }])).rows;
    }
    const summary = { okCount: rows.filter((r) => r.ok).length, errorCount: rows.filter((r) => !r.ok).length };
    if (body.dryRun) return ok({ dryRun: true, notes, ...summary, rows: rows.map((r) => ({ line: r.line, ok: r.ok, vin: r.vin, errors: r.errors, warnings: r.warnings, value: r.value ? { stock_number: r.value.stock_number, year: r.value.year, make: r.value.make, model: r.value.model, panels: r.value.panels, services: r.value.services.map((s) => s.id) } : null })) });
    const report = await createFromRows(d, `dealer:${a.ctx.profileId}`, rows);
    return ok({ ...report, notes }, { status: report.created.length ? 201 : 200 });
  });
}
