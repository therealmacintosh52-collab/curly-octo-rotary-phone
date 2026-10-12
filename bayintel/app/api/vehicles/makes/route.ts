import { NextResponse } from "next/server";
import { handleError, requireUser } from "@/lib/api";
import { getProviders } from "@/lib/providers";

export async function GET(req: Request) {
  try {
    await requireUser();
    const year = Number(new URL(req.url).searchParams.get("year")) || new Date().getFullYear();
    const makes = await getProviders().vehicle.getMakes(year);
    return NextResponse.json({ makes, source: "NHTSA" });
  } catch (e) {
    return handleError(e);
  }
}
