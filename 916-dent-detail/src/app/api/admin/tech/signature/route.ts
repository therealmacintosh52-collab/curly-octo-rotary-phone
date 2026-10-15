import { z } from 'zod';
import { adminRoute, HttpError } from '@/lib/admin/api';
import { jobForSession } from '@/lib/admin/access';
import { actorOf } from '@/lib/admin/events';
import { saveSignature } from '@/lib/admin/photos';
import { ANY_ROLE } from '@/lib/auth/roles';
import { ok } from '@/lib/api/http';

export const dynamic = 'force-dynamic';

const schema = z.object({ jobId: z.string().uuid(), dataUrl: z.string().max(600_000).regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, 'Signature must be a PNG.'), opId: z.string().max(80).optional() });

export async function POST(req: Request) {
  return adminRoute('admin.signature', req, ANY_ROLE, schema, async ({ session, body }) => {
    const job = await jobForSession(session, body.jobId);
    if (job.signature_path && body.opId) return ok({ ok: true, replay: true });
    const buf = Buffer.from(body.dataUrl.split(',')[1]!, 'base64');
    const r = await saveSignature(job, buf, actorOf(session));
    if (typeof r !== 'string') throw new HttpError(400, r.error, 'That signature could not be saved.');
    return ok({ ok: true });
  });
}
