import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const MAX_BYTES = 1024 * 1024;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * POST /api/estimates/:id/signature — the customer's signature on an approval
 * taken in person (0059). Stored in the private `signatures` bucket under the
 * estimate's folder, the only path mark_estimate_accepted accepts.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/estimates/[id]/signature">) {
  const session = await getSession();
  if (!session.canPrices) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const { id } = await ctx.params;
  const supabase = await createClient();
  const { data: e, error } = await supabase.rpc("estimate_detail", { p_id: id });
  if (error || !e) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("signature");
  if (!(file instanceof File)) return NextResponse.json({ error: "No signature" }, { status: 400 });
  if (file.size === 0 || file.size > MAX_BYTES) return NextResponse.json({ error: "The signature must be a PNG under 1 MB" }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!PNG_MAGIC.every((b, i) => bytes[i] === b)) return NextResponse.json({ error: "The signature must be a PNG" }, { status: 415 });
  const path = `${session.company.id}/estimates/${id}/${randomUUID()}.png`;
  const { error: upErr } = await createAdminClient().storage.from("signatures").upload(path, bytes, { contentType: "image/png", upsert: false });
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  return NextResponse.json({ path });
}
