import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

const KINDS = new Set(["estimate", "job", "pickup"]);

/**
 * GET /api/signatures/:kind/:id — a stored signature image for staff
 * (owner, admin, advisor, manager). kind: estimate (the approval), job (the
 * check-in or an extra-work approval) or pickup (the receipt). The path is
 * resolved in the database for the caller's company; the image is streamed,
 * never cached.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/signatures/[kind]/[id]">) {
  const session = await getSession();
  if (!session.isAdmin) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const { kind, id } = await ctx.params;
  if (!KINDS.has(kind) || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const supabase = await createClient();
  const { data: path } = await supabase.rpc("signature_path_for", { p_kind: kind, p_id: id });
  if (!path || !path.startsWith(`${session.company.id}/`)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data, error } = await createAdminClient().storage.from("signatures").download(path);
  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return new NextResponse(await data.arrayBuffer(), { headers: { "Content-Type": "image/png", "Cache-Control": "private, no-store" } });
}
