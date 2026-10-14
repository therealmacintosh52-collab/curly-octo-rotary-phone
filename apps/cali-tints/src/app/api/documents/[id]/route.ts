import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/** GET /api/documents/:id — a frozen signed copy, for staff (owner, admin, advisor, manager). Never cached. */
export async function GET(_req: Request, ctx: RouteContext<"/api/documents/[id]">) {
  const session = await getSession();
  if (!session.isAdmin) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const supabase = await createClient();
  const { data: path } = await supabase.rpc("document_path_for", { p_id: id });
  if (!path || !path.startsWith(`${session.company.id}/`)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data, error } = await createAdminClient().storage.from("signed-docs").download(path);
  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const name = path.split("/").slice(-2).join("-");
  return new NextResponse(await data.arrayBuffer(), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="signed-${name}"`, "Cache-Control": "private, no-store" } });
}
