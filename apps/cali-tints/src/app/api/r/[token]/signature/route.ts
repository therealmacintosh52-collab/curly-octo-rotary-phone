import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { anonClient, isTokenShape } from "@/lib/estimates/public";

export const runtime = "nodejs";

const MAX_BYTES = 1024 * 1024;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * POST /api/r/:token/signature — the customer's signature PNG for the paid invoice, from their own link.
 * It goes to the private `signatures` bucket under this job's receipt folder (the only path
 * sign_receipt_by_token accepts); nothing is linked until the signature itself lands.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/r/[token]/signature">) {
  const { token } = await ctx.params;
  if (!isTokenShape(token)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("signature");
  if (!(file instanceof File)) return NextResponse.json({ error: "No signature" }, { status: 400 });
  if (file.size === 0 || file.size > MAX_BYTES) return NextResponse.json({ error: "The signature must be a PNG under 1 MB" }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!PNG_MAGIC.every((b, i) => bytes[i] === b)) return NextResponse.json({ error: "The signature must be a PNG" }, { status: 415 });

  const db = createAdminClient();
  const { data: t } = await db.from("receipt_tokens").select("job_id, company_id").eq("token", token).maybeSingle();
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data: r } = await anonClient().rpc("receipt_by_token", { p_token: token });
  if (!r?.paid_at) return NextResponse.json({ error: "The invoice is signed after it is paid" }, { status: 409 });
  if (r.signed_name) return NextResponse.json({ error: "This invoice is already signed" }, { status: 409 });

  const path = `${t.company_id}/receipts/${t.job_id}/${randomUUID()}.png`;
  const { error } = await db.storage.from("signatures").upload(path, bytes, { contentType: "image/png", upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ path });
}
