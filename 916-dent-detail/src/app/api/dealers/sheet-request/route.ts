import { fail, guard, limited, ok, parseJson } from '@/lib/api/http';
import { sameOrigin } from '@/lib/dealers/guard';
import { createWholesaleLead } from '@/lib/dealers/leads';
import { sheetRequestSchema } from '@/lib/dealers/schema';
import { normalizePhone } from '@/lib/sms';

export const dynamic = 'force-dynamic';

/** "Request wholesale sheet": creates a CRM lead (source=dealer). Nothing is sent to the requester automatically. */
export async function POST(req: Request) {
  return guard('dealers.sheet', async () => {
    if (!sameOrigin(req)) return fail(403, 'bad_origin', 'Cross-site request blocked.');
    const rl = await limited(req, 'dealer-sheet', 6, 3600);
    if (rl) return rl;
    const p = await parseJson(req, sheetRequestSchema);
    if (!p.ok) return p.res;
    const phone = p.data.phone ? normalizePhone(p.data.phone) : null;
    if (p.data.phone && !phone) return fail(400, 'invalid_phone', 'Enter a valid US phone number.');
    await createWholesaleLead({ ...p.data, phone });
    return ok({ received: true }, { status: 201 });
  });
}
