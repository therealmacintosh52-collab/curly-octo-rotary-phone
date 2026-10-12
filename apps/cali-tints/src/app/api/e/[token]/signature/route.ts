import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTokenShape } from "@/lib/estimates/public";

export const runtime = "nodejs";

const MAX_BYTES = 1024 * 1024;
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/**
 * POST /api/e/:token/signature — the customer's signature PNG, before they
 * approve. The file goes to the private `signatures` bucket under this
 * estimate's folder (the only path estimate_respond accepts); nothing is
 * linked until the approval itself lands. Token checked, PNG checked, 1 MB cap.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/e/[token]/signature">) {
  const { token } = await ctx.params;
  if (!isTokenShape(token)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const form = await req.formData().catch(() => null);
  const file = form?.get("signature");
  if (!(file instanceof File)) return NextResponse.json({ error: "No signature" }, { status: 400 });
  if (file.size === 0 || file.size > MAX_BYTES) return NextResponse.json({ error: "The signature must be a PNG under 1 MB" }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!PNG_MAGIC.every((b, i) => bytes[i] === b)) return NextResponse.json({ error: "The signature must be a PNG" }, { status: 415 });

  const db = createAdminClient();
  const { data: e } = await db.from("estimates").select("id, company_id, status, expires_at").eq("token", token).maybeSingle();
  if (!e) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (e.status === "accepted" || e.status === "declined") return NextResponse.json({ error: "This estimate was already answered" }, { status: 409 });
  if (e.expires_at && new Date(e.expires_at) < new Date()) return NextResponse.json({ error: "This estimate has expired" }, { status: 410 });

  const path = `${e.company_id}/estimates/${e.id}/${randomUUID()}.png`;
  const { error } = await db.storage.from("signatures").upload(path, bytes, { contentType: "image/png", upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ path });
}
