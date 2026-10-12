import { NextResponse } from "next/server";
import { handleError, requireUser } from "@/lib/api";
import { getProviders } from "@/lib/providers";

/** Labor-time lookup through the LaborProvider adapter (SAMPLE stub until a licensed guide is wired in). */
export async function GET(req: Request) {
  try {
    await requireUser();
    const sp = new URL(req.url).searchParams;
    const q = sp.get("q") ?? "";
    const key = { year: Number(sp.get("year")) || 0, make: sp.get("make") ?? "", model: sp.get("model") ?? "" };
    const p = getProviders().labor;
    const results = await p.searchOperations(key, q);
    return NextResponse.json({ provider: p.name, source: p.source, results });
  } catch (e) {
    return handleError(e);
  }
}
