import { NextResponse } from "next/server";
import { handleError, requireUser } from "@/lib/api";
import { getProviders } from "@/lib/providers";

export async function GET(req: Request) {
  try {
    await requireUser();
    const sp = new URL(req.url).searchParams;
    const year = Number(sp.get("year"));
    const make = sp.get("make") ?? "";
    if (!year || !make) return NextResponse.json({ error: "year and make are required" }, { status: 400 });
    const models = await getProviders().vehicle.getModels(year, make);
    return NextResponse.json({ models, source: "NHTSA" });
  } catch (e) {
    return handleError(e);
  }
}
