import { assessZip } from '@/lib/geo';
import { guard, limited, ok } from '@/lib/api/http';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return guard('geo.zip', async () => {
    const rl = await limited(req, 'geo', 60, 60);
    if (rl) return rl;
    const zip = new URL(req.url).searchParams.get('zip') ?? '';
    return ok(assessZip(zip));
  });
}
